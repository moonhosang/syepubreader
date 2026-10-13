/**
 * EPUB 어댑터 — 패키지(OPF)·spine·목차를 해석해 공통 Book 모델로.
 * 이식 원본: book/출판사/pipeline/extract_epub.py(구조 분석) + epub_to_html.py(앞부속 제외·장 번호·변환).
 */
import JSZip from "jszip";
import type { Book, Chapter } from "../book/model";
import { convertChapter, parseXhtml, resolvePath, textLength } from "../book/convert";

interface ManifestItem {
  id: string;
  path: string;
  mediaType: string;
  properties: string;
}

/** EPUB 판별 — 확장자가 아니라 내용으로(압축 푼 EPUB 을 다시 zip 으로 묶은 경우도 인식). */
export function looksLikeEpub(zip: JSZip): boolean {
  return Object.keys(zip.files).some((n) => n.toLowerCase().endsWith("meta-inf/container.xml"));
}

/** 대소문자 무시 경로 찾기(일부 EPUB 은 META-INF 대소문자가 제각각). */
function findFile(zip: JSZip, path: string): JSZip.JSZipObject | null {
  const exact = zip.file(path);
  if (exact) return exact;
  const lower = path.toLowerCase();
  const hit = Object.keys(zip.files).find((n) => n.toLowerCase() === lower);
  return hit ? zip.file(hit) : null;
}

/** 패키지 루트 접두(zip 안에 상위 폴더 하나로 감싸 묶인 경우 "folder/"). */
function packagePrefix(zip: JSZip): string {
  const c = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith("meta-inf/container.xml"));
  return c ? c.slice(0, c.length - "META-INF/container.xml".length) : "";
}

const byLocal = (root: Document | Element, name: string): Element[] =>
  Array.from(root.getElementsByTagNameNS("*", name));

// ---- 앞/뒤 부속 제외 휴리스틱 (epub_to_html.py 와 동일 규칙) ----
const CONTENT_HINT = /^\s*(chapter|part|appendix|lesson|section)\s*\d|^\s*\d+[.\s:]/i;
const TITLE_SKIP =
  /\b(cover|table of contents|contents|copyright|title page|colophon|dedication|index|acknowledge?ments?|about the authors?|about this book|foreword|praise|other books|credits|reader services|trademark|bibliography|glossary|half[- ]?title|epigraph|sponsors?|advert\w*)\b/i;
/** 'index'(index_split 등)는 넣지 않는다 — 색인은 ix\d 로만(분할 본문 오탐 방지). */
const FILE_SKIP = /(^|[/\\])(cover|toc\d*|nav\d*|titlepage\d*|copyright[-_]?page\d*|colophon\d*|dedication\d*|eula|ix\d+|frontmatter)/i;

function isContent(path: string, title: string, textLen: number): boolean {
  const base = path.split("/").pop()!.toLowerCase();
  if (textLen < 200) return false;
  if (!/\.(xhtml|html|htm)$/.test(base)) return false;
  if (CONTENT_HINT.test(title)) return true;
  if (title && TITLE_SKIP.test(title)) return false;
  if (FILE_SKIP.test(base)) return false;
  return true;
}

/** 표지 후보 점수(assemble.py 와 동일) — 메타데이터에 표지 지정이 없을 때만 쓴다. */
function coverScore(path: string): number {
  const b = path.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
  if (/other|enjoy|back|thumb|promo|ad[_-]|logo/.test(b)) return -1;
  if (["cover", "cover-image", "coverimage", "front", "frontcover"].includes(b)) return 100;
  if (b.includes("coverfigure")) return 90;
  if (b.includes("cover")) return 80;
  if (/^97[89]\d{9,10}$/.test(b)) return 70;
  if (/^\d{6,13}$/.test(b)) return 40;
  return 0;
}

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const f = findFile(zip, path);
  return f ? f.async("string") : null;
}

function unescapeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export async function openEpub(zip: JSZip, fileName: string): Promise<Book> {
  const prefix = packagePrefix(zip);

  // 1) OPF 위치 — container.xml 의 rootfile, 없으면 아무 .opf
  let opfPath = "";
  const container = await readText(zip, prefix + "META-INF/container.xml");
  if (container) {
    const rf = byLocal(new DOMParser().parseFromString(container, "application/xml"), "rootfile")[0];
    const full = rf?.getAttribute("full-path");
    if (full) opfPath = prefix + full;
  }
  if (!opfPath || !findFile(zip, opfPath)) {
    opfPath = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(".opf")) || "";
  }
  const opfText = opfPath ? await readText(zip, opfPath) : null;
  if (!opfText) throw new Error("EPUB 패키지 정보(OPF)를 찾지 못했습니다.");
  const opf = new DOMParser().parseFromString(opfText, "application/xml");

  // 2) 메타데이터
  const metaText = (name: string) => (byLocal(opf, name)[0]?.textContent || "").trim();
  const meta = {
    title: metaText("title") || fileName.replace(/\.[^.]+$/, ""),
    author: metaText("creator"),
    publisher: metaText("publisher"),
    language: (metaText("language") || "en").split("-")[0].toLowerCase(),
  };

  // 3) manifest(id → 전체 경로) · spine(읽는 순서)
  const manifest = new Map<string, ManifestItem>();
  for (const it of byLocal(opf, "item")) {
    const id = it.getAttribute("id") || "";
    const href = it.getAttribute("href") || "";
    if (!id || !href) continue;
    manifest.set(id, {
      id,
      path: resolvePath(opfPath, href),
      mediaType: it.getAttribute("media-type") || "",
      properties: it.getAttribute("properties") || "",
    });
  }
  const byPath = new Map([...manifest.values()].map((m) => [m.path, m] as const));
  const spine = byLocal(opf, "itemref")
    .map((r) => manifest.get(r.getAttribute("idref") || ""))
    .filter((m): m is ManifestItem => !!m);

  // 4) 목차 제목(경로 → 제목) — EPUB3 nav 우선, 없으면 EPUB2 NCX
  const toc = new Map<string, string>();
  const navItem = [...manifest.values()].find((m) => /\bnav\b/.test(m.properties));
  const navText = navItem ? await readText(zip, navItem.path) : null;
  if (navItem && navText) {
    for (const a of Array.from(parseXhtml(navText).querySelectorAll("a[href]"))) {
      const p = resolvePath(navItem.path, a.getAttribute("href") || "");
      const label = (a.textContent || "").replace(/\s+/g, " ").trim();
      if (p && label && !toc.has(p)) toc.set(p, label);
    }
  }
  if (!toc.size) {
    const ncxItem = [...manifest.values()].find((m) => m.mediaType === "application/x-dtbncx+xml");
    const ncxText = ncxItem ? await readText(zip, ncxItem.path) : null;
    if (ncxItem && ncxText) {
      const ncx = new DOMParser().parseFromString(ncxText, "application/xml");
      for (const np of byLocal(ncx, "navPoint")) {
        const label = (byLocal(np, "text")[0]?.textContent || "").replace(/\s+/g, " ").trim();
        const src = byLocal(np, "content")[0]?.getAttribute("src");
        const p = src ? resolvePath(ncxItem.path, src) : "";
        if (p && label && !toc.has(p)) toc.set(p, label);
      }
    }
  }

  // 5) 본문 장 — 앞부속 제외 + 장 번호 + 변환
  const chapters: Chapter[] = [];
  let chapterNo = 0;
  let idx = 0;
  for (const item of spine) {
    idx++;
    const text = await readText(zip, item.path);
    if (text == null) continue;
    let title = (toc.get(item.path) || "").replace(/\s+/g, " ").trim();
    if (!isContent(item.path, title, textLength(text))) continue;
    if (!title) title = `${idx}`;
    let num: string | undefined;
    if (/^\s*(?:chapter\s+)?(\d+)[.\s:]/i.test(title)) {
      num = String(++chapterNo);
      title = title.replace(/^\s*(?:chapter\s+)?\d+[.\s:]+/i, "").trim() || title;
    }
    const id = `ch${chapters.length + 1}`;
    chapters.push({ id, src: item.path, title, num, html: convertChapter(text, { title, docPath: item.path, idPrefix: id }) });
  }
  if (!chapters.length) throw new Error("본문 장을 찾지 못했습니다(앞부속 판별이 과했을 수 있음).");

  // 6) 그림 자산 — 본문이 실제로 참조하는 것 + 표지
  const used = new Set<string>();
  for (const ch of chapters) for (const mm of ch.html.matchAll(/data-asset="([^"]+)"/g)) used.add(unescapeAttr(mm[1]));
  const images = [...manifest.values()].filter((m) => m.mediaType.startsWith("image/"));
  const coverMetaId = byLocal(opf, "meta").find((e) => e.getAttribute("name") === "cover")?.getAttribute("content");
  const coverMeta = coverMetaId ? manifest.get(coverMetaId) : undefined;
  const coverItem =
    images.find((m) => /\bcover-image\b/.test(m.properties)) ||
    (coverMeta && coverMeta.mediaType.startsWith("image/") ? coverMeta : undefined) ||
    images.filter((m) => coverScore(m.path) > 0).sort((a, b) => coverScore(b.path) - coverScore(a.path))[0];
  if (coverItem) used.add(coverItem.path);

  const assets = new Map<string, Blob>();
  for (const path of used) {
    const f = findFile(zip, path);
    if (!f) continue;
    const type = byPath.get(path)?.mediaType;
    const blob = await f.async("blob");
    assets.set(path, type ? blob.slice(0, blob.size, type) : blob); // media-type 를 붙여야 SVG 등이 <img> 로 그려짐
  }

  return {
    meta,
    chapters,
    assets,
    coverAsset: coverItem && assets.has(coverItem.path) ? coverItem.path : undefined,
    key: `${meta.title}|${meta.author}`,
  };
}
