/**
 * 보안 회귀(샘플 불필요 — 합성 악성 EPUB):
 *  ① 목차 제목에 심은 HTML 이 셸 목차 서랍에서 요소로 살아나지 않는다(텍스트로만 표시)
 *  ② 본문의 script·on* 핸들러·javascript: 링크가 실행되지 않는다
 *  ③ 배포판에 CSP 가 걸려 있다(확장 MV3 와 같은 script-src 'self')
 */
import { expect, test } from "@playwright/test";
import JSZip from "jszip";

const PAYLOAD = `<img src=x onerror="window.__xss='toc'">`;

async function maliciousEpub(): Promise<Buffer> {
  const z = new JSZip();
  const lorem = "Lorem ipsum dolor sit amet. ".repeat(20);
  const page = (b: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>${b}</body></html>`;
  z.file("mimetype", "application/epub+zip");
  z.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>`);
  z.file("c.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Evil</dc:title><dc:language>en</dc:language></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`);
  // 목차 제목에 이스케이프된 HTML — 변환기는 텍스트로 보존, 셸이 다시 HTML 로 해석하면 실행됨
  z.file("nav.xhtml", page(`<nav><ol><li><a href="c1.xhtml">1. ${PAYLOAD.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}</a></li></ol></nav>`));
  z.file("c1.xhtml", page(`<p onclick="window.__xss='onclick'">${lorem}</p><script>window.__xss='script'</script><p><a href="javascript:window.__xss='href'">x</a></p>`));
  return Buffer.from(await z.generateAsync({ type: "uint8array" }));
}

test("악성 EPUB: 목차 HTML 주입·본문 스크립트 실행 없음 + 배포 CSP", async ({ page }) => {
  await page.goto("/");
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("script-src 'self'");

  await page.setInputFiles("#file", { name: "evil.epub", mimeType: "application/epub+zip", buffer: await maliciousEpub() });
  await page.waitForSelector(".page article.doc");
  await page.waitForSelector(".drawer .tc-title", { state: "attached" });
  await page.click(".page p"); // onclick 이 살아 있다면 여기서 실행
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => ({
    xss: (window as unknown as { __xss?: string }).__xss ?? null,
    imgInToc: document.querySelectorAll(".drawer .tc-title img").length,
    tocText: document.querySelector(".drawer .tc-title")?.textContent || "",
    scripts: document.querySelectorAll(".page script").length,
    jsLinks: document.querySelectorAll('.page a[href^="javascript:"]').length,
  }));
  expect(r.xss).toBeNull();
  expect(r.imgInToc).toBe(0);
  expect(r.tocText).toContain("<img"); // 주입 시도는 글자로만 보인다
  expect(r.scripts).toBe(0);
  expect(r.jsLinks).toBe(0);
});
