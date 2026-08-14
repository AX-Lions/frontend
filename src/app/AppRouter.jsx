import { HomePage } from '../pages/home/HomePage.jsx'
import { FlowBoardPage } from '../pages/flowBoard/FlowBoardPage.jsx'

export function AppRouter() {
  if (window.location.pathname === '/flow-board' || window.location.pathname === '/flowchart') {
    return <FlowBoardPage />
  }

  return <HomePage />
}
