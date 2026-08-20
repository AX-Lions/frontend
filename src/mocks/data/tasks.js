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
 *
 * ## `evidence` — 이 태스크가 어느 발언에서 나왔는지
 *
 * 승인 보류 근거와는 다른 것이다. 저건 "왜 사람이 눌러야 하는가"(규칙),
 * 이건 "왜 이 내용이 후보로 올라왔는가"(회의 중 실제 발언)다. `edge_id` 는
 * `flow.js` 의 실제 엣지를 가리켜야 팝업의 「플로우에서 보기」가 진짜
 * 그 자리를 연다 — `source_meeting` 만으로는 회의 전체가 열릴 뿐, 그
 * 발언까지 짚어 주지 못한다.
 */

import { PROJECTS, person } from './people.js'

function pendingTask({ id, title, description, project, assignee, dueAt, sourceMeeting, evidence }) {
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
    evidence,
    project_id: project.id,
    created_at: new Date().toISOString(),
  }
}

export const tasks = {
  /*
    글로벌 회의에서 대리인이 "일정 변경은 제가 정할 수 없습니다" 로 유보한
    것(`meeting-edge-32`, `briefings.direction.deferred_answers[0]`)의 후속이다.
    유보는 끝이 아니라 사람에게 넘기는 것이라, 넘겨받은 것이 이 승인 대기
    태스크로 남는다.
  */
  'task-req2-a': pendingTask({
    id: 'task-req2-a',
    title: 'API 연동 완료일을 8월 30일로 변경하려고 해요',
    description: '개발 일정이 1주 밀리면서 API 연동 완료일도 8/23에서 8/30으로 늦춰야 합니다. 일정 변경은 제가 정할 수 없어 확인 요청으로 남깁니다.',
    project: PROJECTS.bordo,
    assignee: '최비성',
    dueAt: '2026-08-18T18:00:00+09:00',
    sourceMeeting: 'b1a11546-5743-46d4-b052-06407fb69c3c',
    evidence: {
      edgeId: 'meeting-edge-32',
      speaker: '서재민',
      quote: 'API 연동 완료일을 8/23 에서 8/30 으로 미루겠습니다. 괜찮을까요?',
    },
  }),
  /*
    같은 회의에서 "저장된 근거가 없어 답을 미뤘습니다" 로 유보한
    것(`meeting-edge-33`, `deferred_answers[1]`)의 후속.
  */
  'task-req2-b': pendingTask({
    id: 'task-req2-b',
    title: 'QA 기간을 하루 줄이려고 해요',
    description: '개발 일정이 밀린 만큼 QA 기간을 하루 줄여 마감을 맞추자는 제안입니다. 저장된 근거가 없어 제가 답하지 못하고 넘깁니다. 릴리스 안정성에 영향이 있는지 확인해 주세요.',
    project: PROJECTS.bordo,
    assignee: '임수연',
    dueAt: '2026-08-19T18:00:00+09:00',
    sourceMeeting: 'b1a11546-5743-46d4-b052-06407fb69c3c',
    evidence: {
      edgeId: 'meeting-edge-33',
      speaker: '서재민',
      quote: '8/18 마감이면 QA 기간이 3일뿐인데 괜찮을까요?',
    },
  }),
  'task-req4-a': pendingTask({
    id: 'task-req4-a',
    title: '부스 운영 인원을 두 명 추가하려고 해요',
    description: '예상 방문객이 늘어 지금 인원으로는 부족하다는 의견이 나왔습니다. 추가 배치를 확정해 주세요.',
    project: PROJECTS.academy,
    assignee: '서재민',
    dueAt: '2026-08-20T12:00:00+09:00',
    sourceMeeting: '0a3f6cd2-71b5-4d8e-9c4a-2f7b8e15d093',
    evidence: null,
  }),
  /*
    연합학술제 킥오프에서 대리인이 "제가 답할 근거가 없습니다" 로 유보한
    것(`meeting-booth-6`, `deferred_answers[0]`)의 후속. 학술제 측 제출
    양식이 아직 안 와서, 대리인은 잠정 마감만 만들고 확정은 사람에게 넘긴다.
  */
  'task-req-a2': pendingTask({
    id: 'task-req-a2',
    title: '초록 마감일을 8월 25일로 잠정 확정하려고 해요',
    description: '학술제 측 제출 양식이 아직 오지 않아 정확한 마감을 알 수 없습니다. 예년 일정 기준으로 8/25를 잠정 마감으로 잡아 두고, 양식이 오면 다시 확인하겠습니다.',
    project: PROJECTS.academy,
    assignee: '유수인',
    dueAt: '2026-08-22T18:00:00+09:00',
    sourceMeeting: '2f5c1d47-9b0a-4e3c-8f61-7a4d2c9e0b13',
    evidence: {
      edgeId: 'meeting-booth-6',
      speaker: '서재민',
      quote: '초록 마감일이 언제인지 알려주실 수 있나요?',
    },
  }),
  'task-req6-a': pendingTask({
    id: 'task-req6-a',
    title: '파트너 계약에 조기 종료 위약금 조항을 추가하려고 해요',
    description: '파트너 측이 조기 종료 시 위약금 조항을 요청했습니다. 계약 조건에 반영할지 확인해 주세요.',
    project: PROJECTS.academy,
    assignee: '유수인',
    dueAt: '2026-08-20T18:00:00+09:00',
    sourceMeeting: 'c47e9b30-5a68-4f21-8d0c-6b39f2ae7154',
    evidence: null,
  }),
}
