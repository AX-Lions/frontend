import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'

/** 회의 탐색 사이드바가 접히면 레일도 같이 접힌다 — `GlobalSidebar` 쪽 주석 참고. */
export function FlowRail({ collapsed = false }) {
  return <GlobalSidebar active="meeting" collapsed={collapsed} />
}
