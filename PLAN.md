# syepubreader — 계획서

> 허접한 EPUB 뷰어를 대체하는 **좋은 리더**. 번역은 크롬에 맡기고, 우리는 *잘 보여주고 잘 내보낸다*.
> 기반 = `book/출판사/pipeline` 에서 검증된 리더 셸(`shell.js`/`shell.css`) + EPUB 변환 로직(`epub_to_html.py`·`assemble.py`)의 JS 이식.

## 1. 목표 / 비목표

**목표**
- EPUB · HTML · ZIP(재귀)을 열어 우리 리더 셸로 보여준다 (책·페이지·연속 모드, 탭/스와이프, 설정).
- 크롬 자동번역된 결과를 **HTML / EPUB 으로 내보낸다**.
- PC(크롬) + 아이패드/폰(사파리·크롬)에서 동일하게 동작.

**비목표** (명시적으로 안 함)
- 용어집, 기기 내 번역(Translator API), 서버, 계정/동기화, DRM EPUB.

## 2. 형태 = 정적 웹앱(PWA), 크롬 확장 아님

| 이유 | 설명 |
|---|---|
| 크롬 자동번역 | 확장 페이지(`chrome-extension://`)엔 번역 제안이 안 뜸 [추정·확인 필요] → 핵심 흐름(번역→내보내기) 차단 |
| 아이패드 | iPad 크롬엔 확장이 없음. PWA 는 홈 화면 추가로 앱처럼 동작 |
| 파일 연결 | 데스크톱 PWA `file_handlers` 로 `.epub` 더블클릭 → 앱으로 열기 |
| 비용·프라이버시 | 정적 호스팅(GitHub Pages)·서버 0·파일은 기기 안에서만 처리 |

웹의 `.epub` 링크를 가로채 바로 여는 기능은 필요해지면 **얇은 확장**을 나중에 덧붙인다(본체 아님).

## 3. 아키텍처

```
입력(File/드롭/file_handlers)
  └─ sniff(포맷 판별·재귀) ── adapter registry ─┬─ EpubAdapter  → Book
                                                ├─ HtmlAdapter  → Book
                                                └─ ZipAdapter   → (재귀) → Library | Book
Book(장 목록 + 자산 + 메타) ─ sanitize(DOMPurify) ─ assemble(단일 문서·data-src 앵커) ─ Reader(shell)
Reader ─ translate-coverage(진행률·전체 채우기) ─ export ─┬─ HtmlExporter (깨끗한 셸 + 번역 본문)
                                                         └─ EpubExporter (원본 패키지 + 번역 장 교체)
```

### 3.1 열기 — 포맷 스니핑 + 어댑터 레지스트리
| 판별 | 처리 |
|---|---|
| `.epub` 또는 ZIP 안 `mimetype`+`META-INF/container.xml` | EPUB 1권 (압축 푼 EPUB 을 zip 으로 묶은 것도 인식 — **내용으로 판별**) |
| `.html/.htm/.xhtml` | 문서 1개. 같은 컨테이너 안 상대경로 자산(img/css) 연결 |
| 그 외 ZIP | 안으로 재귀 |
| 그 외 | 무시 · "해석 못 한 파일 N개" 요약 |

결과: 1개 → 바로 열기 · N개 → 서재 목록(ZIP 폴더 구조) · 0개 → 내용 요약과 안내.

### 3.2 안전장치 (사용자 파일 = 신뢰 불가)
1. **압축 폭탄 방지** — 재귀 깊이 ≤ 3, 해제 총량 ≤ ~1GB, 파일 수 ≤ ~5만. 초과 시 중단·안내.
2. **스크립트 제거** — `<script>`·`on*` 핸들러·`javascript:` URL 을 DOMPurify 로 제거. 이유: 같은 출처에서 실행되면 서재·읽기위치 접근, 외부 전송, 피싱 오버레이가 가능. 본문엔 스크립트가 불필요하고 오히려 쪽 나누기를 깨뜨림. (샌드박스 iframe 대안은 셸이 본문을 직접 다룰 수 없어 기각.)
3. **기기 내 처리** — 네트워크 전송 0.

### 3.3 번역 → 내보내기 (핵심 흐름의 함정 4)
1. **부분 번역** — 크롬은 긴 문서를 보이는 영역부터 번역 [추정·실측 필요] → 내보내기 전 **번역 진행률**(문단별 한글 비율) 표시 + **"전체 번역 채우기"**(모든 쪽 자동 순회로 번역 유도).
2. **셸 UI 중복** — `outerHTML` 통째 저장 금지. **본문(`.page`)만** 추출해 깨끗한 셸 템플릿에 재주입.
3. **번역 흔적** — 크롬이 넣는 `<font>` 래퍼·`translated-ltr` 클래스 제거, `lang="ko"` 설정.
4. **EPUB 왕복 보존** — 원본 패키지를 그대로 두고 각 장 XHTML 본문만 번역본으로 교체(OPF 의 언어·제목만 수정). 이를 위해 조립 시 장마다 **소스 앵커**(`data-src="OEBPS/ch03.xhtml"`)를 남긴다 — **1단계부터 필수**.

## 4. 기술 스택
- **TypeScript + Vite** (빌드), **Vitest** (단위 테스트), **Playwright** (리더 회귀 테스트)
- 런타임 의존: **JSZip**(압축), **DOMPurify**(정제). epub.js 등 렌더링 엔진은 쓰지 않음(렌더러 = 우리 셸).
- 배포: GitHub Pages (정적).

## 5. 폴더 구조 (예정)
```
src/
  open/        sniff.ts · registry.ts · adapters/{epub,html,zip}.ts · limits.ts
  book/        model.ts (Book·Chapter·Asset) · sanitize.ts · assemble.ts
  reader/      shell.js · shell.css (pipeline 에서 이식) · mount.ts
  translate/   coverage.ts · fill.ts
  export/      html.ts · epub.ts · clean-translate-marks.ts
  app/         main.ts · library.ts · pwa (manifest·service worker)
tests/         unit(vitest) · e2e(playwright: 쪽 잘림 0·탭/스와이프·내보내기)
```

## 6. 단계 (각 단계 완료 기준)
| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **1** | EPUB 1권 열기 → 셸로 보기 | `done-epubtohtml` 샘플 10권이 열림 · 쪽 잘림 0 (기존 검증 스크립트 이식) · `data-src` 앵커 존재 |
| 2 | HTML · ZIP(재귀) · 서재 목록 · 안전장치 | 중첩 zip/압축 푼 EPUB zip 인식 · 폭탄 샘플 차단 · 스크립트 제거 테스트 |
| 3 | 번역 진행률 + 전체 채우기 | 크롬 번역 후 진행률 100% 도달 실측 |
| 4 | 내보내기 HTML / EPUB | 내보낸 HTML 재열기 시 UI 중복 0 · 내보낸 EPUB 이 epubcheck 통과·타 리더에서 열림 |
| 5 | PWA (오프라인·홈 화면·file_handlers) · GitHub Pages 배포 | 아이패드 홈 화면 실행 · `.epub` 더블클릭 열기 |

## 7. 열린 결정
- **셸 정본 위치**: 지금 `shell.js`/`shell.css` 정본은 `pipeline/`. 이 프로젝트로 이식하면 두 벌이 됨 → 장기적으로 이 프로젝트를 정본으로 두고 pipeline 이 가져다 쓰는 방향을 권장(결정 필요).
- **저장소**: GitHub 저장소 이름·공개 여부.
- **라이선스**: 공개 시 MIT 등 선택.
