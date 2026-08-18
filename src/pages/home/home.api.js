import { api } from '../../lib/api.js'

/**
 * 홈 화면이 부르는 것.
 *
 * ## 한 번에 받는다
 *
 * `GET /home` 하나가 인사·최근 회의·오늘 일정·최근 회의 요약·프로젝트 진행·
 * 사이드바를 **모두** 돌려준다. 쪼개서 부르지 않는다 — 여섯 번 부르면 화면이
 * 조각조각 채워지고, 그중 하나가 늦으면 레이아웃이 흔들린다.
 */

export function fetchHome(signal) {
  return api.get('/home', undefined, { signal })
}

/**
 * 홈 카드의 별.
 *
 * **회의 즐겨찾기와 프로젝트 즐겨찾기는 다른 것이다.** 목 데이터에서는 둘이
 * 섞여 있었지만 서버에서는 대상이 갈린다(`Favorite.Target`).
 */
export function setMeetingFavorite(meetingId, on) {
  const path = `/meetings/${meetingId}/favorite`
  return on ? api.put(path) : api.delete(path)
}

/**
 * 불참 등록 / 해제.
 *
 * 토글인데 POST 인 이유는 서버 쪽 사정이다 — 켜는 시점에 대리인 설정 스냅샷을
 * 남기고 참석 상태까지 함께 바꾼다.
 *
 * `sources` 는 **이 회의에서 대리인이 근거로 쓸 자료 종류**다. 빈 배열은
 * "아무것도 쓰지 않는다" 는 뜻이고 제한 없음이 아니다.
 *
 * `prompt` 는 **반드시 함께 보낸다.** 서버가 키의 유무를 가리지 않고
 * `prompt` 를 빈 문자열로 덮어쓰기 때문에, 빼면 이미 저장돼 있던 사전 지시가
 * 저장 한 번에 지워진다.
 */
export function setDelegation(meetingId, { enabled, sources, prompt }) {
  return api.post(`/meetings/${meetingId}/delegate`, { enabled, sources, prompt })
}

/**
 * 브리핑 팝업의 결과.
 *
 * `always_open` 은 **다음에도 홈에 들어오면 바로 열지**다. 취소를 눌러도
 * 이 값은 저장한다 — 체크박스는 "지금 볼 것인가" 가 아니라 "앞으로 어떻게
 * 할 것인가" 라 두 결정이 다르다.
 */
export function dismissBriefing(alwaysOpen) {
  return api.post('/me/briefing-dismiss', { always_open: alwaysOpen })
}

// ─────────────────────────────────────────── 홈의 AI 채팅 dock
//
// 채팅 화면의 방(`/chat/rooms/...`)과 **다른 것**이다. 이쪽은 대리인과 나
// 둘뿐인 대화(`/me/agent/conversations`)라 상대도 읽음도 없다. 같은 화면처럼
// 보인다고 방 API 로 합치면 참여자 없는 방이 생긴다.

export function fetchConversations(signal) {
  return api.get('/me/agent/conversations', undefined, { signal })
}

export function createConversation(title) {
  return api.post('/me/agent/conversations', { title })
}

export function fetchConversationMessages(conversationId, signal) {
  return api.get(`/me/agent/conversations/${conversationId}/messages`, undefined, { signal })
}

/**
 * 보내기.
 *
 * **응답은 202 다.** 서버는 메시지를 받아 두기만 하고 대리인의 답은 나중에
 * 만든다(`run.status: "RECEIVED"`). 그래서 이 함수가 돌아왔다고 답이 온 것이
 * 아니다 — 부르는 쪽이 기다리는 중임을 화면에 남겨야 한다.
 */
export function sendAgentMessage(conversationId, body) {
  return api.post(`/me/agent/conversations/${conversationId}/messages`, { body })
}

// ─────────────────────────────────────────── 프로젝트 추가
//
// 프로젝트는 팀 밑에 생긴다. 홈 응답에는 프로젝트가 있는 팀만 실려 오므로,
// 팀 목록은 팝업을 열 때 따로 읽는다 — 프로젝트가 하나도 없는 팀에
// 첫 프로젝트를 만드는 것이 이 버튼을 누르는 가장 흔한 이유다.

export function fetchTeams(signal) {
  return api.get('/teams', undefined, { signal })
}

export function createProject(teamId, name) {
  return api.post(`/teams/${teamId}/projects`, { name })
}

/**
 * 팀을 새로 만든다. 만든 사람이 소유자가 되고 팀원 1명으로 시작한다.
 *
 * 이것이 없으면 **가입만 하고 아무 데도 속하지 않은 사람은 빠져나갈 길이
 * 없다.** 홈이 전부 0 으로 뜨는데 팀을 만들 버튼도, 초대 코드를 넣을 칸도
 * 화면에 없었다. 서버에는 처음부터 있던 기능이다.
 */
export function createTeam(name) {
  return api.post('/teams', { name })
}

/** 받은 초대 코드로 팀에 들어간다. 코드 모양은 `BRD-A1B2-C3D4`. */
export function joinTeam(code) {
  return api.post('/teams/join', { code })
}
