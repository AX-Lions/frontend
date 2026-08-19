/**
 * 회의 일정(`GET /projects/{id}/calendar/events`)의 가상 데이터.
 *
 * 오늘을 기준으로 앞뒤로 흩어 둔다(`daysAgo` — 음수는 미래). 고정된 날짜를
 * 박으면 하루만 지나도 이번 달 달력이 텅 비어 화면을 볼 이유가 없어진다.
 */

import { PROJECTS, daysAgo, person } from './people.js'

function event({ id, project, title, kind = 'MEETING', offsetDays, hour, endHour, status = 'CONFIRMED', participants = [] }) {
  return {
    id,
    project_id: project.id,
    title,
    kind,
    start_at: daysAgo(offsetDays, hour, 0),
    end_at: daysAgo(offsetDays, endHour ?? hour + 1, 0),
    status,
    participant_ids: participants.map((name) => person(name).id),
    related_meeting: null,
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
  }),
  event({
    id: 'evt-4', project: PROJECTS.bordo, title: '디자인 시안 마감',
    kind: 'DEADLINE', offsetDays: -1, hour: 18, endHour: 18,
    participants: ['임수연'],
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
