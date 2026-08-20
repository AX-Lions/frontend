import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'
import { useMe } from './useFlowBoardData.js'

/**
 * 회의 탐색 사이드바가 접히면 레일도 같이 접힌다 — `GlobalSidebar` 쪽 주석 참고.
 *
 * `useMe()` 는 `FlowBoardPage` 도 같은 캐시 키(`flow-me`)로 부르므로, 둘 다
 * 화면에 있어도 요청은 한 번만 나간다 — 레일 하단 프로필이 홈 사이드바와
 * 같은 사람을 그리려면 이름·아바타가 필요하다.
 */
export function FlowRail({ collapsed = false }) {
  const me = useMe()
  return (
    <GlobalSidebar
      active="meeting"
      collapsed={collapsed}
      user={{ name: me.data?.name, avatarUrl: me.data?.avatar_url }}
    />
  )
}
