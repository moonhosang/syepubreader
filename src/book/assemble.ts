/**
 * 조립기 — Book 을 리더 셸이 읽는 단일 본문 HTML 로.
 * 이식 원본: book/출판사/pipeline/assemble.py (표지·목차 페이지·장 조각 연결).
 * 차이: 그림은 data-asset 참조로 남긴다(실행 시 blob URL·내보내기 시 data URI 로 각각 해석 — 한 조립 결과를 두 용도에 재사용).
 *       각 장 <article> 에 data-src(원본 파일 경로) = EPUB 왕복 내보내기의 소스 앵커.
 */
import DOMPurify from "dompurify";
import type { Book } from "./model";
import { escapeHtml } from "./convert";

/** UI 라벨 언어 — 셸과 같은 규칙(문서 lang 이 ko 면 한국어). */
const isKo = (lang: string) => lang.toLowerCase().startsWith("ko");

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function coverHtml(book: Book, ko: boolean): string {
  if (!book.coverAsset) return "";
  const { title, author } = book.meta;
  return (
    `<section class="book-cover"><img data-asset="${escapeHtml(book.coverAsset)}" alt="${escapeHtml(title)}${ko ? " 표지" : " cover"}"/>` +
    `<div class="bc-title">${escapeHtml(title)}</div><div class="bc-by">${escapeHtml(author)}</div></section>`
  );
}

function tocHtml(book: Book, ko: boolean): string {
  const rows = [`<nav class="book-toc"><h2>${ko ? "목차" : "Contents"}</h2>`];
  for (const ch of book.chapters) {
    const disp = (ch.num ? ch.num + (ko ? "장 " : ". ") : "") + ch.title;
    const secs = [...ch.html.matchAll(/<h2 class="sec-head" id="([^"]+)">([\s\S]*?)<\/h2>/g)];
    if (secs.length) {
      rows.push(`<details class="toc-ch" open><summary><a href="#${ch.id}">${escapeHtml(disp)}</a></summary><ul>`);
      for (const [, sid, inner] of secs) rows.push(`<li><a href="#${sid}">${escapeHtml(stripTags(inner))}</a></li>`);
      rows.push("</ul></details>");
    } else {
      rows.push(`<div class="toc-ch"><a href="#${ch.id}">${escapeHtml(disp)}</a></div>`);
    }
  }
  rows.push("</nav>");
  return rows.join("\n");
}

function chapterHtml(ch: Book["chapters"][number]): string {
  const cover =
    '<header class="chapter-cover">' +
    (ch.num ? `<div class="ch-num">${ch.num}</div>` : "") +
    `<h1 class="ch-title">${escapeHtml(ch.title)}</h1></header>\n`;
  return `<article class="doc" id="${ch.id}" data-src="${escapeHtml(ch.src)}">\n${cover}${ch.html}\n</article>`;
}

/**
 * 정제(심층 방어) — 변환기가 허용 목록 재구성으로 이미 안전하지만, 조립 결과 전체를 한 번 더 DOMPurify 로.
 * data-asset·data-src 는 기본 허용(data-* 속성). 링크는 문서 내 앵커만 쓰므로 href 는 그대로 둔다.
 */
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "form", "input", "button"], ALLOW_DATA_ATTR: true });
}

export function assembleBody(book: Book): string {
  const ko = isKo(book.meta.language);
  const body = [coverHtml(book, ko), tocHtml(book, ko), book.chapters.map(chapterHtml).join('\n<hr class="sep"/>\n')]
    .filter(Boolean)
    .join('\n<hr class="sep"/>\n');
  return sanitize(body);
}
