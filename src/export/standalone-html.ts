/**
 * 독립 실행 HTML — 책 1권을 셸·폰트·그림까지 품은 단일 .html 로(서버·인터넷 없이 더블클릭으로 열림).
 * 소비처: ① cli/epub-to-html.ts(출판 파이프라인 변환본) ② (4단계) 앱의 「HTML 내보내기」.
 * 이식 원본: book/출판사/pipeline/assemble.py 의 최종 HTML 골격·FOUC 방지 스크립트·파일명 규칙.
 * DOM(document) 이 필요 — 브라우저 또는 jsdom 전역을 세운 Node 에서 호출.
 */
import type { Book, BookMeta } from "../book/model";
import { assembleBody } from "../book/assemble";
import { escapeHtml } from "../book/convert";

export interface StandaloneOptions {
  shellCss: string;
  /** 셸 스크립트(+ 덧붙일 애드온). 단일 파일이라 인라인으로 들어간다(이 파일은 확장 페이지가 아님). */
  shellJs: string;
  /** shell.css 의 폰트 자리표시자를 대체할 URL(보통 data:font/woff2;base64,…). 없으면 시스템 폰트. */
  fontUrl?: string;
  /** 자산 경로 → img src(보통 data URI, 또는 "assets/파일" 상대경로). undefined 면 그 그림은 뺀다. */
  assetSrc(path: string): string | undefined;
}

const FONT_PLACEHOLDER = "data:font/woff2;base64,__JETBRAINS_WOFF2_B64__";

/** 저장된 테마·폭·여백·글자크기를 첫 페인트 전에 적용(깜빡임 방지) — assemble.py 와 동일. */
const HEAD_INIT =
  "<script>(function(){try{var k='bookreader:'+(document.documentElement.getAttribute('data-book-key')||location.pathname.split('/').pop()||'book');" +
  "var t=localStorage.getItem(k+':theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);" +
  "var wp=parseInt(localStorage.getItem(k+':widthpx')||'',10);if(wp>=600&&wp<=1200){var rw=document.documentElement;rw.style.setProperty('--wide',wp+'px');rw.style.setProperty('--maxw',(wp-140)+'px');}" +
  "var g=parseInt(localStorage.getItem(k+':gut')||'',10);if(g>=0&&g<=20){var rg=document.documentElement;rg.style.setProperty('--gut-top',g+'vh');rg.style.setProperty('--gut-bottom',g+'vh');}" +
  "var f=localStorage.getItem(k+':fs');if(f)document.documentElement.style.setProperty('--fs',f+'px');}catch(e){}})();</script>";

/** 본문의 data-asset 그림을 실제 src 로 해석(없는 그림은 figure 째 제거 — 깨진 아이콘 방지). */
function resolveAssets(bodyHtml: string, assetSrc: StandaloneOptions["assetSrc"]): string {
  const tpl = document.createElement("template");
  tpl.innerHTML = bodyHtml;
  for (const img of Array.from(tpl.content.querySelectorAll("img[data-asset]"))) {
    const src = assetSrc(img.getAttribute("data-asset") || "");
    if (src) img.setAttribute("src", src);
    else (img.closest("figure") || img).remove();
  }
  return tpl.innerHTML;
}

export function buildStandaloneHtml(book: Book, opts: StandaloneOptions): string {
  const { meta } = book;
  const css = opts.fontUrl ? opts.shellCss.replace(FONT_PLACEHOLDER, opts.fontUrl) : opts.shellCss;
  const body = resolveAssets(assembleBody(book), opts.assetSrc);
  const title = meta.author ? `${meta.title} — ${meta.author}` : meta.title;
  // 셸 스크립트 안의 "</script>" 문자열이 문서를 조기 종료시키지 않게
  const js = opts.shellJs.replace(/<\/script/gi, "<\\/script");
  return (
    `<!doctype html>\n<html lang="${escapeHtml(meta.language || "en")}" data-ten="${escapeHtml(meta.title)}" data-au="${escapeHtml(meta.author)}">\n<head>\n<meta charset="utf-8"/>\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"/>\n<title>${escapeHtml(title)}</title>\n${HEAD_INIT}\n<style>\n${css}\n</style>\n</head>\n<body>\n` +
    `<div class="page">\n${body}\n</div>\n<script>\n${js}\n</script>\n</body>\n</html>\n`
  );
}

/** 사람이 읽는 파일명 — "제목 (저자).html"(Windows 금지문자 제거·150자 상한, assemble.py 와 동일 규칙). */
export function standaloneFileName(meta: BookMeta): string {
  let name = meta.title + (meta.author ? ` (${meta.author})` : "");
  name = name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "book";
  if (name.length > 150) name = name.slice(0, 150).trimEnd();
  return name + ".html";
}
