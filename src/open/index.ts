/**
 * 열기 진입점 — 파일 1개 → Book.
 * 판별은 확장자가 아니라 내용(포맷 스니핑): ZIP 시그니처("PK") → 패키지 구조로 EPUB 여부.
 * 1단계 = EPUB 만. 2단계에서 HTML·ZIP(재귀)·서재 목록·압축 폭탄 한도를 어댑터 레지스트리로 확장한다(PLAN.md §3.1).
 */
import JSZip from "jszip";
import type { Book } from "../book/model";
import { looksLikeEpub, openEpub } from "./epub";

export class UnsupportedFileError extends Error {}

async function isZip(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

export async function openFile(file: File): Promise<Book> {
  if (await isZip(file)) {
    const zip = await JSZip.loadAsync(file);
    if (looksLikeEpub(zip)) return openEpub(zip, file.name);
  }
  throw new UnsupportedFileError(`열 수 없는 형식입니다: ${file.name} (현재는 EPUB 만 지원)`);
}
