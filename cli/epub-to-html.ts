/**
 * epub-to-html CLI — 앱과 같은 TS 코드(열기·변환·조립·셸)로 EPUB → 독립 실행 HTML.
 * 출판 파이프라인(book/출판사/pipeline/epub_to_html.py)이 이것을 호출한다 = 변환 로직의 단일 정본.
 *
 * 사용: npx tsx cli/epub-to-html.ts <책.epub> <출력폴더> [--addon <애드온.js>] [--assets-dir <폴더>]
 *   --assets-dir 를 주면 그림을 그 폴더에 파일로 쓰고 HTML 은 src="assets/<이름>" 으로 남긴다
 *   (호출 측이 축소·임베드를 맡을 때 — 파이프라인은 Pillow 로 대형 그림을 줄인 뒤 base64 로 박는다).
 *   없으면 그림을 base64 data URI 로 바로 박는다.
 * 출력: stdout 마지막 줄 = JSON {file, title, author, language, chapters, assets}
 *
 * 셸·폰트는 실행할 때마다 정본 파일(src/reader, public/fonts)을 직접 읽는다 → 빌드·동기화 단계 없음.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

/** 확장자가 아니라 실제 바이트로 mime 판정(재인코딩된 그림 대비) — assemble.py 와 동일. */
function sniffMime(b: Uint8Array, fallback: string): string {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return "image/webp";
  if (Buffer.from(b.subarray(0, 256)).toString("latin1").includes("<svg")) return "image/svg+xml";
  return fallback || "application/octet-stream";
}

/** 패키지 경로 → 겹치지 않는 평면 파일명(같은 이름이 다른 폴더에 있어도 구분). */
const flatName = (p: string) => p.replace(/[\\/:*?"<>|]/g, "__");

async function main(): Promise<void> {
  const positional = process.argv.slice(2).filter((a, i, all) => !a.startsWith("--") && !all[i - 1]?.startsWith("--"));
  const [epubPath, outDir] = positional;
  if (!epubPath || !outDir) {
    console.error("사용: tsx cli/epub-to-html.ts <책.epub> <출력폴더> [--addon <js>] [--assets-dir <폴더>]");
    process.exit(2);
  }

  // 앱 코드는 브라우저 DOM(DOMParser·Node·template·DOMPurify 의 window)을 전제 → jsdom 으로 전역을 먼저 세운 뒤 import
  const { window } = new JSDOM("<!doctype html><html><body></body></html>");
  Object.assign(globalThis, { window, document: window.document, DOMParser: window.DOMParser, Node: window.Node });
  const JSZip = (await import("jszip")).default;
  const { openEpub, looksLikeEpub } = await import("../src/open/epub");
  const { buildStandaloneHtml, standaloneFileName } = await import("../src/export/standalone-html");

  const zip = await JSZip.loadAsync(fs.readFileSync(epubPath));
  if (!looksLikeEpub(zip)) throw new Error(`EPUB 이 아닙니다: ${epubPath}`);
  const book = await openEpub(zip, path.basename(epubPath));

  const assetsDir = arg("--assets-dir");
  const srcOf = new Map<string, string>();
  if (assetsDir) fs.mkdirSync(assetsDir, { recursive: true });
  for (const [p, blob] of book.assets) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (assetsDir) {
      const name = flatName(p);
      fs.writeFileSync(path.join(assetsDir, name), bytes);
      srcOf.set(p, `assets/${name}`);
    } else {
      srcOf.set(p, `data:${sniffMime(bytes, blob.type)};base64,${Buffer.from(bytes).toString("base64")}`);
    }
  }

  const addon = arg("--addon");
  const shellJs =
    fs.readFileSync(path.join(ROOT, "src/reader/shell.js"), "utf8") +
    (addon ? `\n\n/* ===== addon: ${path.basename(addon)} ===== */\n` + fs.readFileSync(addon, "utf8") : "");
  const html = buildStandaloneHtml(book, {
    shellCss: fs.readFileSync(path.join(ROOT, "src/reader/shell.css"), "utf8"),
    shellJs,
    fontUrl: "data:font/woff2;base64," + fs.readFileSync(path.join(ROOT, "public/fonts/JetBrains.woff2")).toString("base64"),
    assetSrc: (p) => srcOf.get(p),
  });

  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, standaloneFileName(book.meta));
  fs.writeFileSync(file, html, "utf8");
  console.log(
    JSON.stringify({ file, title: book.meta.title, author: book.meta.author, language: book.meta.language, chapters: book.chapters.length, assets: book.assets.size }),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
