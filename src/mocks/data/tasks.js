/**
 * 승인 대기 태스크 가상 데이터.
 *
 * 지금 프론트에는 태스크 목록 화면이 없다. 요청함의 `승인 필요` 줄이 이
 * 데이터를 가리켜, 승인 필요 상세 내용 팝업(시안 `701:5558`)이 여는 유일한
 * 문이 된다 — `inbox.js` 의 각 항목이 `pendingApprovalTaskIds` 로 여기 id 를
 * 끌어다 쓴다.
 *
 * `PENDING_APPROVAL` · `created_by_agent: true` 뿐이다. 승인 대기가 되는
 * 이유는 늘 같다 — Bordo 가 만든 후보라서다(`Task.created_by_agent` 가 서버에서
 * 이 상태를 강제한다). 그래서 팝업의 "승인 보류 근거" 는 태스크마다 다른
 * 문구가 아니라 이 규칙 하나를 설명하는 고정 문구다.
 */

import { PROJECTS, person } from './people.js'

function pendingTask({ id, title, description, project, assignee, dueAt, sourceMeeting }) {
  return {
    id,
    title,
    description,
    status: 'PENDING_APPROVAL',
    priority: 'P1',
    assignee_id: person(assignee).id,
    due_at: dueAt,
    created_by_agent: true,
    source_meeting: sourceMeeting,
    project_id: project.id,
    created_at: new Date().toISOString(),
  }
}

export const tasks = {
  'task-req2-a': pendingTask({
    id: 'task-req2-a',
    title: '개발 완료 일정을 8월 18일로 변경하려고 해요',
    description: '디자인 시안 확정이 하루 늦어지면서 개발 착수도 그만큼 밀렸습니다. 확정 전에 영향받는 다른 일정이 있는지 확인해 주세요.',
    project: PROJECTS.bordo,
    assignee: '최비성',
    dueAt: '2026-08-18T18:00:00+09:00',
    sourceMeeting: 'baf061c5-2efc-4ca8-80e5-cecc15582780',
  }),
  'task-req2-b': pendingTask({
    id: 'task-req2-b',
    title: 'QA 기간을 하루 줄이려고 해요',
    description: '개발 일정이 밀린 만큼 QA 기간을 하루 줄여 마감을 맞추자는 제안입니다. 릴리스 안정성에 영향이 있는지 확인해 주세요.',
    project: PROJECTS.bordo,
    assignee: '임수연',
    dueAt: '2026-08-19T18:00:00+09:00',
    sourceMeeting: 'baf061c5-2efc-4ca8-80e5-cecc15582780',
  }),
  'task-req4-a': pendingTask({
    id: 'task-req4-a',
    title: '부스 운영 인원을 두 명 추가하려고 해요',
    description: '예상 방문객이 늘어 지금 인원으로는 부족하다는 의견이 나왔습니다. 추가 배치를 확정해 주세요.',
    project: PROJECTS.academy,
    assignee: '서재민',
    dueAt: '2026-08-20T12:00:00+09:00',
    sourceMeeting: '0a3f6cd2-71b5-4d8e-9c4a-2f7b8e15d093',
  }),
  'task-req6-a': pendingTask({
    id: 'task-req6-a',
    title: '파트너 계약에 조기 종료 위약금 조항을 추가하려고 해요',
    description: '파트너 측이 조기 종료 시 위약금 조항을 요청했습니다. 계약 조건에 반영할지 확인해 주세요.',
    project: PROJECTS.academy,
    assignee: '유수인',
    dueAt: '2026-08-20T18:00:00+09:00',
    sourceMeeting: 'c47e9b30-5a68-4f21-8d0c-6b39f2ae7154',
  }),
}
