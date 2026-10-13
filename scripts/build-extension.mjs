/**
 * 크롬 확장 빌드 — extension/ → dist-ext/(압축 해제 설치용 폴더) + 웹스토어 업로드용 zip.
 *  · manifest: 버전 = package.json, 앱 주소 = --app (기본 GitHub Pages), content script 매치 = 그 출처
 *  · 아이콘: icon.svg 를 16/32/48/128 PNG 로 렌더(Playwright 크로미움)
 * 사용: node scripts/build-extension.mjs [--app <앱 URL>] [--out <폴더>] [--no-zip]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import JSZip from "jszip";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "extension");
const DEFAULT_APP = "https://moonhosang.github.io/syepubreader/";

export async function buildExtension({ app = DEFAULT_APP, out = path.join(ROOT, "dist-ext"), zip = true } = {}) {
  const appUrl = new URL(app);
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, "icons"), { recursive: true });

  const manifest = fs
    .readFileSync(path.join(SRC, "manifest.template.json"), "utf8")
    .replace("__VERSION__", version)
    .replace("__APP_MATCH__", `${appUrl.origin}${appUrl.pathname}*`);
  fs.writeFileSync(path.join(out, "manifest.json"), manifest);
  fs.writeFileSync(path.join(out, "background.js"), fs.readFileSync(path.join(SRC, "background.js"), "utf8").replace("__APP_URL__", appUrl.href));
  fs.copyFileSync(path.join(SRC, "content.js"), path.join(out, "content.js"));

  const svg = fs.readFileSync(path.join(SRC, "icon.svg"), "utf8");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(out, "icons", `${size}.png`), omitBackground: true });
  }
  await browser.close();

  let zipPath;
  if (zip) {
    const z = new JSZip();
    const add = (dir, prefix = "") => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) add(full, prefix + e.name + "/");
        else if (!e.name.endsWith(".zip")) z.file(prefix + e.name, fs.readFileSync(full));
      }
    };
    add(out);
    zipPath = path.join(out, `syepubreader-extension-${version}.zip`);
    fs.writeFileSync(zipPath, await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  }
  return { out, zipPath, version, app: appUrl.href };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
  const r = await buildExtension({ app: arg("--app"), out: arg("--out"), zip: !process.argv.includes("--no-zip") });
  console.log(`확장 빌드 완료 v${r.version} → ${r.out}${r.zipPath ? `\n업로드용 zip: ${r.zipPath}` : ""}\n앱 주소: ${r.app}`);
}
