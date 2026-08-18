import { Suspense, lazy, useEffect, useState } from 'react'

import { Loading } from '../shared/components/LoadState.jsx'
import { currentPath, subscribeToPath } from './navigation.js'
import { isSignedIn, onAuthChange } from '../lib/auth.js'

/*
  화면을 경로별로 나눠 받는다.

  한 덩어리로 두면 **로그인 화면 하나 보려고 플로우 캔버스까지 받는다.**
  캔버스는 레이아웃 기하와 SVG 렌더가 들어 있어 이 앱에서 제일 무거운데,
  로그인 전에는 쓸 일이 없다.

  ## 로그인·홈은 나누지 않는다

  `LoginPage` 는 **아직 아무것도 못 받은 사람이 보는 첫 화면**이다. 여기서 한 번
  더 왕복하면 흰 화면이 그만큼 길어진다. `HomePage` 도 로그인 직후 반드시 오는
  곳이라 같이 둔다 — 나눠 봐야 그 왕복이 로그인 다음 순간으로 밀릴 뿐이다.

  나누는 것은 **안 갈 수도 있는 화면**뿐이다.
*/
import { HomePage } from '../pages/home/HomePage.jsx'
import { LoginPage } from '../pages/auth/LoginPage.jsx'

const SignupPage = lazy(() => import('../pages/auth/SignupPage.jsx')
  .then((m) => ({ default: m.SignupPage })))
const FlowBoardPage = lazy(() => import('../pages/flowBoard/FlowBoardPage.jsx')
  .then((m) => ({ default: m.FlowBoardPage })))
const ChatPage = lazy(() => import('../pages/chat/ChatPage.jsx')
  .then((m) => ({ default: m.ChatPage })))
const AccountPage = lazy(() => import('../pages/account/AccountPage.jsx')
  .then((m) => ({ default: m.AccountPage })))

/** 로그인하지 않아도 볼 수 있는 화면. */
const PUBLIC = new Set(['/login', '/signup'])

function usePath() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => subscribeToPath(() => setPath(currentPath())), [])
  return path
}

function useSignedIn() {
  const [signedIn, setSignedIn] = useState(isSignedIn)
  // 토큰이 만료돼 갱신까지 실패하면 `lib/api.js` 가 토큰을 지운다. 그때 화면이
  // 스스로 로그인으로 돌아와야 한다 — 안 그러면 사용자는 비어 있는 화면 앞에서
  // 왜 아무것도 안 나오는지 모른 채 기다린다.
  useEffect(() => onAuthChange((token) => setSignedIn(Boolean(token))), [])
  return signedIn
}

/**
 * 나눠 받는 화면이 도착할 때까지 그릴 것.
 *
 * **빈 화면으로 두지 않는다.** 조각을 받는 동안 아무것도 없으면 사용자는 링크가
 * 안 눌린 줄 알고 다시 누른다.
 */
function Screen({ children }) {
  return (
    <Suspense fallback={<Loading label="화면을 여는 중입니다…" />}>
      {children}
    </Suspense>
  )
}

export function AppRouter() {
  const path = usePath()
  const signedIn = useSignedIn()

  if (!signedIn) {
    if (path === '/signup') {
      return <Screen><SignupPage /></Screen>
    }
    // 주소를 바꾸지 않고 **로그인 화면을 그린다.**
    //
    // `/flow-board` 로 들어온 사람을 `/login` 으로 밀어내면, 로그인 뒤에
    // 원래 가려던 곳이 어디였는지가 사라진다. 주소를 그대로 두면 나중에
    // 그 자리로 돌려보내는 것을 붙이기만 하면 된다.
    return <LoginPage />
  }

  if (PUBLIC.has(path)) {
    // 이미 로그인한 사람이 인증 화면을 볼 이유가 없다.
    //
    // **`/signup` 을 로그인 여부보다 먼저 보면 안 된다.** 로그인한 사람이
    // 주소로 들어와 가입을 마치면 `signup()` 과 `login()` 이 둘 다
    // `setTokens()` 를 불러 **지금 로그인한 계정의 토큰을 새 계정 것으로
    // 덮어쓴다.** 아무 경고 없이 계정이 바뀐다.
    return <HomePage />
  }

  if (path === '/flow-board' || path === '/flowchart') {
    return <Screen><FlowBoardPage /></Screen>
  }

  if (path === '/chat') {
    return <Screen><ChatPage /></Screen>
  }

  if (path === '/account') {
    return <Screen><AccountPage /></Screen>
  }

  return <HomePage />
}
