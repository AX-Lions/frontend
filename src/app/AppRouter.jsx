import { Suspense, lazy, useEffect, useState } from 'react'

import { PageLoading } from '../shared/components/LoadState.jsx'
import { ScreenBoundary } from './ScreenBoundary.jsx'
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

/*
  나눈 조각을 부르는 함수를 따로 둔다. `lazy` 에 인라인으로 적으면 미리 받기가
  같은 것을 가리킬 방법이 없어, 미리 받아 놓고도 다시 받는다.
*/
const loadPage = {
  signup: () => import('../pages/auth/SignupPage.jsx'),
  flowBoard: () => import('../pages/flowBoard/FlowBoardPage.jsx'),
  chat: () => import('../pages/chat/ChatPage.jsx'),
  account: () => import('../pages/account/AccountPage.jsx'),
  delegatePrep: () => import('../pages/delegatePrep/DelegatePrepPage.jsx'),
  inbox: () => import('../pages/inbox/InboxPage.jsx'),
  meetingSchedule: () => import('../pages/meetingSchedule/MeetingSchedulePage.jsx'),
}

/*
  `lazy` 는 `default` 만 본다. 화면들은 이름 붙은 export 라 여기서 한 번 감싼다.
  화면 쪽에 `export default` 를 다는 방법도 있지만, 그러면 담당자 파일 넷과
  그것을 부르는 자리를 전부 건드리게 된다.
*/
const SignupPage = lazy(() => loadPage.signup().then((m) => ({ default: m.SignupPage })))
const FlowBoardPage = lazy(() => loadPage.flowBoard().then((m) => ({ default: m.FlowBoardPage })))
const ChatPage = lazy(() => loadPage.chat().then((m) => ({ default: m.ChatPage })))
const AccountPage = lazy(() => loadPage.account().then((m) => ({ default: m.AccountPage })))
const DelegatePrepPage = lazy(
  () => loadPage.delegatePrep().then((m) => ({ default: m.DelegatePrepPage })))
const InboxPage = lazy(() => loadPage.inbox().then((m) => ({ default: m.InboxPage })))
const MeetingSchedulePage = lazy(
  () => loadPage.meetingSchedule().then((m) => ({ default: m.MeetingSchedulePage })))

/**
 * 첫 화면이 뜨고 손이 빈 틈에 나머지를 미리 받아 둔다.
 *
 * 가르기만 하면 화면을 옮길 때마다 **원래는 없던 기다림**이 생긴다. 처음 받는
 * 바이트는 줄었는데 이동이 느려지면 가르기가 도리어 손해로 느껴진다.
 * 첫 화면이 뜬 뒤에 받아 두면 둘 다 얻는다.
 *
 * `requestIdleCallback` 을 쓰는 이유는 이것이 급하지 않기 때문이다. **지금 보고
 * 있는 화면의 데이터 요청과 경쟁하면 안 된다.** Safari 에 아직 없어서
 * `setTimeout` 으로 물러선다.
 *
 * 실패는 삼킨다. 미리 받기가 안 된다고 알릴 것은 없다 — 그 화면으로 실제로 갈
 * 때 다시 받고, 그때 실패하면 그때 화면이 말한다.
 */
function preloadOtherPages() {
  const run = () => {
    Object.values(loadPage).forEach((load) => { load().catch(() => {}) })
  }

  const idle = window.requestIdleCallback
  const id = idle ? idle(run, { timeout: 3000 }) : window.setTimeout(run, 1500)

  return () => {
    if (idle) {
      window.cancelIdleCallback?.(id)
    } else {
      window.clearTimeout(id)
    }
  }
}

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
    // `Suspense` 는 **기다리는 것**만 다룬다. 조각을 못 받은 것은 실패라
    // 그대로 렌더 단계로 올라가고, 잡아 주는 것이 없으면 앱이 통째로 사라진다.
    <ScreenBoundary>
      <Suspense fallback={<PageLoading label="화면을 여는 중입니다…" />}>
        {children}
      </Suspense>
    </ScreenBoundary>
  )
}

export function AppRouter() {
  const path = usePath()
  const signedIn = useSignedIn()

  // 첫 화면이 뜬 뒤 나머지를 미리 받는다. 이동할 때 기다림이 없어진다.
  useEffect(preloadOtherPages, [])

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

  if (path === '/inbox') {
    return <Screen><InboxPage /></Screen>
  }

  if (path === '/meeting-schedule') {
    return <Screen><MeetingSchedulePage /></Screen>
  }

  /*
    회의 대리 참석 준비.

    회의가 주소에 실린다(`?meeting=<id>`). 플로우 화면과 같은 규칙이라, 링크를
    복사해 두거나 새 탭으로 열어도 같은 회의가 열린다 — 화면 상태로만 들고
    있으면 새로고침 한 번에 어느 회의였는지가 사라진다.
  */
  if (path === '/delegate-prep') {
    return <Screen><DelegatePrepPage /></Screen>
  }

  return <HomePage />
}
