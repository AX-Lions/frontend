# Bordo Frontend

React + Vite (JavaScript, JSX). 브랜치는 `develop`.
상위 맥락은 `../CLAUDE.md`와 `../.claude/docs/BordoProgress-v03.md` 참조.

## 실행

```bash
npm install
npm run dev        # PowerShell에서 막히면 npm.cmd run dev
```

## 구조

```
src/
  app/         라우터와 전역 Provider (AppRouter.jsx, providers.jsx)
  pages/       화면 단위 페이지 (home/, flowchart/)
  features/    기능별 컴포넌트와 로직 (flowboard/)
  shared/      재사용 컴포넌트·상수 (Button.jsx, constants/project.js)
  lib/         공통 유틸·포맷터·API 클라이언트
  assets/      컴포넌트에서 import하는 정적 에셋
```

- 전체 화면은 `pages`, 기능 종속 컴포넌트는 `features/{feature-name}`.
- 재사용 버튼·입력·레이아웃 헬퍼·상수는 `shared`, 순수 유틸과 API 클라이언트는 `lib`.
- 목 데이터는 공유가 필요해지기 전까지 해당 기능 가까이에 둔다 (`pages/home/home.mock.js`).
- `api`, `hooks`, `styles` 폴더는 실제로 파일이 필요할 때만 만든다.

## 현재 상태

- API 연동 없음. **Figma 시안 기준 목 데이터로 동작**한다.
- 구현된 화면: 홈, 플로우차트. Figma 아이콘 에셋 반영됨.

## 이 저장소가 API 계약을 주도한다

작업 순서가 뒤집혀 있다.

```
화면 정의 → 목 데이터 형태 확정 → 그 형태가 곧 API 계약 → 백엔드 구현
```

**목 데이터 형태를 바꾸는 것은 API 스펙을 바꾸는 것이다.** 필드명·중첩 구조를 정할 때는
`../backend/bordo-openapi.yaml`과 대조하고, 어긋나면 임의로 맞추지 말고 백엔드 담당과 합의한다.

백엔드에서 이미 응답하는 것:

- `GET /api/v1/home` — 환영 문구 · 최근 회의 카드 5개 · 오늘 일정 · 최근 회의 요약 ·
  프로젝트 진행 현황 · 사이드바를 **한 번에** 돌려준다. 쪼개서 부르지 않는다.
  - `불참한 회의` 뱃지 = `recent_meetings[].missed`
- `GET /api/v1/meetings/{id}/flow` — 필터: `category` `participant_ids` `content_types`
  `surfaces` `since_minutes`. **플로우 그래프는 `flow_edge` 한 테이블만 읽으면 그려진다**
  (노드 이름과 방향 표기가 행 안에 들어 있음).
- `GET /api/v1/meetings/{id}/ai-briefing` · `pending-questions` — **아직 하드코딩 시드 데이터**

오류는 HTTP 상태가 아니라 응답 본문의 `error.code`로 분기한다.

## 화면 원칙

핵심 화면은 2개다.

| 화면 | 관점 | 내용 |
|---|---|---|
| **AI 대리인** | 개인 | 회의 전 불참 등록·사전 지시 / 회의 후 대리인이 한 행동·놓친 내용·변경사항 |
| **Flow** | 팀 | `사용자 → 개인 AI → 회의/서버 → 다른 AI → 다른 사용자` 정보 흐름 |

- **핵심 기능까지의 접근 단계를 최소화한다.** 팀 → 회의 → 대리인처럼 단계를 쌓지 않는다.
- Flow는 **백엔드 로그 시각화가 아니라 협업 맥락 시각화**다.
  - 표시: 회의 안건 전달 · 메시지와 응답 · 새 일정 · 새 계획 · 기존 정보 수정 · 회의 결과 정리
  - 미표시: AI 내부 추론 과정 · 모든 검색 호출 · 시스템 로그
- Flow 필터는 **사람 · 회의 · 시간 3종**. 필터 프리셋은 MVP 제외.
- 시간 흐름은 별도 타임라인 없이 **opacity**로 표현한다 (최근일수록 진하게).
- Discord AI와 서비스 AI는 Flow에서 **하나의 대리인 노드로 통합** 표현한다.
- 대리인이 유보한 경우("본인 확인 필요")를 숨기지 않고 **판단 이유와 함께 보여준다.**
  유보는 실패가 아니라 이 서비스의 차별점이다.

## 미확정 (진행 전 확인)

- **메인 화면 중심**: A. 최근 회의·변경사항 / B. AI 대화 — **경향은 A**, 아직 미확정.
  프론트 전체 구조가 여기에 달려 있다.
- **팀/프로젝트 구조**: 팀 단일 vs 팀+프로젝트 2계층 — 팀 중심이 유력.

## 협업

- 디자이너(유수인)도 이 저장소에 직접 커밋한다 (디자인 토큰·화면 정의서).
  디자인 산출물을 대신 커밋해 주지 않는다 — 커밋 기록이 평가 대상이다.
- 백엔드에서 신경 쓴 기술적 차별점이 UI에 드러나야 한다. 채팅창 하나로 보이면 안 된다.
