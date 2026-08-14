import { HomePage } from '../pages/home/HomePage.jsx'
import { FlowchartPage } from '../pages/flowchart/FlowchartPage.jsx'

export function AppRouter() {
  if (window.location.pathname === '/flowchart') {
    return <FlowchartPage />
  }

  return <HomePage />
}
