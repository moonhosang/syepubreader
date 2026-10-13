/**
 * 앱 페이지(syepubreader)에만 주입 — 확장이 받은 파일 조각을 모아 같은 창의 앱에 postMessage 로 넘긴다.
 * 앱은 src/app/extension-bridge.ts 에서 source/type/출처를 검증하고 연다.
 */
(() => {
  const parts = [];
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || msg.type !== "chunk") return;
    parts[msg.i] = msg.data;
    if (parts.filter((p) => p !== undefined).length !== msg.n) return;
    const bin = atob(parts.join(""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    window.postMessage({ source: "syepubreader-ext", type: "open-file", name: msg.name, buffer: bytes.buffer }, location.origin, [bytes.buffer]);
  });
  chrome.runtime.sendMessage({ type: "ready" });
})();
