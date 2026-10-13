/** 앱 첫 화면 — 파일 고르기/끌어다 놓기 → 열기 → 리더. 1단계는 한 번에 한 권(다른 책 = 새로고침). */
import { openFile } from "../open";
import { mountReader } from "../reader/mount";

const drop = document.getElementById("drop") as HTMLElement;
const input = document.getElementById("file") as HTMLInputElement;
const status = document.getElementById("status") as HTMLElement;

async function open(file: File | undefined): Promise<void> {
  if (!file) return;
  status.textContent = `여는 중… ${file.name}`;
  status.classList.remove("err");
  try {
    const book = await openFile(file);
    mountReader(book);
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : String(e);
    status.classList.add("err");
    console.error(e);
  }
}

input.addEventListener("change", () => void open(input.files?.[0]));
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
  void open(e.dataTransfer?.files?.[0]);
});
