# 크롬 웹스토어 등록 정보 (붙여넣기용)

> 업로드 파일: `npm run ext:build` → `dist-ext/syepubreader-extension-<버전>.zip`
> 대시보드: https://chrome.google.com/webstore/devconsole → **New item** → zip 업로드

## 스토어 등록정보 (Store listing)

**Name**: syepubreader

**Summary (132자 이내)**:
Open EPUB links in a clean book-like reader — two-page spread, tap & swipe page turns. Files never leave your device.

**Description**:
```
syepubreader opens EPUB books in a clean, book-like reader right in your browser.

• Right-click any .epub link → "Open in syepubreader"
• Click the toolbar icon to open the reader and pick a file from your computer
• Two-page spread (book), single page, or continuous scroll
• Tap / swipe / keyboard page turns, table of contents drawer, light & dark themes
• Adjustable margins, gap and font size
• Your reading position is remembered on your device
• Works great with your browser's built-in translation — read a translated book page by page

Privacy: no accounts, no tracking, no analytics. Books are processed entirely inside your browser and never uploaded anywhere.
Open source (MIT): https://github.com/moonhosang/syepubreader
```

**Category**: Productivity (또는 Education)
**Language**: English (추가로 한국어 등록정보를 만들 수 있음)

**Graphic assets**:
- Store icon 128×128: `dist-ext/icons/128.png`
- Screenshots 1280×800 (이 폴더): `1-home.png` · `2-book-spread.png` · `3-dark-figure.png` · `4-contents-drawer.png`
  — 화면 속 책은 퍼블릭 도메인(Project Gutenberg 『Alice's Adventures in Wonderland』)

## 개인정보 보호 (Privacy practices)

**Single purpose**:
Open EPUB files and EPUB links in the syepubreader web reader.

**Permission justifications**:
- `contextMenus` — adds the "Open in syepubreader" item to the right-click menu on .epub links.
- `activeTab` — lets the extension download the clicked .epub link from the current page only at the moment the user chooses the menu item.
- Optional host permissions (`*://*/*`, requested at click time for one site only) — needed only when the .epub link points to a different site than the current page; the user is asked for that single site.
- Content script on `https://moonhosang.github.io/syepubreader/*` — hands the downloaded file to the reader page (our own site). It does not run on any other site.

**Remote code**: No, I am not using remote code. (모든 코드가 패키지 안에 포함됨)

**Data usage**: 아무 항목도 체크하지 않음(수집 데이터 없음) + 세 가지 고지 모두 동의
(판매 안 함 · 핵심 기능 외 사용 안 함 · 신용평가/대출 목적 사용 안 함)

**Privacy policy URL**: https://github.com/moonhosang/syepubreader/blob/main/PRIVACY.md

## 공개 범위 (Distribution)
- 처음엔 **Unlisted**(링크 아는 사람만) → 동작 확인 후 Public
- 지역: 모든 지역
