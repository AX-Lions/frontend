import { api } from '../../lib/api.js'
import { getAccessToken } from '../../lib/auth.js'

/**
 * 채팅과 대리인 설정이 부르는 것.
 *
 * ## 사이드바는 서버가 다 세어 준다
 *
 * 미읽음 합계와 중요 표시 여부는 팀·프로젝트 단위까지 서버가 계산해 내려준다.
 * 클라이언트가 방을 순회해 더하면 **내가 안 들어간 방을 빠뜨려** 숫자가 어긋난다.
 *
 * ## 여기 있는 것이 곧 화면이 할 수 있는 일이다
 *
 * 백엔드 채팅 라우트 17개 중 13개가 이 파일에 없어서, 화면에 버튼만 있고
 * 눌러도 아무 일이 없었다. 라우트를 빠짐없이 적어 두면 "이건 서버에 없어서
 * 못 한다" 와 "잇는 것을 잊었다" 를 구분할 수 있다.
 */

// ─────────────────────────────────────────── 목록
export function fetchSidebar(signal) {
  return api.get('/chat/sidebar', undefined, { signal })
}

/**
 * 지금 자리에 있는지. `ACTIVE` · `AWAY`
 *
 * 서버 상태다. 브라우저에만 두면 창을 닫는 순간 내 Bordo 가 다시 조용해지는데,
 * **자리를 비운다는 것은 브라우저를 닫는 일**이라 그러면 기능 자체가 성립하지
 * 않는다.
 */
export function fetchPresence(signal) {
  return api.get('/me/presence', undefined, { signal })
}

export function setPresence(status) {
  return api.patch('/me/presence', { status })
}

/**
 * 자리를 비운 사이 내 Bordo 가 대신 나눈 대화.
 *
 * 좌측 목록의 `중요 채팅` 자리를 이것이 가져갔다. 그쪽은 **내가 미리 별을 찍어
 * 둔 것**만 모이는데, 자리를 비우기 전에 무엇이 중요해질지 알 수 있으면 애초에
 * 자리를 안 비웠을 것이다. 돌아와서 가장 먼저 봐야 하는 것은 내가 없는 동안
 * 오간 말이다.
 */
export function fetchAwayHandled(signal) {
  return api.get('/chat/away-handled', undefined, { signal })
}

export function fetchImportant(signal) {
  return api.get('/chat/important', undefined, { signal })
}

/** `새 채팅 → 대화상대 선택`. `type` 을 주면 대리인이 없는 사람은 빠진다. */
export function fetchCandidates({ query, type } = {}, signal) {
  return api.get('/chat/candidates', { query, type }, { signal })
}

// ─────────────────────────────────────────── 방
/**
 * 방 하나를 그 자체로 읽는다.
 *
 * 사이드바 트리에 없는 방도 열릴 수 있다 — 주소(`/chat?room=<id>`)로 들어온
 * 방, 팀 단체방(`group_chat_room_id` 만 오고 방 객체가 없다)이 그렇다. 트리에서
 * 못 찾은 방은 제목 칸이 비어 어느 대화인지 알 수 없으므로 한 번 더 읽는다.
 */
export function fetchRoom(roomId, signal) {
  return api.get(`/chat/rooms/${roomId}`, undefined, { signal })
}

export function createRoom(payload) {
  return api.post('/chat/rooms', payload)
}

export function renameRoom(roomId, title) {
  return api.patch(`/chat/rooms/${roomId}`, { title })
}

/**
 * 나가기.
 *
 * 서버가 방 종류를 보고 `LEFT`(단체방에서 빠짐) 또는 `HIDDEN`(1:1 을 내 목록에서만
 * 감춤)을 돌려준다. 둘은 되돌릴 수 있는지가 다르므로 화면이 결과를 그대로 읽어
 * 안내한다 — 클라이언트가 종류로 미리 단정하면 서버 규칙이 바뀔 때 어긋난다.
 */
export function leaveRoom(roomId) {
  return api.delete(`/chat/rooms/${roomId}`)
}

// ─────────────────────────────────────────── 메시지
/**
 * 메시지 한 페이지.
 *
 * `date` 와 `before` 는 함께 못 쓴다(서버가 400 을 준다). 달력으로 뛰는 것과
 * 위로 이어 보는 것은 기준점이 달라서다.
 */
export function fetchMessages(roomId, { before, date, limit } = {}, signal) {
  return api.get(`/chat/rooms/${roomId}/messages`, { before, date, limit }, { signal })
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
export function sendMessage(roomId, { body, clientMessageId, attachmentIds, isImportant }) {
  return api.post(`/chat/rooms/${roomId}/messages`, {
    body,
    client_message_id: clientMessageId,
    attachment_ids: attachmentIds?.length ? attachmentIds : undefined,
    is_important: isImportant || undefined,
  })
}

export function editMessage(messageId, body) {
  return api.patch(`/chat/messages/${messageId}`, { body })
}

/** 지워도 자리는 남는다. 서버가 본문만 비우고 `deleted_at` 을 채워 돌려준다. */
export function deleteMessage(messageId) {
  return api.delete(`/chat/messages/${messageId}`)
}

export function markRead(roomId) {
  return api.post(`/chat/rooms/${roomId}/read`)
}

// ─────────────────────────────────────────── 중요 표시 · 확인
export function setMessageImportant(messageId, isImportant) {
  return api.patch(`/chat/messages/${messageId}/important`, { is_important: isImportant })
}

/**
 * 확인.
 *
 * **표시를 내리는 것과 다르다.** `is_important` 는 true 로 남고 내 확인 기록만
 * 생겨서, 상단 `중요 채팅` 에서만 빠진다. 같은 메시지가 다른 사람 화면에는
 * 그대로 남아 있는 것이 정상이다.
 */
export function confirmMessageImportant(messageId) {
  return api.post(`/chat/messages/${messageId}/important/confirm`)
}

// ─────────────────────────────────────────── 달력 · 검색 · 요약
export function fetchActiveDates(roomId, month, signal) {
  return api.get(`/chat/rooms/${roomId}/active-dates`, { month }, { signal })
}

export function searchMessages(roomId, q, signal) {
  return api.get(`/chat/rooms/${roomId}/search`, { q }, { signal })
}

export function fetchDailySummary(roomId, date, signal) {
  return api.get(`/chat/rooms/${roomId}/daily-summary`, { date }, { signal })
}

// ─────────────────────────────────────────── 첨부
/**
 * 파일 올리기.
 *
 * `lib/api.js` 는 본문을 늘 `JSON.stringify` 한다. 멀티파트를 태울 길이 없어서
 * 여기서만 `fetch` 를 직접 부른다. 그래서 **401 자동 갱신을 못 탄다** — 토큰이
 * 막 만료된 순간에 올리면 한 번 실패한다.
 *
 * 원래는 `lib/api.js` 가 `FormData` 를 알아보고 `Content-Type` 을 안 붙이면
 * 끝나는 일인데, 그 파일은 이번 작업의 소유 범위 밖이라 손대지 않았다.
 */
export async function uploadAttachment(roomId, file) {
  const form = new FormData()
  form.append('file', file)

  const token = getAccessToken()
  const response = await fetch(`/api/v1/chat/rooms/${roomId}/attachments`, {
    method: 'POST',
    // `Content-Type` 을 직접 넣으면 안 된다. 브라우저가 붙이는 `boundary` 가
    // 사라져 서버가 본문을 못 가른다.
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })

  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null
  if (!response.ok) {
    // 규약대로 `error.message` 를 그대로 올린다. 화면이 문구를 새로 만들면
    // 같은 상황에 두 가지 안내가 생긴다.
    const error = new Error(parsed?.error?.message || '파일을 올리지 못했습니다.')
    error.code = parsed?.error?.code || 'UNKNOWN'
    throw error
  }
  return parsed
}

export function deleteAttachment(attachmentId) {
  return api.delete(`/chat/attachments/${attachmentId}`)
}

// ─────────────────────────────────────────── 대리인 설정
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

export function updatePrompt(promptId, body) {
  return api.patch(`/me/agent/prompts/${promptId}`, { body })
}

export function deletePrompt(promptId) {
  return api.delete(`/me/agent/prompts/${promptId}`)
}

// ─────────────────────────────────────────── 트리 다루기
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
    projects: (team.projects ?? []).map((project) => ({
      id: project.project_id,
      name: project.project_name,
      unread: project.unread_count,
      marked: project.has_important,
      rooms: (project.rooms ?? []).map(toPreview),
    })),
  }))
}

/** 어느 팀·프로젝트에도 안 매달린 1:1 · 동료 대리인 방. */
export function toDirectRows(sidebar) {
  return (sidebar?.direct_rooms ?? []).map(toPreview)
}

/**
 * 방 하나를 미리보기 카드 모양으로.
 *
 * `title` 은 서버가 방 종류에 맞게 만들어 준다 — 1:1 은 상대 이름, 대리인 방은
 * `{이름}의 Bordo` 다. 화면이 종류별로 이름을 조립하면 규칙이 두 군데로 갈린다.
 */
export function toPreview(room) {
  if (!room) {
    return null
  }
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
    // 서버가 참여자 아바타를 최대 4장 준다. 예전에는 여기 자리에 목 이미지
    // 세 장(`/flowchart/profile-N.jpeg`)이 박혀 있어서, 어느 방이든 같은
    // 세 사람 얼굴이 떴다.
    avatars: room.avatar_urls ?? [],
    avatar: room.avatar_urls?.[0] ?? null,
    bordo: room.type === 'AI' || room.type === 'PEER_AGENT',
    stacked: room.type === 'PROJECT' || room.type === 'TEAM',
    // 방 머리의 `그곳 시각` 줄이 쓴다. 없는 방(목록에만 있는 옛 응답)은
    // 빈 배열이라 그 줄이 통째로 안 그려진다.
    members: room.members ?? [],
  }
}

/**
 * 읽은 방의 미읽음을 트리에서 덜어 낸다.
 *
 * `markRead` 는 부르고 있었는데 사이드바 숫자는 그대로였다. 방을 열어도 뱃지가
 * 남으니 사용자는 안 읽힌 줄 안다.
 *
 * 이건 **눈에 보이는 것만 맞추는 계산**이다. 팀·프로젝트 합계는 하위 방의 단순
 * 합이라 뺄셈이 서버 계산과 같지만, 팀 단체방처럼 트리에 방 객체가 없는
 * 경우(`group_chat_room_id` 만 온다)는 몇 건이 읽혔는지 여기서 알 수 없다.
 *
 * 그래서 화면은 이 계산을 **먼저 칠하는 용도로만** 쓰고, 서버 값은 사이드바를
 * 다시 읽어 덮는다. 뺄셈만 믿으면 위 경우에 뱃지가 영영 안 사라지고, 다시 읽기만
 * 하면 방을 옮길 때마다 뱃지가 한 박자 늦게 꺼진다.
 */
export function clearRoomUnread(sidebar, roomId) {
  if (!sidebar) {
    return sidebar
  }

  const readCount = (room) => (room?.id === roomId ? room.unread_count || 0 : 0)
  const clear = (room) => (readCount(room) ? { ...room, unread_count: 0 } : room)

  let removed = 0
  const teams = (sidebar.teams ?? []).map((team) => {
    let teamRemoved = 0
    const projects = (team.projects ?? []).map((project) => {
      const projectRemoved = (project.rooms ?? []).reduce((sum, r) => sum + readCount(r), 0)
      if (!projectRemoved) {
        return project
      }
      teamRemoved += projectRemoved
      return {
        ...project,
        rooms: project.rooms.map(clear),
        unread_count: Math.max(0, project.unread_count - projectRemoved),
      }
    })

    if (!teamRemoved) {
      return team
    }
    removed += teamRemoved
    return { ...team, projects, unread_count: Math.max(0, team.unread_count - teamRemoved) }
  })

  removed += (sidebar.direct_rooms ?? []).reduce((sum, r) => sum + readCount(r), 0)
  removed += readCount(sidebar.my_agent_room)

  return {
    ...sidebar,
    teams,
    direct_rooms: (sidebar.direct_rooms ?? []).map(clear),
    my_agent_room: clear(sidebar.my_agent_room),
    total_unread: Math.max(0, (sidebar.total_unread ?? 0) - removed),
  }
}
