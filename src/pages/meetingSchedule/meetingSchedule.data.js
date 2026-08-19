import { api } from '../../lib/api.js'

/**
 * 회의 일정(시안 `692:7910`)이 부르는 것.
 *
 * `GET /projects/{project_id}/calendar/events` 는 **프로젝트 하나**의 일정만
 * 준다 — 팀·계정을 가로지르는 자리가 명세에 없다. 그래서 달력 화면은 보이는
 * 달의 범위로 프로젝트마다 한 번씩 불러 합친다(`useMonthEvents.js`).
 */
export function fetchCalendarEvents(projectId, { from, to }, signal) {
  return api.get(`/projects/${projectId}/calendar/events`, { from, to }, { signal })
}

/**
 * 일정 추가하기.
 *
 * `notify_discord: true` 를 늘 실어 보낸다 — 팀 일정인데 Discord 로 안 알리면
 * 캘린더에만 잡히고 아무도 못 본다. 서버는 트랜잭션 안에서 직접 부르지 않고
 * Outbox 에 넣기만 하므로, 여기서 켜 둔다고 요청이 느려지지 않는다.
 */
export function createCalendarEvent(projectId, { title, startAt, endAt, participantIds }) {
  return api.post(`/projects/${projectId}/calendar/events`, {
    title,
    start_at: startAt,
    end_at: endAt,
    ...(participantIds?.length ? { participant_ids: participantIds } : {}),
    notify_discord: true,
  })
}
