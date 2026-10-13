/**
 * 원본 장 XHTML → 우리 조각 계약(리더 셸 클래스) 변환기.
 * 이식 원본: book/출판사/pipeline/epub_to_html.py 의 Conv(HTMLParser) — 같은 매핑 규칙을 DOM 트리 순회로 옮김.
 *
 * 매핑: h1/h2→sec-head · h3→sub · h4+→case · p/ul/ol/blockquote/pre/img/table → 셸 클래스.
 * 허용 목록 재구성(allowlist rebuild): 원본 노드를 복사하지 않고 허용된 태그만 *새로 써서* 내보낸다.
 * → 원서의 CSS·class·style·script·on* 핸들러는 구조적으로 들어올 수 없다(정제기는 이 위에 한 겹 더).
 */

const BLOCK_MAP: Record<string, [open: string, close: string]> = {
  p: ["<p>", "</p>"],
  blockquote: ["<blockquote>", "</blockquote>"],
  ul: ['<ul class="q">', "</ul>"],
  ol: ["<ol>", "</ol>"],
  li: ["<li>", "</li>"],
  pre: ['<pre class="code">', "</pre>"],
};
const HEAD_MAP: Record<string, { level: "h2" | "h3" | "h4"; cls: string }> = {
  h1: { level: "h2", cls: "sec-head" },
  h2: { level: "h2", cls: "sec-head" },
  h3: { level: "h3", cls: "sub" },
  h4: { level: "h4", cls: "case" },
  h5: { level: "h4", cls: "case" },
  h6: { level: "h4", cls: "case" },
};
const INLINE = new Set(["em", "strong", "b", "i", "code", "sup", "sub", "u", "small"]);
/** 내용째 버림. svg 는 원본 파이프라인과 동일하게 제외(표지용 svg 래퍼 등). */
const DROP_CONTENT = new Set(["script", "style", "head", "svg", "nav", "noscript", "template", "iframe", "object", "embed"]);
const TABLE_PARTS = new Set(["thead", "tbody", "tfoot", "tr", "th", "td"]);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function norm(s: string): string {
  return (s || "").toLowerCase().replace(/[^0-9a-z가-힣]/g, "");
}

/** 패키지 경로 해석 — 장 문서 경로 기준 상대 href 를 패키지 루트 기준 전체 경로로. */
export function resolvePath(baseFile: string, href: string): string {
  let clean = href.split("#")[0].split("?")[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* 잘못된 퍼센트 인코딩은 원문 그대로 */
  }
  if (!clean) return "";
  const parts = clean.startsWith("/") ? [] : baseFile.split("/").slice(0, -1);
  for (const seg of clean.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

export interface ConvertOptions {
  /** 장 제목 — 본문 첫머리의 제목 중복(장 제목·번호)을 걸러내는 데 쓴다. */
  title: string;
  /** 이 장 문서의 패키지 경로(그림 상대경로 해석 기준). */
  docPath: string;
  /** 절 제목 id 접두(예: "ch3" → "ch3-s1"). 목차·랜드마크 이동의 앵커. */
  idPrefix: string;
}

/**
 * 장 문서 파싱 — XHTML(XML) 로 먼저 시도하고, 깨진 문서면 HTML 로 관대하게.
 * HTML 파서로만 읽으면 XHTML 의 자기닫힘 태그(`<a id="x"/>`, `<p/>`)가 뒤 내용을 통째로 삼키는 오파싱이 난다.
 */
export function parseXhtml(text: string): Document {
  const xml = new DOMParser().parseFromString(text, "application/xhtml+xml");
  if (!xml.getElementsByTagName("parsererror").length && xml.querySelector("body")) return xml;
  return new DOMParser().parseFromString(text, "text/html");
}

export function convertChapter(xhtml: string, opts: ConvertOptions): string {
  const doc = parseXhtml(xhtml);
  const out: string[] = [];
  const titleNorm = norm(opts.title);
  let bodyStarted = false;
  let secNo = 0;

  const titleish = (txt: string): boolean => {
    const n = norm(txt);
    if (!n || /^\d+$/.test(n)) return true;
    if (/^(chapter|part|appendix)\s*\d/i.test(txt.trim())) return true;
    if (titleNorm && (n === titleNorm || titleNorm.includes(n))) return true;
    return false;
  };

  const walkChildren = (el: Node) => {
    el.childNodes.forEach(walk);
  };

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(escapeHtml(node.nodeValue || ""));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.localName.toLowerCase();

    if (DROP_CONTENT.has(tag)) return;

    if (tag === "img") {
      const src = el.getAttribute("src") || "";
      const path = src ? resolvePath(opts.docPath, src) : "";
      if (path) {
        bodyStarted = true;
        const alt = escapeHtml(el.getAttribute("alt") || "");
        out.push(`<figure class="figimg"><img data-asset="${escapeHtml(path)}" alt="${alt}"/></figure>\n`);
      }
      return;
    }
    if (tag === "table") {
      bodyStarted = true;
      out.push('<figure class="tablewrap"><table class="data">');
      walkChildren(el);
      out.push("</table></figure>\n");
      return;
    }
    if (TABLE_PARTS.has(tag)) {
      out.push(`<${tag}>`);
      walkChildren(el);
      out.push(`</${tag}>`);
      return;
    }
    const head = HEAD_MAP[tag];
    if (head) {
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!bodyStarted) {
        // 본문 시작 전 제목 = 장 제목/번호의 중복이면 버림(장 표지가 대신 보여줌), 실제 섹션이면 살림
        if (titleish(txt)) return;
        bodyStarted = true;
      }
      if (!txt) return;
      const id = head.cls === "sec-head" ? ` id="${opts.idPrefix}-s${++secNo}"` : "";
      out.push(`<${head.level} class="${head.cls}"${id}>`);
      walkChildren(el);
      out.push(`</${head.level}>\n`);
      return;
    }
    const block = BLOCK_MAP[tag];
    if (block) {
      bodyStarted = true;
      out.push(block[0]);
      walkChildren(el);
      out.push(block[1] + "\n");
      return;
    }
    if (tag === "br") {
      out.push("<br/>");
      return;
    }
    if (INLINE.has(tag)) {
      out.push(`<${tag}>`);
      walkChildren(el);
      out.push(`</${tag}>`);
      return;
    }
    // div/span/section/a/figure 등 = 태그만 벗기고 내용 유지(unwrap)
    walkChildren(el);
  }

  const body = doc.querySelector("body");
  if (body) walkChildren(body);
  return out
    .join("")
    .replace(/<p>\s*<\/p>\n?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 장 문서의 본문 글자 수(앞부속·빈 구분지 판별용). */
export function textLength(xhtml: string): number {
  const body = parseXhtml(xhtml).querySelector("body");
  if (!body) return 0;
  body.querySelectorAll("script,style").forEach((n) => n.remove());
  return (body.textContent || "").length;
}
