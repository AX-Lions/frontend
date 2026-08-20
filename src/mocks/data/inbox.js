/**
 * 내 요청함(`GET /me/inbox`)의 가상 데이터.
 *
 * 아직 백엔드에 이 데이터를 모아 주는 자리가 없다. 회의별로 흩어져 있는
 * `답변 필요`(AI 브리핑) · `확인 필요` · `승인 필요`(정책 승인) 를 날짜별로 모아
 * 보여 주는 새 화면이라, 이 파일이 그 형태를 먼저 정한다(`CLAUDE.md` 의
 * "화면이 계약을 주도한다").
 *
 * id 는 `home.js` · `meetings.js` 와 같은 회의를 가리킨다. 카드를 눌러
 * 플로우 화면으로 갔을 때 실제로 그 회의가 열려야 하기 때문이다.
 */

import { PROJECTS, daysAgo, teamOf } from './people.js'

const MEETING_IDS = {
  direction: 'b1a11546-5743-46d4-b052-06407fb69c3c',
  designReview: 'baf061c5-2efc-4ca8-80e5-cecc15582780',
  weekly: '4eb1040f-18d7-4841-bc72-360846888c3d',
  devSync: 'cdcd5cda-d887-47dc-91aa-4bb7393d461b',
  academyKickoff: '2f5c1d47-9b0a-4e3c-8f61-7a4d2c9e0b13',
  academyBooth: '0a3f6cd2-71b5-4d8e-9c4a-2f7b8e15d093',
  partnerSync: 'c47e9b30-5a68-4f21-8d0c-6b39f2ae7154',
}

function label(project) {
  return `${teamOf(project).name} · ${project.name}`
}

function item({ id, meetingId, title, project, needsAnswer = 0, needsConfirm = 0, pendingApprovalTaskIds = [] }) {
  return {
    id,
    meeting_id: meetingId,
    title,
    project_label: label(project),
    // 셋 중 하나라도 남아 있으면 눈에 띄어야 하니 점을 켠다.
    urgent: needsAnswer + needsConfirm + pendingApprovalTaskIds.length > 0,
    needs_answer: needsAnswer,
    needs_confirm: needsConfirm,
    // `needs_approval` 은 이 목록의 길이다 — 태스크 하나가 승인·반려되면
    // `index.js` 의 GET 처리가 다시 셀 수 있도록 id 를 들고 있는다.
    needs_approval: pendingApprovalTaskIds.length,
    pending_approval_task_ids: pendingApprovalTaskIds,
  }
}

export const inbox = {
  groups: [
    {
      date_key: daysAgo(0).slice(0, 10),
      date_label: '오늘 · 8월 19일',
      items: [
        item({
          id: 'req-1',
          meetingId: MEETING_IDS.direction,
          title: '백엔드 개발 일정 변경',
          project: PROJECTS.bordo,
          needsAnswer: 3,
          needsConfirm: 1,
        }),
        item({
          id: 'req-2',
          // 이 두 태스크는 실제로 글로벌 회의(`direction`)에서 유보한 두
          // 안건의 후속이다. `designReview` 는 아직 안 열린 회의라 근거가
          // 될 발언이 없다 — 잘못 걸려 있던 것을 바로잡는다.
          meetingId: MEETING_IDS.direction,
          title: '디자인 시안 마감 조정',
          project: PROJECTS.bordo,
          needsAnswer: 1,
          needsConfirm: 0,
          pendingApprovalTaskIds: ['task-req2-a', 'task-req2-b'],
        }),
        item({
          id: 'req-3',
          meetingId: MEETING_IDS.devSync,
          title: '결제 모듈 API 스펙 확정',
          project: PROJECTS.bordo,
          needsAnswer: 0,
          needsConfirm: 2,
        }),
        item({
          id: 'req-4',
          meetingId: MEETING_IDS.academyBooth,
          title: '부스 운영 인원 배치',
          project: PROJECTS.academy,
          needsAnswer: 2,
          needsConfirm: 0,
          pendingApprovalTaskIds: ['task-req4-a'],
        }),
        item({
          id: 'req-8',
          meetingId: MEETING_IDS.academyKickoff,
          title: '연합학술제 초록 마감일 확인',
          project: PROJECTS.academy,
          needsAnswer: 1,
          needsConfirm: 1,
          pendingApprovalTaskIds: ['task-req-a2'],
        }),
      ],
    },
    {
      date_key: daysAgo(1).slice(0, 10),
      date_label: '어제 · 8월 18일',
      items: [
        item({
          id: 'req-5',
          meetingId: MEETING_IDS.weekly,
          title: '정기 팀 회의 후속 조치',
          project: PROJECTS.bordo,
          needsAnswer: 1,
          needsConfirm: 0,
        }),
        item({
          id: 'req-6',
          meetingId: MEETING_IDS.partnerSync,
          title: '파트너 계약 조건 검토',
          project: PROJECTS.academy,
          needsAnswer: 0,
          needsConfirm: 1,
          pendingApprovalTaskIds: ['task-req6-a'],
        }),
      ],
    },
    {
      date_key: daysAgo(2).slice(0, 10),
      date_label: '8월 17일',
      items: [
        item({
          id: 'req-7',
          meetingId: MEETING_IDS.designReview,
          title: '발표 리허설 피드백 반영',
          project: PROJECTS.academy,
          needsAnswer: 0,
          needsConfirm: 0,
        }),
      ],
    },
    {
      // 처리할 것이 하나도 없는 날도 있다 — 빈 목록이 어떻게 보이는지 여기서 본다.
      date_key: daysAgo(3).slice(0, 10),
      date_label: '8월 16일',
      items: [],
    },
  ],
}
