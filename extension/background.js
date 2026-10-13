/**
 * syepubreader 확장 — 얇은 진입로(본체는 웹앱).
 *  · 툴바 아이콘 → 앱 탭 열기
 *  · .epub 링크 우클릭 「Open in syepubreader」 → 파일을 받아 앱 탭에 넘김
 * 권한 최소화: 같은 사이트 링크는 activeTab(누른 순간만 유효), 다른 사이트는 누른 시점에 그 출처만 요청.
 * 파일은 확장 → (앱 탭의) content.js → window.postMessage → 앱. 어디로도 업로드하지 않는다.
 */
const APP_URL = "__APP_URL__";
const CHUNK = 4 * 1024 * 1024; // 메시지 1건 크기 상한 대비 분할(base64 문자열)
const pending = new Map(); // tabId → { name, chunks }

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-epub-link",
    title: "Open in syepubreader",
    contexts: ["link"],
    targetUrlPatterns: ["*://*/*.epub", "*://*/*.epub?*", "*://*/*.EPUB"],
  });
});

chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: APP_URL }));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "open-epub-link" || !info.linkUrl) return;
  const origin = new URL(info.linkUrl).origin;
  const sameSite = tab && tab.url && new URL(tab.url).origin === origin; // activeTab 이 이미 허용
  // 권한 요청은 사용자 동작(클릭) 직후 동기적으로 — await 뒤에선 거부된다
  const granted = sameSite ? Promise.resolve(true) : chrome.permissions.request({ origins: [origin + "/*"] });
  granted.then((ok) => (ok ? openInReader(info.linkUrl) : undefined)).catch((e) => console.error(e));
});

function fileNameOf(url, res) {
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m) return decodeURIComponent(m[1]);
  const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "book.epub");
  return /\.epub$/i.test(last) ? last : last + ".epub";
}

function toBase64Chunks(bytes) {
  const out = [];
  for (let off = 0; off < bytes.length; off += CHUNK) {
    const part = bytes.subarray(off, off + CHUNK);
    let bin = "";
    for (let i = 0; i < part.length; i += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(i, i + 0x8000));
    out.push(btoa(bin));
  }
  return out.length ? out : [""];
}

/** 링크의 EPUB 을 받아 새 앱 탭에 넘긴다(테스트에서도 직접 호출). */
async function openInReader(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EPUB 을 받지 못했습니다: ${res.status} ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const tab = await chrome.tabs.create({ url: APP_URL });
  pending.set(tab.id, { name: fileNameOf(url, res), chunks: toBase64Chunks(bytes) });
}
globalThis.openInReader = openInReader;

// 앱 탭의 content.js 가 준비되면 대기 중인 파일을 조각으로 보낸다
chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender.tab && sender.tab.id;
  if (msg && msg.type === "ready" && pending.has(tabId)) {
    const { name, chunks } = pending.get(tabId);
    pending.delete(tabId);
    chunks.forEach((data, i) => chrome.tabs.sendMessage(tabId, { type: "chunk", name, i, n: chunks.length, data }));
  }
});
chrome.tabs.onRemoved.addListener((tabId) => pending.delete(tabId));
