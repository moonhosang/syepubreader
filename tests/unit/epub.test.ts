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
