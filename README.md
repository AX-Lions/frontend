# AX Lions Frontend

중앙 해커톤 MVP 프론트엔드입니다. React와 Vite로 구성되어 있습니다.

## 시작하기

```bash
npm install
npm run dev
```

Windows PowerShell에서 스크립트 실행이 막히면 아래 명령어를 사용하세요.

```bash
npm.cmd run dev
```

## 폴더 구조

```text
src/
  app/                 # 라우터와 전역 Provider
  pages/               # 화면 단위 페이지 구성
  features/            # 기능별 컴포넌트와 로직
  shared/              # 재사용 컴포넌트와 상수
  lib/                 # 공통 유틸, 포맷터, 클라이언트
  assets/              # 컴포넌트에서 import하는 정적 에셋
```

## 작업 기준

- 전체 화면은 `pages`에 둡니다.
- 기능에 종속된 컴포넌트와 로직은 `features/{feature-name}`에 둡니다.
- 재사용 가능한 버튼, 입력, 레이아웃 헬퍼, 상수는 `shared`에 둡니다.
- 공통 API 클라이언트, 저장소 헬퍼, 순수 유틸 함수는 `lib`에 둡니다.
- 데모/목 데이터는 공유가 필요해지기 전까지 해당 기능 가까이에 둡니다.
- `api`, `hooks`, `styles` 폴더는 실제로 파일이 필요할 때만 만듭니다.

## 현재 구현

- API 연동 제거
- Figma 시안 기준 목 데이터 적용
- 홈 화면과 플로우 화면 UI 구성
- Figma에서 추출한 아이콘 에셋 반영
