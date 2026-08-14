import { HomePage } from '../pages/home/HomePage.jsx'
import { FlowBoardPage } from '../pages/flowBoard/FlowBoardPage.jsx'
import { ChatPage } from '../pages/chat/ChatPage.jsx'

export function AppRouter() {
  if (window.location.pathname === '/flow-board' || window.location.pathname === '/flowchart') {
    return <FlowBoardPage />
  }

  if (window.location.pathname === '/chat') {
    return <ChatPage />
  }

  return <HomePage />
}
