/**
 * 크롬 확장 → 앱 파일 전달 수신부.
 * 확장의 content.js 가 같은 창에 postMessage({source:"syepubreader-ext", type:"open-file", name, buffer}) 를 보낸다.
 * 검증: 같은 창(e.source === window)·같은 출처·정해진 source/type·타입 확인 — 다른 프레임·다른 출처의 메시지는 무시.
 */
export function listenForExtensionFiles(onFile: (file: File) => void): void {
  window.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const d = e.data as { source?: unknown; type?: unknown; name?: unknown; buffer?: unknown } | null;
    if (!d || d.source !== "syepubreader-ext" || d.type !== "open-file") return;
    if (typeof d.name !== "string" || !(d.buffer instanceof ArrayBuffer)) return;
    onFile(new File([d.buffer], d.name, { type: "application/epub+zip" }));
  });
}
