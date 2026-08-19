import { api } from '../../lib/api.js'

/**
 * 홈의 `+` 가 이 화면으로 넘길 때 다는 쿼리 이름.
 *
 * 홈에서 팝업을 직접 띄우지 않고 여기로 보내는 이유는 `HomePage` 쪽 주석에
 * 적어 뒀다. 이름을 양쪽에 따로 적으면 한쪽만 고쳤을 때 **버튼을 눌러도 팝업이
 * 안 뜨는데 주소는 바뀌어 있는** 상태가 된다.
 */
export const NEW_EVENT_PARAM = 'new'

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
