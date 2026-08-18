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

export function fetchTeamMembers(teamId, signal) {
  return api.get(`/teams/${teamId}/members`, undefined, { signal })
}

/**
 * 팀 하나의 프로젝트 목록.
 *
 * 명세가 이 주소를 짚어 둔 두 자리 중 하나가 **팀 변경 팝오버의
 * `팀 A → 프로젝트 1, 프로젝트 2` 미리보기**다(다른 하나는 사이드바를
 * 펼쳤을 때). `TeamSwitchDialog` 가 이것으로 미리보기를 채운다.
 */
export function fetchTeamProjects(teamId, signal) {
  return api.get(`/teams/${teamId}/projects`, undefined, { signal })
}

/**
 * 새 프로젝트.
 *
 * ## 서버가 아직 모르는 칸이 있다
 *
 * 시안(`707:5617` · `707:5739`)은 **진행기간과 프로젝트 목표**를 받는데,
 * `POST /teams/{team_id}/projects` 가 받는 것은 `name` · `description` ·
 * `member_ids` 뿐이다.
 *
 * `CLAUDE.md` 의 순서(화면이 계약을 주도한다)대로 **보낼 것은 그대로 보낸다** —
 * 지금 서버는 모르는 필드를 무시하므로 저장은 아직 안 되고, 백엔드가
 * `goal` · `period_start` · `period_end` 를 받으면 그 순간부터 저장된다.
 * 여기서 값을 빼 버리면 나중에 화면·API 양쪽을 다시 손봐야 한다.
 *
 * `member_ids` 를 안 실으면 **팀 전원**이 들어간다(서버 기본값). 참여자를
 * 고른 경우에만 싣는다 — 빈 배열을 보내면 아무도 없는 프로젝트가 된다.
 */
export function createProject(teamId, { name, description, goal, memberIds, periodStart, periodEnd }) {
  return api.post(`/teams/${teamId}/projects`, {
    name,
    ...(description ? { description } : {}),
    ...(goal ? { goal } : {}),
    ...(periodStart ? { period_start: periodStart } : {}),
    ...(periodEnd ? { period_end: periodEnd } : {}),
    ...(memberIds?.length ? { member_ids: memberIds } : {}),
  })
}

// ─────────────────────────────────────────── 회의 일정 추가

/**
 * 회의 일정 추가(시안 `692:8292`).
 *
 * `POST /projects/{project_id}/meetings` 는 **고정 시각 하나**만 받는다 —
 * 후보를 여럿 던지고 참여자가 고르는 식이 아니다. 시안의 "가능한 시간을
 * 모두 입력해주세요" 는 그래서 여러 후보가 아니라 **그 날짜의 시작~끝**으로
 * 읽는다 — `duration_min` 이 그 차이다.
 *
 * `participant_ids` 를 안 실으면 서버가 알아서 채우는 값이 없다(프로젝트와
 * 달리 기본값이 "전원" 이 아니다) — 최소 회의를 만든 사람은 넣어야 한다.
 */
export function createMeeting(projectId, { title, scheduledAt, durationMin, participantIds }) {
  return api.post(`/projects/${projectId}/meetings`, {
    title,
    scheduled_at: scheduledAt,
    duration_min: durationMin,
    participant_ids: participantIds,
  })
}

/**
 * 초대 코드.
 *
 * **팀을 만든 뒤에만 부를 수 있다** — 코드는 팀에 매달려 나온다. 시안은 팀을
 * 만들기 전 화면에 코드를 그려 뒀는데, 그 자리에 그럴듯한 문자열을 띄우면
 * 복사해서 공유한 코드가 아무 데도 안 닿는다.
 */
export function createInviteCode(teamId) {
  return api.post(`/teams/${teamId}/invite-codes`, {
    expires_in_hours: 72,
    max_uses: 10,
    default_role: 'MEMBER',
  })
}

/**
 * 팀을 새로 만든다. 만든 사람이 소유자가 되고 팀원 1명으로 시작한다.
 *
 * 이것이 없으면 **가입만 하고 아무 데도 속하지 않은 사람은 빠져나갈 길이
 * 없다.** 홈이 전부 0 으로 뜨는데 팀을 만들 버튼도, 초대 코드를 넣을 칸도
 * 화면에 없었다. 서버에는 처음부터 있던 기능이다.
 */
export function createTeam(name, { description, timezone } = {}) {
  /*
    `timezone` 도 서버 계약에 없다. 팀의 **기준 시간대**는 이 서비스의 전제
    (사람마다 하루를 자르는 기준이 다르다)와 직결되는 값이라, 화면에서 받은
    것을 그대로 실어 보내고 백엔드가 받게 한다.
  */
  return api.post('/teams', {
    name,
    ...(description ? { description } : {}),
    ...(timezone ? { timezone } : {}),
  })
}

/** 받은 초대 코드로 팀에 들어간다. 코드 모양은 `BRD-A1B2-C3D4`. */
export function joinTeam(code) {
  return api.post('/teams/join', { code })
}

// ─────────────────────────────────────────── 확정된 일정 확인 팝업
//
// 팝업(시안 `697:9393`)은 두 곳에서 값을 모은다.
//
//     header   GET /meetings/{id}/prep   team_name · project_name · when · badge
//     참여자    GET /meetings/{id}       participants[].name
//
// `when` · `badge` 는 홈의 대리 참석 버튼 · 준비 화면과 같은 문구를 서버가
// 조립해 준다 — 여기서 다시 만들면 화면마다 "대리 참석 예정" 이 갈린다.

export function fetchMeetingPrepHeader(meetingId, signal) {
  return api.get(`/meetings/${meetingId}/prep`, undefined, { signal }).then((body) => body?.header ?? null)
}

export function fetchMeetingParticipants(meetingId, signal) {
  return api.get(`/meetings/${meetingId}`, undefined, { signal }).then((body) => body?.participants ?? [])
}
