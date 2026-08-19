import { api } from '../../lib/api.js'
import { useResource } from '../../lib/useResource.js'

/** 요청함 카드 전부의 `답변·확인·승인 필요` 를 더한다. 뱃지는 "몇 개나 남았나" 하나다. */
function pendingTotal(inbox) {
  return (inbox?.groups ?? []).reduce((sum, group) => (
    sum + group.items.reduce((s, item) => (
      s + item.needs_answer + item.needs_confirm + item.needs_approval
    ), 0)
  ), 0)
}

/**
 * 요청함 뱃지 개수.
 *
 * `InboxPage` 와 같은 캐시 키(`inbox`)를 쓴다 — 전역 레일이든 홈 사이드바든
 * 어디서 부르든 `/me/inbox` 는 한 번만 나간다.
 *
 * 오류는 그냥 둔다. 아직 실서버에 없는 주소라 실서버 모드에서는 항상
 * 실패하는데, 뱃지 하나 때문에 화면 이동이 막힌 것처럼 보이면 안 된다.
 */
export function useInboxBadge() {
  const { data: inbox } = useResource(
    (signal) => api.get('/me/inbox', undefined, { signal }), [], { cacheKey: 'inbox' })
  return pendingTotal(inbox)
}
