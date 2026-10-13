/** 책 1권의 앱 내부 표현 — 형식(EPUB/HTML/ZIP)과 무관한 공통 모델. 모든 어댑터의 출력이자 조립기의 입력. */

export interface BookMeta {
  title: string;
  author: string;
  publisher: string;
  /** BCP-47 언어 코드(예: "en", "ko"). 크롬 번역 감지와 셸 UI 라벨 언어에 쓰인다. */
  language: string;
}

export interface Chapter {
  /** 문서 내 앵커 id (예: "ch3"). */
  id: string;
  /**
   * 소스 앵커 — 원본 패키지 안의 파일 경로(예: "OEBPS/ch03.xhtml").
   * EPUB 내보내기(왕복 보존)에서 번역된 장을 원본 파일에 되돌려 끼우는 열쇠. 반드시 보존.
   */
  src: string;
  title: string;
  /** "1", "2"… — 본문 장 번호. 번호 없는 장(서문 등)은 undefined. */
  num?: string;
  /** 우리 조각 계약(셸 클래스)으로 변환된 본문 HTML. 그림은 data-asset 속성으로 자산을 참조. */
  html: string;
}

export interface Book {
  meta: BookMeta;
  chapters: Chapter[];
  /** 자산(그림) — 키 = 패키지 안 전체 경로. 본문은 `<img data-asset="경로">` 로 참조. */
  assets: Map<string, Blob>;
  /** 표지 그림의 자산 경로(없으면 undefined). */
  coverAsset?: string;
  /** 책별 저장 키(읽기 위치·설정) — 셸의 data-book-key 로 전달. */
  key: string;
}
