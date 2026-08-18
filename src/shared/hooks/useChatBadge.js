import { api } from '../../lib/api.js'
import { useResource } from '../../lib/useResource.js'

/**
 * 채팅 미읽음 합계.
 *
 * `ChatPage` 와 같은 캐시 키(`chat-sidebar`)를 쓴다 — 채팅 화면에 이미 있는
 * `GET /chat/sidebar` 를 다시 부르는 것이라 새 주소를 만들지 않는다. 합계는
 * 서버가 팀·프로젝트 단위까지 세어 `total_unread` 로 내려준다(`chat.data.js`
 * 참고) — 방을 순회해 다시 더하면 내가 안 들어간 방을 빠뜨려 어긋난다.
 *
 * 오류는 그냥 둔다. 뱃지 하나 때문에 화면 이동이 막힌 것처럼 보이면 안 된다.
 */
export function useChatBadge() {
  const { data: sidebar } = useResource(
    (signal) => api.get('/chat/sidebar', undefined, { signal }), [], { cacheKey: 'chat-sidebar' })
  return sidebar?.total_unread ?? 0
}
