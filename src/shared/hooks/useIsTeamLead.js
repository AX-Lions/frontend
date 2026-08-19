import { api } from '../../lib/api.js'
import { useResource } from '../../lib/useResource.js'

const LEAD_ROLES = new Set(['OWNER', 'ADMIN'])

/**
 * 속한 팀 중 하나라도 `OWNER` · `ADMIN` 이면 팀장이다.
 *
 * `회의` 아이콘의 `회의 시작하기 · 회의 일정 보기` 드롭다운(시안 `692:7910`)이
 * 팀장에게만 뜬다. `TeamSwitchDialog` 의 `Discord 설정` 단추와 같은 조건이라
 * 같은 캐시 키(`teams`)를 쓴다 — 둘 다 붙어 있는 화면(홈)에서 `/teams` 를
 * 두 번 부르지 않는다.
 */
export function useIsTeamLead() {
  const { data } = useResource(
    (signal) => api.get('/teams', undefined, { signal }), [], { cacheKey: 'teams' })
  return (data?.results ?? []).some((team) => LEAD_ROLES.has(team.my_role))
}
