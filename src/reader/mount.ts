/**
 * 리더 마운트 — 조립된 본문을 문서에 꽂고 리더 셸(shell.css/shell.js)을 실행한다.
 * 셸은 "문서에 .page 가 있으면 그것을 책으로 꾸민다"는 계약만 아는 무상태 스크립트라(DOM 에서 목차·네비 자동 구성),
 * 파일로 저장된 책(pipeline 산출물)과 이 앱에서 연 책이 같은 셸을 그대로 공유한다.
 */
import shellCss from "./shell.css?raw";
import shellJs from "./shell.js?raw";
import type { Book } from "../book/model";
import { assembleBody } from "../book/assemble";

const FONT_PLACEHOLDER = "data:font/woff2;base64,__JETBRAINS_WOFF2_B64__";

export function mountReader(book: Book): void {
  const root = document.documentElement;
  root.setAttribute("lang", book.meta.language || "en");
  root.setAttribute("data-ten", book.meta.title);
  root.setAttribute("data-au", book.meta.author);
  root.setAttribute("data-book-key", book.key); // 셸이 책별 읽기 위치·설정 저장 키로 사용
  document.title = book.meta.author ? `${book.meta.title} — ${book.meta.author}` : book.meta.title;

  document.getElementById("app-style")?.remove();
  const style = document.createElement("style");
  style.textContent = shellCss.replace(FONT_PLACEHOLDER, `${import.meta.env.BASE_URL}fonts/JetBrains.woff2`);
  document.head.appendChild(style);

  const page = document.createElement("div");
  page.className = "page";
  page.innerHTML = assembleBody(book);
  for (const img of Array.from(page.querySelectorAll<HTMLImageElement>("img[data-asset]"))) {
    const blob = book.assets.get(img.getAttribute("data-asset") || "");
    if (blob) img.src = URL.createObjectURL(blob);
    else img.closest("figure")?.remove(); // 패키지에 없는 그림 = 깨진 아이콘 대신 제거
  }
  document.body.replaceChildren(page);

  // 셸은 자기 실행형 스크립트 — 본문이 꽂힌 뒤 실행해야 .page 를 찾는다.
  const script = document.createElement("script");
  script.textContent = shellJs;
  document.body.appendChild(script);
}
