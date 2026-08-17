import { api } from '../../lib/api.js'

/**
 * 플로우 화면이 부르는 것.
 *
 * `flowBoard.api.js` 는 이름과 달리 아이콘·라벨 상수와 목 데이터를 담고 있다.
 * 실제 호출은 여기로 모은다 — 둘을 섞으면 목이 언제 사라졌는지 알 수 없다.
 *
 * ## 회의 모드와 작업 모드는 경로가 다르다
 *
 *     회의   GET /meetings/{id}/flow          회의 하나가 스코프
 *     작업   GET /projects/{id}/flow?from&to  **기간**이 스코프
 *
 * 작업 화살표에는 회의가 없다. 화면 헤더가 `8.10 - 8.16 작업 흐름` 인 것과 같은
 * 이유다. 같은 경로에 `category=WORK` 를 붙여 물으면 **무엇을 넣든 0건**이다.
 *
 * 응답 모양은 `meeting_label` 이 `period_label` 로 바뀌는 것 말고 같다. 차트
 * 렌더러를 하나만 만들면 되도록 백엔드가 맞춰 둔 것이다.
 */

/** 서버의 `content_type` → 화면의 tone. 뱃지 색과 아이콘이 여기에 걸려 있다. */
export const TONE_OF = {
  OPINION: 'opinion',
  REQUEST: 'request',
  CHANGE: 'change',
  SCHEDULE: 'schedule',
  CONCLUSION: 'conclusion',
  ETC: 'etc',
}

export function toneOf(contentType) {
  return TONE_OF[contentType] ?? 'etc'
}

/**
 * 목록 필터를 쿼리로 옮긴다.
 *
 * 비어 있으면 **아예 보내지 않는다.** 빈 문자열을 보내면 백엔드가 "그런 값을 가진
 * 것" 을 찾아 0건이 되고, 화면은 아무것도 안 고른 것과 전부 고른 것을 구별하지
 * 못하게 된다.
 */
function listParam(values) {
  return values && values.length ? values.join(',') : undefined
}

export function fetchMeetingFlow(meetingId, { participantIds, contentTypes } = {}, signal) {
  return api.get(`/meetings/${meetingId}/flow`, {
    category: 'MEETING',
    participant_ids: listParam(participantIds),
    content_types: listParam(contentTypes),
  }, { signal })
}

export function fetchProjectFlow(projectId, { from, to, participantIds, contentTypes, sources } = {}, signal) {
  return api.get(`/projects/${projectId}/flow`, {
    from,
    to,
    participant_ids: listParam(participantIds),
    content_types: listParam(contentTypes),
    sources: listParam(sources),
  }, { signal })
}

export function fetchMeeting(meetingId, signal) {
  return api.get(`/meetings/${meetingId}`, undefined, { signal })
}

export function fetchIndexes(meetingId, category, signal) {
  return api.get(`/meetings/${meetingId}/indexes`, { category }, { signal })
}

export function fetchSummaryTable(meetingId, signal) {
  return api.get(`/meetings/${meetingId}/summary-table`, undefined, { signal })
}

export function fetchBriefing(meetingId, signal) {
  return api.get(`/meetings/${meetingId}/ai-briefing`, undefined, { signal })
}

export function fetchEdge(edgeId, signal) {
  return api.get(`/flow-edges/${edgeId}`, undefined, { signal })
}

/**
 * 어느 회의를 열지.
 *
 * 홈에서 넘어오면 주소에 실려 있다. 주소로 바로 들어온 경우에는 **가장 최근
 * 회의**로 연다. 회의를 고르라고 빈 화면을 띄우면, 이 서비스가 처음 묻는 질문이
 * "내가 없는 동안 무슨 일이 있었지" 인데 그 답을 한 단계 뒤로 미루게 된다.
 */
export async function resolveMeetingId(signal) {
  const fromUrl = new URLSearchParams(window.location.search).get('meeting')
  if (fromUrl) {
    return fromUrl
  }

  const home = await api.get('/home', undefined, { signal })
  // `recent_meeting_summary` 는 **끝난 회의**만 채워진다. 예정된 회의밖에 없는
  // 팀은 그것이 비어 있어서, 그 값만 보면 열 회의가 없다고 판단해 버린다.
  // 최근 회의 목록으로 한 번 더 내려본다.
  return home?.recent_meeting_summary?.meeting_id
    ?? home?.recent_meetings?.[0]?.meeting_id
    ?? null
}
