/**
 * 회의 일정(`GET /projects/{id}/calendar/events`)의 가상 데이터.
 *
 * 오늘을 기준으로 앞뒤로 흩어 둔다(`daysAgo` — 음수는 미래). 고정된 날짜를
 * 박으면 하루만 지나도 이번 달 달력이 텅 비어 화면을 볼 이유가 없어진다.
 */

import { PROJECTS, daysAgo, person } from './people.js'

/*
  `meetings.js` · `flow.js` 와 같은 값이어야 한다. 셋 다 손으로 옮겨 적는
  이유는 그 두 파일에 있다 — 여기서 그중 하나라도 새 값을 지어내면 브리핑의
  「실제 일정에서 보기」가 엉뚱한 회의나 화살표를 연다.
*/
const MEETING_GLOBAL = 'b1a11546-5743-46d4-b052-06407fb69c3c'
const MEETING_BOOTH = '2f5c1d47-9b0a-4e3c-8f61-7a4d2c9e0b13'

function event({
  id, project, title, kind = 'MEETING', offsetDays, hour, endHour, status = 'CONFIRMED', participants = [],
  relatedMeeting = null, relatedEdgeId = null,
}) {
  return {
    id,
    project_id: project.id,
    title,
    kind,
    start_at: daysAgo(offsetDays, hour, 0),
    end_at: daysAgo(offsetDays, endHour ?? hour + 1, 0),
    status,
    participant_ids: participants.map((name) => person(name).id),
    // 대부분 `null` 이다 — 실서버도 거의 이 값을 못 채운다(`ConfirmedScheduleDialog`
    // 참고). 회의가 실제로 만든 변경만, 그 발언(`related_edge_id`)까지 함께 채운다.
    related_meeting: relatedMeeting,
    related_edge_id: relatedEdgeId,
    discord_notified: status === 'CONFIRMED',
  }
}

export const calendarEvents = [
  event({
    id: 'evt-1', project: PROJECTS.bordo, title: '기능 범위 확정 회의',
    offsetDays: -2, hour: 14, endHour: 15,
    participants: ['유수인', '최비성', '임수연'],
  }),
  event({
    id: 'evt-2', project: PROJECTS.bordo, title: 'API 스펙 정렬',
    offsetDays: 1, hour: 10, endHour: 11, status: 'SCHEDULED',
    participants: ['최비성', '서재민'],
  }),
  event({
    id: 'evt-3', project: PROJECTS.academy, title: '부스 운영 인원 배치',
    offsetDays: 3, hour: 17, endHour: 18,
    participants: ['서재민', '강다은'],
    // `연합학술제 부스 운영 킥오프` 회의에서 유수인의 Bordo 가 확정한 2교대
    // 배치(`meeting-booth-4`) 가 실제로 만든 일정.
    relatedMeeting: MEETING_BOOTH, relatedEdgeId: 'meeting-booth-4',
  }),
  event({
    id: 'evt-4', project: PROJECTS.bordo, title: '디자인 시안 마감',
    kind: 'DEADLINE', offsetDays: -1, hour: 18, endHour: 18,
    participants: ['임수연'],
    // 글로벌 회의에서 앞당긴 시안 마감(`meeting-edge-30`) 이 실제로 만든 일정.
    relatedMeeting: MEETING_GLOBAL, relatedEdgeId: 'meeting-edge-30',
  }),
  event({
    id: 'evt-7', project: PROJECTS.bordo, title: 'API 연동 완료',
    kind: 'DEADLINE', offsetDays: -9, hour: 18, endHour: 18,
    participants: ['서재민'],
    // 같은 회의에서 유보한 일정 연장(`meeting-edge-32`) 이 사람 확인 뒤 실제로
    // 반영된 결과. 유보였다고 일정 자체가 안 생기는 것은 아니다 — 사람이
    // 확인해서 결국 8/30 으로 확정했다.
    relatedMeeting: MEETING_GLOBAL, relatedEdgeId: 'meeting-edge-32',
  }),
  event({
    id: 'evt-5', project: PROJECTS.academy, title: '발표 리허설',
    offsetDays: 6, hour: 15, endHour: 16, status: 'SCHEDULED',
    participants: ['강다은', '유수인'],
  }),
  event({
    id: 'evt-6', project: PROJECTS.bordo, title: '정기 팀 회의',
    offsetDays: -8, hour: 18, endHour: 19,
    participants: ['유수인', '최비성', '임수연', '서재민', '강다은'],
  }),
]
