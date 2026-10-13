import { describe, expect, it } from "vitest";
import { convertChapter, resolvePath } from "../../src/book/convert";

const opts = { title: "The Beginning", docPath: "OEBPS/text/ch01.xhtml", idPrefix: "ch1" };
const xhtml = (body: string) =>
  `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title><style>p{color:red}</style></head><body>${body}</body></html>`;

describe("resolvePath", () => {
  it("장 문서 기준 상대경로를 패키지 경로로", () => {
    expect(resolvePath("OEBPS/text/ch01.xhtml", "../images/a%20b.png#x")).toBe("OEBPS/images/a b.png");
    expect(resolvePath("OEBPS/content.opf", "text/ch01.xhtml")).toBe("OEBPS/text/ch01.xhtml");
  });
});

describe("convertChapter", () => {
  it("첫머리 장 제목·번호 중복을 버리고 이후 제목은 셸 클래스로", () => {
    const out = convertChapter(xhtml("<h1>Chapter 1</h1><h2>The Beginning</h2><p>Hello</p><h2>Next part</h2><h3>Sub</h3>"), opts);
    expect(out).not.toContain("Chapter 1");
    expect(out).not.toContain(">The Beginning<");
    expect(out).toContain('<h2 class="sec-head" id="ch1-s1">Next part</h2>');
    expect(out).toContain('<h3 class="sub" id="ch1-s2">Sub</h3>'); // 작은 제목도 목차 서랍 앵커
  });

  it("스크립트·스타일·이벤트 핸들러·원서 class 는 들어오지 않는다(허용 목록 재구성)", () => {
    const out = convertChapter(
      xhtml('<p class="x" onclick="alert(1)">Hi <a href="javascript:alert(1)">link</a></p><script>alert(2)</script><iframe src="x"></iframe>'),
      opts,
    );
    expect(out).toBe("<p>Hi link</p>");
  });

  it("그림은 패키지 경로 data-asset 으로, 표는 셸 표로", () => {
    const out = convertChapter(xhtml('<p>a</p><img src="../images/fig1.png" alt="F &amp; G"/><table><tr><td>1</td></tr></table>'), opts);
    expect(out).toContain('<img data-asset="OEBPS/images/fig1.png" alt="F &amp; G"/>');
    expect(out).toContain('<figure class="tablewrap"><table class="data"><tr><td>1</td></tr></table></figure>');
  });

  it("XHTML 자기닫힘 태그가 뒤 내용을 삼키지 않는다", () => {
    const out = convertChapter(xhtml('<p>one<a id="anchor"/> two</p><p>three</p>'), opts);
    expect(out).toContain("<p>one two</p>");
    expect(out).toContain("<p>three</p>");
  });

  it("코드 블록은 내용(공백 포함) 보존", () => {
    const out = convertChapter(xhtml("<p>x</p><pre>if (a &lt; b) {\n  run();\n}</pre>"), opts);
    expect(out).toContain('<pre class="code">if (a &lt; b) {\n  run();\n}</pre>');
  });
});
