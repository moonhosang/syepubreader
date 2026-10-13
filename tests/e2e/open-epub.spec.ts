/**
 * 실 EPUB 회귀 — 샘플 폴더의 책들을 실제 브라우저로 열어:
 *  ① 열림(장 수 ≥1·셸 UI 생성·콘솔 오류 0) ② 모든 장에 data-src 소스 앵커 ③ 책 모드 전 쪽에서 왼쪽 경계 글자 잘림 0.
 * 샘플 위치 = 환경변수 SAMPLE_EPUB_DIR (저작권 책이라 저장소에 넣지 않는다). 없으면 건너뜀.
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const dir = process.env.SAMPLE_EPUB_DIR || "";
const limit = Number(process.env.SAMPLE_LIMIT || 10);
const files = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".epub")).sort().slice(0, limit) : [];

test.skip(!files.length, "SAMPLE_EPUB_DIR 에 .epub 가 없음");

for (const f of files) {
  test(`열기: ${f}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto("/");
    await page.setInputFiles("#file", path.join(dir, f));
    await page.waitForSelector(".page article.doc", { timeout: 60_000 });
    await page.waitForSelector(".controls", { state: "attached" }); // 셸이 실행돼 설정 패널을 만듦

    const info = await page.evaluate(() => ({
      chapters: document.querySelectorAll(".page article.doc").length,
      anchored: document.querySelectorAll(".page article.doc[data-src]").length,
      brokenImgs: Array.from(document.querySelectorAll<HTMLImageElement>(".page img")).filter((i) => !i.src).length,
    }));
    expect(info.chapters).toBeGreaterThan(0);
    expect(info.anchored).toBe(info.chapters);
    expect(info.brokenImgs).toBe(0);

    // 책 모드 전 쪽 순회 — 왼쪽 경계에 걸친(잘린) 글 상자 0
    const cut = await page.evaluate(async () => {
      const r = document.documentElement;
      r.classList.remove("paged");
      r.classList.add("spread");
      await new Promise((res) => setTimeout(res, 200));
      const p = document.querySelector<HTMLElement>(".page")!;
      p.style.scrollBehavior = "auto";
      const pitch = p.getBoundingClientRect().width + parseFloat(getComputedStyle(p).columnGap);
      const total = Math.round(p.scrollWidth / pitch);
      const blocks = Array.from(p.querySelectorAll("p,h1,h2,h3,li,pre"));
      let n = 0;
      for (let i = 0; i < total; i += Math.max(1, Math.floor(total / 40))) {
        p.scrollLeft = i * pitch;
        await new Promise(requestAnimationFrame);
        const L = p.getBoundingClientRect().left;
        for (const b of blocks) for (const cr of Array.from(b.getClientRects())) if (cr.width >= 2 && cr.left < L - 0.75 && cr.right > L + 0.75) n++;
      }
      return n;
    });
    expect(cut).toBe(0);
    expect(errors).toEqual([]);
  });
}
