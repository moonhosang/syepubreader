/// <reference types="vitest/config" />
import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages(하위 경로 배포)에서도 자산 경로가 맞도록 상대 base
  base: "./",
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
  },
});
