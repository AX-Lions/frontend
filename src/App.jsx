import { AppRouter } from './app/AppRouter.jsx'
import { MockBanner } from './mocks/MockBanner.jsx'
import { TooltipLayer } from './shared/components/TooltipLayer.jsx'

export default function App() {
  // 띠를 라우터 **밖**에 둔다. 안에 두면 화면마다 따로 붙여야 하고,
  // 한 곳이라도 빠지면 그 화면에서만 가짜인 줄 모르게 된다.
  return (
    <>
      <MockBanner />
      <AppRouter />
      {/* 안내 말풍선도 라우터 **밖**이다. 화면마다 붙이면 한 곳이라도 빠졌을 때
          그 화면에서만 아이콘이 말이 없어진다 — 띠와 같은 이유다. */}
      <TooltipLayer />
    </>
  )
}
