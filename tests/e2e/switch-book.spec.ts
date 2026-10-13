/**
 * 책 바꾸기·보관·닫기 + FAB 희미/선명 회귀.
 * 샘플 위치 = SAMPLE_EPUB_DIR (앞의 두 권 사용). 없으면 건너뜀.
 */
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const dir = process.env.SAMPLE_EPUB_DIR || "";
const files = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".epub")).sort().slice(0, 2) : [];
test.skip(files.length < 2, "SAMPLE_EPUB_DIR 에 .epub 2권 필요");

const bookKey = (page: import("@playwright/test").Page) => page.evaluate(() => document.documentElement.getAttribute("data-book-key"));
const waitReader = (page: import("@playwright/test").Page) => page.waitForSelector(".page article.doc", { timeout: 60_000 });

test("다른 책 열기 → 새로고침 유지 → 닫기", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.setInputFiles("#file", path.join(dir, files[0]));
  await waitReader(page);
  const first = await bookKey(page);

  // 리더 안에서 다른 책 — 설정 패널의 숨은 입력으로
  await expect(page.locator(".controls .app-open")).toHaveCount(1);
  await Promise.all([page.waitForEvent("load"), page.setInputFiles("#reader-file", path.join(dir, files[1]))]);
  await waitReader(page);
  const second = await bookKey(page);
  expect(second).not.toBe(first);

  // 새로고침해도 같은 책
  await page.reload();
  await waitReader(page);
  expect(await bookKey(page)).toBe(second);

  // 닫기 → 첫 화면
  await page.evaluate(() => (document.querySelector(".controls .app-close") as HTMLButtonElement).click());
  await page.waitForSelector("#drop", { state: "visible" });
  expect(await page.locator(".page").count()).toBe(0);
});

test("FAB: 평소 희미 → 탭하면 선명 → 잠시 뒤 다시 희미", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.setInputFiles("#file", path.join(dir, files[0]));
  await waitReader(page);
  const opacity = () => page.evaluate(() => Number(getComputedStyle(document.querySelector(".fab-stack")!).opacity));
  await page.mouse.move(10, 10); // 호버 해제
  await page.waitForTimeout(500);
  expect(await opacity()).toBeLessThan(0.5);
  await page.dispatchEvent(".fab-stack .fab.nav", "pointerdown");
  await page.waitForTimeout(300);
  expect(await opacity()).toBe(1);
  await page.waitForTimeout(3200);
  expect(await opacity()).toBeLessThan(0.5);
});
