import { useEffect, useState } from 'react'

import { HomePage } from '../pages/home/HomePage.jsx'
import { FlowBoardPage } from '../pages/flowBoard/FlowBoardPage.jsx'
import { ChatPage } from '../pages/chat/ChatPage.jsx'
import { LoginPage } from '../pages/auth/LoginPage.jsx'
import { SignupPage } from '../pages/auth/SignupPage.jsx'
import { currentPath, subscribeToPath } from './navigation.js'
import { isSignedIn, onAuthChange } from '../lib/auth.js'

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

export function AppRouter() {
  const path = usePath()
  const signedIn = useSignedIn()

  if (path === '/signup') {
    return <SignupPage />
  }

  if (!signedIn) {
    // 주소를 바꾸지 않고 **로그인 화면을 그린다.**
    //
    // `/flow-board` 로 들어온 사람을 `/login` 으로 밀어내면, 로그인 뒤에
    // 원래 가려던 곳이 어디였는지가 사라진다. 주소를 그대로 두면 나중에
    // 그 자리로 돌려보내는 것을 붙이기만 하면 된다.
    return <LoginPage />
  }

  if (PUBLIC.has(path)) {
    // 이미 로그인한 사람이 로그인 화면을 볼 이유가 없다.
    return <HomePage />
  }

  if (path === '/flow-board' || path === '/flowchart') {
    return <FlowBoardPage />
  }

  if (path === '/chat') {
    return <ChatPage />
  }

  return <HomePage />
}
