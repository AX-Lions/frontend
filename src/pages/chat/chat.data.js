import { api } from '../../lib/api.js'

/**
 * 채팅과 대리인 설정이 부르는 것.
 *
 * ## 사이드바는 서버가 다 세어 준다
 *
 * 미읽음 합계와 중요 표시 여부는 팀·프로젝트 단위까지 서버가 계산해 내려준다.
 * 클라이언트가 방을 순회해 더하면 **내가 안 들어간 방을 빠뜨려** 숫자가 어긋난다.
 */

export function fetchSidebar(signal) {
  return api.get('/chat/sidebar', undefined, { signal })
}

export function fetchImportant(signal) {
  return api.get('/chat/important', undefined, { signal })
}

export function fetchMessages(roomId, signal) {
  return api.get(`/chat/rooms/${roomId}/messages`, undefined, { signal })
}

/**
 * 보내기.
 *
 * `client_message_id` 를 반드시 실어 보낸다. `Idempotency-Key` 는 계약에만 있고
 * 아직 동작하지 않아서, 중복 전송은 **도메인 키로 막는다.** 백엔드가
 * `(room, client_message_id)` 를 유니크로 잡아 두었다.
 *
 * 전송 버튼을 두 번 눌렀거나 네트워크가 끊겨 재시도한 경우, 이 값이 없으면
 * 같은 말이 두 번 남는다.
 */
export function sendMessage(roomId, body, clientMessageId) {
  return api.post(`/chat/rooms/${roomId}/messages`, {
    body,
    client_message_id: clientMessageId,
  })
}

export function markRead(roomId) {
  return api.post(`/chat/rooms/${roomId}/read`)
}

export function fetchAgentSettings(signal) {
  return api.get('/me/agent/settings', undefined, { signal })
}

export function patchAgentSettings(patch) {
  return api.patch('/me/agent/settings', patch)
}

export function fetchPrompts(signal) {
  return api.get('/me/agent/prompts', undefined, { signal })
}

export function createPrompt(body) {
  return api.post('/me/agent/prompts', { body })
}

export function deletePrompt(promptId) {
  return api.delete(`/me/agent/prompts/${promptId}`)
}

/**
 * 사이드바 트리를 화면이 쓰는 목록으로 편다.
 *
 * 서버는 `팀 → 프로젝트 → 방` 3층으로 준다. 화면도 3층이라 구조는 그대로 두고,
 * 각 층에서 필요한 것만 뽑는다.
 */
export function toTeamRows(sidebar) {
  return (sidebar?.teams ?? []).map((team) => ({
    id: team.team_id,
    name: team.team_name,
    unread: team.unread_count,
    marked: team.has_important,
    groupRoomId: team.group_chat_room_id,
    projects: (team.projects ?? []).map((project) => ({
      id: project.project_id,
      name: project.project_name,
      unread: project.unread_count,
      marked: project.has_important,
      groupRoomId: project.group_chat_room_id,
      rooms: (project.rooms ?? []).map(toPreview),
    })),
  }))
}

/**
 * 방 하나를 미리보기 카드 모양으로.
 *
 * `title` 은 서버가 방 종류에 맞게 만들어 준다 — 1:1 은 상대 이름, 대리인 방은
 * `{이름}의 Bordo` 다. 화면이 종류별로 이름을 조립하면 규칙이 두 군데로 갈린다.
 */
export function toPreview(room) {
  return {
    id: room.id,
    type: room.type,
    name: room.title,
    context: room.path_label || undefined,
    message: room.last_message
      ? `${room.last_message.sender_name}: ${room.last_message.preview}`
      : '',
    sentAt: room.last_message?.sent_at ?? null,
    unread: room.unread_count,
    marked: room.has_important,
    avatar: room.avatar_urls?.[0] ?? null,
    bordo: room.type === 'AI' || room.type === 'PEER_AGENT',
    stacked: room.type === 'PROJECT' || room.type === 'TEAM',
  }
}
