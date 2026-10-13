/**
 * 코드 블록 회귀(합성 EPUB — 120줄, 일부 아주 긴 줄):
 *  책 모드: ① 상자 안 스크롤 없음 ② 쪽(단)을 넘어 여러 조각으로 이어짐 ③ 긴 줄은 접힘(내어쓰기 + ↪ 무늬) ④ 쪽 경계에 걸려 잘린 줄 0
 *  공통: ⑤ 줄 단위 요소 = 원문 줄 수, 줄 텍스트를 이으면 원문과 동일(복사 정확성)
 *  연속 모드: ⑥ 줄바꿈 없이 가로 스크롤
 */
import { expect, test } from "@playwright/test";
import JSZip from "jszip";

// 0번 줄은 비우지 않는다 — HTML 규칙상 <pre> 맨 앞 줄바꿈 하나는 해석 때마다 버려진다(맨 앞 빈 줄 = 의미 없음).
// 중간 빈 줄·연속 빈 줄(36·37)은 그대로 보존돼야 한다.
const LINES = Array.from({ length: 120 }, (_, i) =>
  i % 17 === 5 ? `    const veryLongLine${i} = "${"x".repeat(220)}"; // ${i}` : i > 0 && (i % 9 === 0 || i === 37) ? "" : `    line_${i}(arg${i}, other${i});`,
);

async function codeEpub(): Promise<Buffer> {
  const z = new JSZip();
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const page = (b: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>${b}</body></html>`;
  z.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>`);
  z.file("c.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Code</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`);
  z.file("c1.xhtml", page(`<h1>Code</h1><p>${"Intro text. ".repeat(30)}</p><pre>${esc(LINES.join("\n"))}</pre><p>After.</p>`));
  return Buffer.from(await z.generateAsync({ type: "uint8array" }));
}

test("코드 블록: 책 모드는 쪽을 넘어 이어짐(스크롤·잘림 없음), 연속 모드는 가로 스크롤", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.setInputFiles("#file", { name: "code.epub", mimeType: "application/epub+zip", buffer: await codeEpub() });
  await page.waitForSelector(".page pre.code .ln");

  const src = LINES.join("\n");
  const lineInfo = await page.evaluate(() => {
    const pre = document.querySelector("pre.code")!;
    const lns = Array.from(pre.querySelectorAll(":scope > .ln"));
    return { count: lns.length, joined: lns.map((l) => l.textContent).join("\n") };
  });
  expect(lineInfo.count).toBe(LINES.length);
  expect(lineInfo.joined).toBe(src);

  const spread = await page.evaluate(async () => {
    const r = document.documentElement;
    r.classList.remove("paged");
    r.classList.add("spread");
    await new Promise((res) => setTimeout(res, 300));
    const pre = document.querySelector<HTMLElement>("pre.code")!;
    const cs = getComputedStyle(pre);
    const lineH = parseFloat(getComputedStyle(pre.querySelector(".ln")!).lineHeight);
    const wrapped = Array.from(pre.querySelectorAll(".ln")).filter((l) => l.getBoundingClientRect().height > lineH * 1.5).length;
    const bg = getComputedStyle(pre.querySelector(".ln")!).backgroundImage;
    // 쪽마다 왼쪽·오른쪽 경계에 걸린(잘린) 줄 상자 검사
    const p = document.querySelector<HTMLElement>(".page")!;
    p.style.scrollBehavior = "auto";
    const pitch = p.getBoundingClientRect().width + parseFloat(getComputedStyle(p).columnGap);
    const total = Math.round(p.scrollWidth / pitch);
    let cut = 0;
    for (let i = 0; i < total; i++) {
      p.scrollLeft = i * pitch;
      await new Promise(requestAnimationFrame);
      const L = p.getBoundingClientRect().left;
      const R = L + p.getBoundingClientRect().width;
      for (const ln of Array.from(pre.querySelectorAll(".ln")))
        for (const cr of Array.from(ln.getClientRects())) if (cr.width > 2 && ((cr.left < L - 0.75 && cr.right > L + 0.75) || (cr.left < R - 0.75 && cr.right > R + 0.75))) cut++;
    }
    return { overflow: cs.overflowY, maxHeight: cs.maxHeight, fragments: pre.getClientRects().length, wrapped, hasArrow: bg.includes("svg"), cut };
  });
  expect(spread.overflow).toBe("visible");
  expect(spread.maxHeight).toBe("none");
  expect(spread.fragments).toBeGreaterThan(1);
  expect(spread.wrapped).toBeGreaterThan(0);
  expect(spread.hasArrow).toBe(true);
  expect(spread.cut).toBe(0);

  const flow = await page.evaluate(async () => {
    const r = document.documentElement;
    r.classList.remove("paged", "spread");
    await new Promise((res) => setTimeout(res, 300));
    const pre = document.querySelector<HTMLElement>("pre.code")!;
    return { ws: getComputedStyle(pre).whiteSpace, scrolls: pre.scrollWidth > pre.clientWidth + 10 };
  });
  expect(flow.ws).toBe("pre");
  expect(flow.scrolls).toBe(true);
});
