import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  use: { baseURL: "http://localhost:5199/" },
  // 개발 서버가 아니라 배포 결과물(dist, CSP 포함)을 대상으로 — 배포·확장 환경에서만 드러나는 위반을 잡기 위해
  webServer: {
    command: "npm run build && npx vite preview --port 5199 --strictPort",
    url: "http://localhost:5199/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
