/**
 * 크롬 확장 회귀 — 실제로 확장을 설치한 크로미움에서:
 *  다른 사이트(임의 포트의 localhost)의 EPUB 을 확장이 받아 → 앱 탭(배포판 localhost:5199)을 열고 → content.js → 앱이 연다.
 * (우클릭 메뉴는 자동화가 못 누르므로 메뉴가 부르는 openInReader 를 서비스 워커에서 직접 호출)
 */
import { chromium, expect, test } from "@playwright/test";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import JSZip from "jszip";
// @ts-expect-error — 빌드 스크립트는 .mjs(타입 없음)
import { buildExtension } from "../../scripts/build-extension.mjs";

async function sampleEpub(): Promise<Buffer> {
  const z = new JSZip();
  const lorem = "Lorem ipsum dolor sit amet. ".repeat(20);
  const page = (b: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>${b}</body></html>`;
  z.file("mimetype", "application/epub+zip");
  z.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>`);
  z.file("c.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Ext Test Book</dc:title><dc:language>en</dc:language></metadata>
<manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`);
  z.file("c1.xhtml", page(`<h1>Hello</h1><p>${lorem}</p>`));
  return Buffer.from(await z.generateAsync({ type: "uint8array" }));
}

test("확장: 다른 사이트 EPUB → 앱 탭에서 열림", async () => {
  const extDir = fs.mkdtempSync(path.join(os.tmpdir(), "syext-"));
  await buildExtension({ app: "http://localhost:5199/", out: extDir, zip: false });

  const epub = await sampleEpub();
  const srv = http.createServer((_q, r) => {
    r.setHeader("access-control-allow-origin", "*");
    r.setHeader("content-type", "application/epub+zip");
    r.end(epub);
  });
  await new Promise<void>((res) => srv.listen(0, res)); // 빈 포트 자동 선택(다른 프로그램과 충돌 방지)
  const port = (srv.address() as import("node:net").AddressInfo).port;

  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
  });
  try {
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
    const appPage = ctx.waitForEvent("page", (p) => p.url().startsWith("http://localhost:5199/"));
    await sw.evaluate((u) => (globalThis as unknown as { openInReader(u: string): Promise<void> }).openInReader(u), `http://localhost:${port}/books/Ext%20Test.epub`);
    const page = await appPage;
    await page.waitForSelector(".page article.doc", { timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-ten"))).toBe("Ext Test Book");
  } finally {
    await ctx.close();
    srv.close();
    fs.rmSync(extDir, { recursive: true, force: true });
  }
});
