/**
 * 리더 화면의 앱 동작 — 셸 설정 패널에 [다른 책 열기]·[책 닫기]를 덧붙이고, 화면 어디에 파일을 끌어다 놓아도 책을 바꾼다.
 * 셸은 앱을 모른다(무상태 셸 계약) → 앱 기능은 셸이 만든 DOM(.controls)에 바깥에서 덧붙인다(pipeline 의 epub-html-addon 과 같은 방식).
 */
export interface ReaderActions {
  /** 책 언어 — 라벨 언어(영어책 화면의 한국어 라벨은 크롬 번역이 다시 번역해 깨뜨림). */
  lang: string;
  onOpen(file: File): void;
  onClose(): void;
}

export function addReaderActions({ lang, onOpen, onClose }: ReaderActions): void {
  const ko = lang.toLowerCase().startsWith("ko");
  const L = (k: string, e: string) => (ko ? k : e);
  const panel = document.querySelector(".controls");
  if (!panel) return;

  const input = document.createElement("input");
  input.type = "file";
  input.id = "reader-file";
  input.accept = ".epub,application/epub+zip";
  input.hidden = true;
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) onOpen(f);
  });

  const openBtn = document.createElement("button");
  openBtn.className = "ctl-full app-open";
  openBtn.textContent = L("📂 다른 책 열기", "📂 Open another book");
  openBtn.addEventListener("click", () => input.click());

  const closeBtn = document.createElement("button");
  closeBtn.className = "ctl-full app-close";
  closeBtn.textContent = L("✕ 책 닫기 (첫 화면)", "✕ Close book (home)");
  closeBtn.addEventListener("click", onClose);

  panel.append(openBtn, closeBtn, input);

  // 화면 어디에든 파일을 끌어다 놓으면 그 책으로 교체
  document.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
  });
  document.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    e.preventDefault();
    onOpen(f);
  });
}
