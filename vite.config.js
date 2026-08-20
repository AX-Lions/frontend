import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // `process.cwd()` 대신 이 파일 위치를 쓴다. eslint 설정이 브라우저 전역만
  // 알고 있어 `process` 를 모르는 것도 있지만, 어느 폴더에서 실행하든 `.env` 를
  // 같은 자리에서 찾는 편이 맞다.
  const env = loadEnv(mode, import.meta.dirname, '')

  return {
    plugins: [react()],
    server: {
      // `lib/api.js` 는 `/api/v1` 상대경로로 부른다. 배포에서는 nginx 가 프론트와
      // API 를 같은 출처로 서빙하므로 그대로 맞지만, 개발 서버에는 `/api` 를
      // 받아 줄 것이 없어 **404 가 난다.** 여기서 백엔드로 넘긴다.
      //
      // 프록시로 푸는 이유는 절대 URL 을 박지 않기 위해서다. 절대 URL 을 쓰면
      // CORS 설정이 따라붙고, 배포 주소가 바뀔 때 고칠 곳이 늘어난다.
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        // 실시간(`lib/projectEvents.js`)도 같은 이유로 넘긴다. 여기가 없으면
        // 개발 서버에서 `/ws` 가 404 라, **코드는 다 됐는데 두 창을 띄워도
        // 아무것도 안 오는** 상태가 된다 — 받는 쪽을 만들어 놓고 그것을
        // 확인할 방법이 없는 셈이라 이 프록시가 기능의 일부다.
        //
        // `ws: true` 가 핵심이다. 없으면 업그레이드 요청을 평범한 HTTP 로
        // 넘겨서 손이 안 맞는다.
        '/ws': {
          target: env.VITE_WS_TARGET || 'ws://127.0.0.1:8000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
