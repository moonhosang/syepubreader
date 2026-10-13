import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { looksLikeEpub, openEpub } from "../../src/open/epub";
import { assembleBody } from "../../src/book/assemble";

const lorem = "Lorem ipsum dolor sit amet. ".repeat(20);
const page = (body: string) => `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><body>${body}</body></html>`;

/** 최소 EPUB3 — 상위 폴더로 한 번 감싼 zip(압축 푼 EPUB 을 다시 묶은 경우)도 만든다. */
async function makeEpub(wrap = ""): Promise<JSZip> {
  const z = new JSZip();
  z.file(wrap + "mimetype", "application/epub+zip");
  z.file(wrap + "META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  z.file(wrap + "OEBPS/content.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Book</dc:title><dc:creator>Jane Doe</dc:creator><dc:language>en-US</dc:language></metadata>
<manifest>
 <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
 <item id="cov" href="text/cover.xhtml" media-type="application/xhtml+xml"/>
 <item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
 <item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>
 <item id="img" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>
 <item id="fig" href="images/fig.png" media-type="image/png"/>
</manifest>
<spine><itemref idref="cov"/><itemref idref="c1"/><itemref idref="c2"/></spine></package>`);
  z.file(wrap + "OEBPS/nav.xhtml", page(`<nav><ol><li><a href="text/cover.xhtml">Cover</a></li><li><a href="text/c1.xhtml">1. First Steps</a></li><li><a href="text/c2.xhtml#top">2. Going Further</a></li></ol></nav>`));
  z.file(wrap + "OEBPS/text/cover.xhtml", page(`<img src="../images/cover.jpg"/>`));
  z.file(wrap + "OEBPS/text/c1.xhtml", page(`<h1>First Steps</h1><p>${lorem}</p><img src="../images/fig.png" alt="fig"/>`));
  z.file(wrap + "OEBPS/text/c2.xhtml", page(`<h1>2</h1><p>${lorem}</p><h2>Deeper</h2><p>${lorem}</p>`));
  z.file(wrap + "OEBPS/images/cover.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
  z.file(wrap + "OEBPS/images/fig.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  return JSZip.loadAsync(await z.generateAsync({ type: "uint8array" }));
}

/** 표지 단서가 메타데이터·파일명에 없는 EPUB2 + 짧은 각주 문서 + 작은 제목. */
async function makeBareEpub(withGuide: boolean): Promise<JSZip> {
  const z = new JSZip();
  z.file("META-INF/container.xml", `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>`);
  z.file("c.opf", `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Bare</dc:title></metadata>
<manifest>
 <item id="p0" href="p0.html" media-type="application/xhtml+xml"/>
 <item id="p1" href="p1.html" media-type="application/xhtml+xml"/>
 <item id="fn" href="p2.html" media-type="application/xhtml+xml"/>
 <item id="i1" href="image-2DAIF.png" media-type="image/png"/>
</manifest>
<spine><itemref idref="p0"/><itemref idref="p1"/><itemref idref="fn"/></spine>
${withGuide ? '<guide><reference type="cover" href="p0.html"/></guide>' : ""}</package>`);
  z.file("p0.html", page(`<div><img src="image-2DAIF.png"/></div>`));
  z.file("p1.html", page(`<p>${lorem}</p><h3>Small heading</h3><p>${lorem}</p>`));
  z.file("p2.html", page(`<p>[←3] A short footnote kept as content.</p>`));
  z.file("image-2DAIF.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  return JSZip.loadAsync(await z.generateAsync({ type: "uint8array" }));
}

describe("openEpub — 단서 없는 책", () => {
  it("짧은 각주 문서를 버리지 않는다(빈 페이지 = 글자 20자 미만 + 그림 없음만)", async () => {
    const book = await openEpub(await makeBareEpub(false), "bare.epub");
    expect(book.chapters.some((c) => c.html.includes("A short footnote kept as content."))).toBe(true);
  });

  it("작은 제목(sub)에도 id — 목차 서랍 이동 앵커", async () => {
    const book = await openEpub(await makeBareEpub(false), "bare.epub");
    expect(book.chapters.map((c) => c.html).join("")).toMatch(/<h3 class="sub" id="ch\d+-s1">Small heading<\/h3>/);
  });

  it.each([true, false])("표지 마지막 방법(guide=%s) — guide 참조 또는 첫 페이지의 그림 1장", async (withGuide) => {
    const book = await openEpub(await makeBareEpub(withGuide), "bare.epub");
    expect(book.coverAsset).toBe("image-2DAIF.png");
  });
});

describe("openEpub", () => {
  it("메타·장·번호·소스 앵커·자산·표지를 해석", async () => {
    const book = await openEpub(await makeEpub(), "x.epub");
    expect(book.meta).toMatchObject({ title: "Test Book", author: "Jane Doe", language: "en" });
    expect(book.chapters.map((c) => [c.title, c.num, c.src])).toEqual([
      ["First Steps", "1", "OEBPS/text/c1.xhtml"],
      ["Going Further", "2", "OEBPS/text/c2.xhtml"],
    ]);
    expect(book.coverAsset).toBe("OEBPS/images/cover.jpg");
    expect([...book.assets.keys()].sort()).toEqual(["OEBPS/images/cover.jpg", "OEBPS/images/fig.png"]);
    expect(book.assets.get("OEBPS/images/fig.png")!.type).toBe("image/png");
  });

  it("상위 폴더로 감싼 zip 도 내용으로 EPUB 판별", async () => {
    const zip = await makeEpub("my-book/");
    expect(looksLikeEpub(zip)).toBe(true);
    const book = await openEpub(zip, "x.zip");
    expect(book.chapters).toHaveLength(2);
  });

  it("조립 결과: 장마다 data-src 앵커 + 목차의 절 링크", async () => {
    const html = assembleBody(await openEpub(await makeEpub(), "x.epub"));
    expect(html).toContain('<article class="doc" id="ch1" data-src="OEBPS/text/c1.xhtml">');
    expect(html).toContain('data-src="OEBPS/text/c2.xhtml"');
    expect(html).toContain('<a href="#ch2-s1">Deeper</a>');
    expect(html).toContain('class="book-cover"');
    expect(html).toContain("<h2>Contents</h2>");
  });
});
