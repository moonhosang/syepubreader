/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";

/**
 * 배포 CSP — 크롬 확장(MV3) 확장 페이지 기본 정책(script-src 'self')과 같은 수준을 웹앱에도 강제.
 * → 인라인 스크립트·eval·원격 스크립트가 들어오면 배포판(=e2e 대상)에서 바로 깨져 회귀로 잡힌다.
 *   책 내용 정제(DOMPurify)를 뚫는 XSS 가 생겨도 스크립트 실행 자체를 막는 마지막 방어선.
 * 개발 서버(HMR 인라인 스크립트·웹소켓)에는 넣지 않는다.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // 셸이 style 요소·style 속성(폭·여백 변수)을 실행 중에 설정
  "img-src 'self' blob: data:", // 책 그림 = blob URL
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

function cspForBuild(): Plugin {
  return {
    name: "csp-for-build",
    apply: "build",
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

export default defineConfig({
  // GitHub Pages(하위 경로 배포)에서도 자산 경로가 맞도록 상대 base
  base: "./",
  plugins: [cspForBuild()],
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
  },
});
