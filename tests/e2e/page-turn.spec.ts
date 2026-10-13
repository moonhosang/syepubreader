/**
 * 쪽 넘김 회귀(방향 있는 페이드) — 합성 EPUB(샘플 불필요):
 *  ① 넘김 중 두 쪽이 겹쳐 보이지 않음: 사라지는 단계에서 이동(투명도↓·진행 반대편으로 밀림) → 쪽 경계로 즉시 점프
 *  ② 빠른 연타 N회 = 정확히 N쪽, 끝나면 투명도 1·변형 없음
 *  ③ 끄는 동안 글 띠(scrollLeft)는 움직이지 않고 지금 쪽만 밀리며 흐려짐, 놓으면 정확히 한 쪽
 */
import { expect, test } from "@playwright/test";
import JSZip from "jszip";

async function longEpub(): Promise<Buffer> {
  const z = new JSZip();
  const para = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(12);
  const page = (b: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>${b}</body></html>`;
  z.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>`);
  const items = Array.from({ length: 6 }, (_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`).join("");
  const refs = Array.from({ length: 6 }, (_, i) => `<itemref idref="c${i}"/>`).join("");
  z.file("c.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Turn</dc:title><dc:language>en</dc:language></metadata><manifest>${items}</manifest><spine>${refs}</spine></package>`);
  for (let i = 0; i < 6; i++) z.file(`c${i}.xhtml`, page(`<h1>Chapter ${i + 1}</h1>` + `<p>${para}</p>`.repeat(14)));
  return Buffer.from(await z.generateAsync({ type: "uint8array" }));
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.setInputFiles("#file", { name: "turn.epub", mimeType: "application/epub+zip", buffer: await longEpub() });
  await page.waitForSelector(".page article.doc");
  await page.evaluate(() => {
    const r = document.documentElement;
    r.classList.remove("paged");
    r.classList.add("spread");
  });
  await page.waitForTimeout(200);
});

const state = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const p = document.querySelector<HTMLElement>(".page")!;
    const P = p.getBoundingClientRect().width + parseFloat(getComputedStyle(p).columnGap);
    const cs = getComputedStyle(p);
    return { page: +(p.scrollLeft / P).toFixed(3), opacity: +cs.opacity, transform: cs.transform };
  });

test("연타 5회 = 정확히 5쪽, 끝나면 원상태", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(900);
  expect(await state(page)).toEqual({ page: 5, opacity: 1, transform: "none" });
});

test("넘김 중간: 사라지는 동안엔 아직 이전 쪽(겹침 없음) → 이후 목표 쪽으로 점프", async ({ page }) => {
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(60); // 사라지는 단계(110ms) 중
  const mid = await state(page);
  expect(mid.page).toBe(0); // 글 띠는 아직 그대로 — 두 쪽이 반쯤 걸린 상태가 없음
  expect(mid.opacity).toBeLessThan(1);
  expect(mid.transform).toMatch(/matrix\(1, 0, 0, 1, -\d/); // 다음 쪽 = 왼쪽으로 밀리며 사라짐
  await page.waitForTimeout(500);
  expect(await state(page)).toEqual({ page: 1, opacity: 1, transform: "none" });
});

test("끌기: 글 띠는 고정·지금 쪽만 밀리며 흐려짐 → 놓으면 한 쪽", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 900, y: 400 }] });
  for (let x = 860; x >= 640; x -= 40) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 400 }] });
  const dragging = await state(page);
  expect(dragging.page).toBe(0);
  expect(dragging.opacity).toBeLessThan(1);
  expect(dragging.transform).toMatch(/matrix\(1, 0, 0, 1, -\d/);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(700);
  expect(await state(page)).toEqual({ page: 1, opacity: 1, transform: "none" });
});
