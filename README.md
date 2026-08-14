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
