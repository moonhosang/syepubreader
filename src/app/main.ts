/**
 * 앱 진입 — 첫 화면(파일 고르기/끌어다 놓기) ↔ 리더.
 * 지금 읽는 책은 기기 안(IndexedDB)에 보관 → 새로고침·재방문 시 그 책을 다시 연다(읽던 위치는 셸이 기억).
 * 책 바꾸기/닫기 = 보관 교체 후 다시 불러오기: 셸이 정리(unmount) 수단이 없는 자기 실행형이라 가장 확실한 초기화.
 */
import { openFile } from "../open";
import { mountReader } from "../reader/mount";
import { clearCurrent, loadCurrent, saveCurrent } from "./book-store";
import { addReaderActions } from "./reader-actions";

const root = document.documentElement;
const drop = document.getElementById("drop") as HTMLElement;
const input = document.getElementById("file") as HTMLInputElement;
const status = document.getElementById("status") as HTMLElement;

function showStatus(msg: string, error = false): void {
  status.textContent = msg;
  status.classList.toggle("err", error);
}

async function read(file: File): Promise<void> {
  const book = await openFile(file);
  mountReader(book);
  addReaderActions({ lang: book.meta.language, onOpen: switchTo, onClose: closeBook });
}

/** 첫 화면에서 연 책 — 열리면 보관. */
async function openFromHome(file: File | undefined): Promise<void> {
  if (!file) return;
  showStatus(`여는 중… ${file.name}`);
  try {
    await read(file);
    await saveCurrent(file);
  } catch (e) {
    showStatus(e instanceof Error ? e.message : String(e), true);
    console.error(e);
  }
}

/** 리더에서 다른 책으로 — 먼저 열리는지 확인한 뒤에만 교체(깨진 파일로 지금 책을 잃지 않게). */
async function switchTo(file: File): Promise<void> {
  try {
    await openFile(file);
  } catch (e) {
    alert(e instanceof Error ? e.message : String(e));
    return;
  }
  await saveCurrent(file);
  location.reload();
}

async function closeBook(): Promise<void> {
  await clearCurrent();
  location.reload();
}

input.addEventListener("change", () => void openFromHome(input.files?.[0]));
drop.addEventListener("click", () => input.click());
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    input.click();
  }
});
for (const ev of ["dragenter", "dragover"] as const) {
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add("over");
  });
}
for (const ev of ["dragleave", "drop"] as const) {
  drop.addEventListener(ev, () => drop.classList.remove("over"));
}
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  void openFromHome(e.dataTransfer?.files?.[0]);
});

// 시작: 보관된 책이 있으면 바로 리더로(첫 화면은 확인 끝날 때까지 숨김 — index.html 의 .booting)
(async () => {
  const current = await loadCurrent();
  if (current) {
    try {
      await read(current);
    } catch (e) {
      await clearCurrent(); // 열 수 없게 된 보관본은 버리고 첫 화면으로
      showStatus(`이전에 읽던 책을 열 수 없습니다: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  }
  root.classList.remove("booting");
})();
