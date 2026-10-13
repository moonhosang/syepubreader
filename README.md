# syepubreader

EPUB 을 **책처럼** 읽는 웹 리더. 펼친 두 쪽(책)·한 쪽(페이지)·연속 보기, 탭·스와이프 넘김, 테마·폭·글자 크기 설정.
파일은 서버로 가지 않고 **이 기기 안에서만** 처리됩니다.

## 접속

| | 주소 |
|---|---|
| ▶ **앱 (바로 쓰기)** | **https://moonhosang.github.io/syepubreader/** |
| 소스 (GitHub) | https://github.com/moonhosang/syepubreader |

EPUB 파일을 첫 화면에 끌어다 놓거나 눌러서 고르면 열립니다. 읽던 책은 기기 안에 보관돼 다시 접속해도 이어서 열리고,
⚙ 설정 패널의 **다른 책 열기 / 책 닫기** 또는 화면에 새 파일을 끌어다 놓아 책을 바꿉니다. 아이패드·휴대폰 브라우저에서도 같은 주소로 열립니다.

> 상태: 1단계(EPUB 열기 → 리더) 완료. 로드맵·설계는 [PLAN.md](PLAN.md).

## 실행

```bash
npm install
npm run dev        # http://localhost:5199
```

## 검증

```bash
npm run typecheck
npm test                                   # 단위 테스트(vitest)
SAMPLE_EPUB_DIR=/path/to/epubs npm run e2e # 실 EPUB 회귀(playwright) — 샘플은 저장소에 넣지 않음
```

실 EPUB 회귀는 각 책에 대해 ① 열림·셸 UI·콘솔 오류 0 ② 모든 장의 소스 앵커(`data-src`) ③ 책 모드 전 쪽의 글자 잘림 0 을 확인합니다.

## 구조

| 경로 | 역할 |
|---|---|
| `src/open/` | 파일 판별(내용 기반) · EPUB 어댑터(OPF·spine·목차·표지) |
| `src/book/` | 공통 Book 모델 · 장 변환(허용 목록 재구성) · 조립·정제(DOMPurify) |
| `src/reader/` | 리더 셸(`shell.js`/`shell.css` — 이 저장소가 정본) · 마운트 |
| `src/app/` | 첫 화면(파일 고르기/끌어다 놓기) |

## 라이선스

MIT. 번들 폰트 JetBrains Mono 는 SIL OFL 1.1.
