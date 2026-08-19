import { AppRouter } from './app/AppRouter.jsx'
import { MockBanner } from './mocks/MockBanner.jsx'

export default function App() {
  // 띠를 라우터 **밖**에 둔다. 안에 두면 화면마다 따로 붙여야 하고,
  // 한 곳이라도 빠지면 그 화면에서만 가짜인 줄 모르게 된다.
  return (
    <>
      <MockBanner />
      <AppRouter />
    </>
  )
}
