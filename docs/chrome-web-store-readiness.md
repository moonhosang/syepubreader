# 크롬 웹스토어 등록 사전 점검

> 기준 = Chrome Web Store 프로그램 정책 + Manifest V3 규칙. 점검일 2026-10-13. 형태 = **얇은 확장(진입로) + 웹앱 본체**(PLAN.md §2).
> ✅ 충족 · 🔧 이번에 수정 · ⏳ 확장 제작 시 할 일

## A. 코드 (결정론적 — 자동 검증으로 고정)

| # | 기준 | 상태 | 근거 / 회귀 장치 |
|---|---|---|---|
| A1 | 원격 호스팅 코드 금지 (MV3) | ✅ | 의존성(JSZip·DOMPurify) 전부 번들. 원격 `<script>`·`import()`·`fetch` 코드 로딩 없음 |
| A2 | `eval` / `new Function` / 문자열 타이머 금지 | ✅ | 소스·번들 0건 |
| A3 | 인라인 스크립트 금지 (확장 CSP `script-src 'self'`) | 🔧 | 셸을 인라인 `<script>` 로 주입하던 것을 **번들 모듈 동적 import** 로 교체(`mount.ts`). 배포판에 동일 CSP 메타 강제(`vite.config.ts`) + e2e 를 **배포판 대상**으로 실행 → 재발 시 즉시 실패 |
| A4 | 신뢰 불가 콘텐츠의 HTML 주입(XSS) | 🔧 | 셸 목차 서랍이 장 제목 `textContent` 를 `innerHTML` 로 재해석 → **EPUB 목차에 심은 HTML 이 요소로 실행되던 취약점** 수정(`esc()`). `tests/e2e/security.spec.ts`(수정 전 셸에서 실패 확인됨) |
| A5 | 사용자 파일 정제 | ✅ | 변환기 허용 목록 재구성 + DOMPurify. script·on*·javascript: 0 (security.spec) |
| A6 | 난독화 금지 (축소는 허용) | ✅ | Vite 기본 축소만. 소스 공개 저장소 |
| A7 | 데이터 전송 | ✅ | 네트워크 요청 0(자기 자산 제외). CSP `connect-src 'self'` |

## B. 정책·상점 정보

| # | 항목 | 상태 | 내용 |
|---|---|---|---|
| B1 | 개인정보 처리방침 URL | ✅ | `PRIVACY.md` → https://github.com/moonhosang/syepubreader/blob/main/PRIVACY.md |
| B2 | 데이터 공개(Data usage) | ✅ | "수집 안 함". 단, 기기 내 저장(IndexedDB: 현재 책, localStorage: 읽기 위치·설정)은 처리방침에 명시 |
| B3 | 단일 목적 | ⏳ | "EPUB 링크/파일을 syepubreader 리더로 연다" 한 문장으로 기술 |
| B4 | 권한 최소화 | ⏳ | `contextMenus` 만 필수. 다른 사이트 파일 받기는 `optional_host_permissions` 로 **클릭 시점에 그 사이트만** 요청(설치 시 광범위 권한 요구 금지 — 심사 지연·거절 사유) |
| B5 | 아이콘 16/32/48/128 | ⏳ | 없음 → 제작 필요(PWA 아이콘과 공용) |
| B6 | 스크린샷 1280×800 ≥1 | ⏳ | **저작권 없는 책으로 촬영**(퍼블릭 도메인 EPUB, 예: Project Gutenberg). 현재 테스트 샘플(상용 도서) 표지·본문 사용 금지 |
| B7 | 상표 | ⏳ | 이름·설명에 "Chrome"·"Google" 오인 표현 금지(“for Chrome” 정도만 허용) |

## C. 확장 제작 시 체크 (⏳)

- 매니페스트: `manifest_version: 3`, `minimum_chrome_version`, `version` 규칙(올림 필수)
- 앱 연동 진입점: 웹앱에 "메시지로 받은 파일 열기"(확장 → 앱 탭 `postMessage`) — 출처(origin) 검증 필수
- 확장 페이지에 앱을 넣지 않는다(크롬 번역 미동작 [추정] · iPad 미지원) — 진입로만
- 업로드 전: `npm run build` → 확장 폴더 zip(최상위 `manifest.json`) → unlisted 로 먼저 공개

## D. 이번 점검으로 바뀐 것

- `src/reader/shell.js` — `esc()` 추가, 목차 서랍 제목 이스케이프, 읽기시간 라벨 언어 대응(영어책 "min")
- `src/reader/mount.ts` — 인라인 스크립트 → `await import("./shell.js")`
- `vite.config.ts` — 배포 CSP 주입 · `playwright.config.ts` — e2e 대상 = 배포판(preview)
- `tests/e2e/security.spec.ts` — 악성 EPUB 회귀 · `PRIVACY.md` — 처리방침
- 셸 수정은 `pipeline/shell_source.py` 로 출판본에도 동기화(출판본 HTML 은 CSP 가 없어 A4 가 실제로 실행 가능했음 → 재빌드로 해소)
