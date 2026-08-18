import { daysAgo } from '../people.js'

/**
 * 서재민 — PM · 백엔드.
 *
 * PM 은 회의에서 보는 것이 다르다. 무슨 이야기가 오갔는지보다 **무엇이
 * 달라졌고 누가 나에게 무엇을 요청했는지**가 먼저다. 그래서 이 계정의
 * 브리핑은 `needs_confirmation`(확인이 필요한 변경)과
 * `requests_to_me`(나에게 온 요청)가 두껍다.
 *
 * 연합학술제 발표 자료 검토 회의에 `ABSENT` 다. 대리인은 보냈다 — 그 자리에서
 * 제출 마감을 문서 근거로 답했고, 인원 배치 기한은 어디에도 없어 유보했다.
 */
export const viewer = {
  agentRoomId: '9e0a7c34-6b25-4d81-a3f9-5c17b8e20d46',
  favoriteMeetings: ['4eb1040f-18d7-4841-bc72-360846888c3d'],
  delegatePrompt:
    '일정은 확정하지 말고 후보만 전해 주십시오. 마감이나 기한을 묻거든 문서에 적힌 것만 인용하고, 문서에 없으면 없다고 말해 주십시오. 역할 분배는 제가 돌아와서 정하겠습니다.',
  delegateSources: ['work', 'plan', 'document'],

  settings: {
    mention_feasibility: true,
    allow_schedule_change: false,
    allow_midmeeting_question: true,
    disclose_work_plan_thought: true,
    tone: 'FORMAL',
    active_version: 5,
    updated_at: daysAgo(3, 23, 10),
  },

  prompts: [
    {
      id: 'f1e2d3c4-b5a6-4978-8869-7a6b5c4d3e2f',
      body: '일정은 확정하지 말고 후보만 말해 주십시오. 확정은 제가 합니다.',
      created_at: daysAgo(8, 22, 0),
      updated_at: daysAgo(8, 22, 0),
    },
    {
      id: 'e2d3c4b5-a697-4889-9a7b-6c5d4e3f2a1b',
      body: '마감이나 기한을 묻거든 문서에 적힌 것만 인용해 주십시오. 문서에 없으면 없다고 말해 주십시오.',
      created_at: daysAgo(6, 21, 30),
      updated_at: daysAgo(6, 21, 30),
    },
    {
      id: 'd3c4b5a6-9788-499a-ab6c-5d4e3f2a1b0c',
      body: '역할 분배와 담당자 지정은 제 몫입니다. 회의에서 정해 달라고 하면 제게 넘겨 주십시오.',
      created_at: daysAgo(6, 21, 34),
      updated_at: daysAgo(6, 21, 34),
    },
    {
      id: 'c4b5a697-8899-4aab-bc5d-4e3f2a1b0c9d',
      body: '누가 무엇을 언제까지 하기로 했는지는 사람 이름과 함께 정리해 주십시오.',
      created_at: daysAgo(2, 20, 15),
      updated_at: daysAgo(2, 20, 15),
    },
  ],

  conversations: [
    {
      id: 'b5a69788-99aa-4bbc-cd4e-3f2a1b0c9d8e',
      title: '이번 주에 확정해야 하는 것',
      last_message_preview: '인원 배치 기한은 확인이 필요합니다.',
      last_message_at: daysAgo(1, 23, 40),
      message_count: 4,
      created_at: daysAgo(1, 23, 25),
      updated_at: daysAgo(1, 23, 40),
    },
    {
      id: 'a6978899-aabb-4ccd-de3f-2a1b0c9d8e7f',
      title: '리뷰가 멈춰 있는 PR',
      last_message_preview: '셋 다 리뷰 대기입니다.',
      last_message_at: daysAgo(2, 21, 5),
      message_count: 2,
      created_at: daysAgo(2, 21, 0),
      updated_at: daysAgo(2, 21, 5),
    },
  ],

  conversationMessages: {
    'b5a69788-99aa-4bbc-cd4e-3f2a1b0c9d8e': {
      results: [
        {
          id: '97889 9aa-bbcc-4dde-3f2a-1b0c9d8e7f60'.replace(' ', ''),
          role: 'USER',
          body: '이번 주에 제가 확정해야 하는 것만 뽑아 주십시오.',
          sent_at: daysAgo(1, 23, 25),
          run: null,
        },
        {
          id: '8899aabb-ccdd-4ee3-f2a1-b0c9d8e7f601',
          role: 'AGENT',
          body: '세 가지입니다.\n\n첫째, 연합학술제 부스 운영 인원 배치입니다. 유수인 님이 초안을 잡아 두고 서재민 님 확인을 기다리고 있습니다.\n\n둘째, 로그인 화면 시안 일정입니다. 임수연 님이 이번 주 안에 필요하다고 했고, 유수인 님 쪽에서는 오늘 중 공유 예정으로만 남아 있습니다.\n\n셋째, 대리인 설정 스위치가 화면에는 여섯 개인데 서버에는 네 개입니다. 어느 쪽에 맞출지가 기획 결정이라 넘어와 있습니다.',
          sent_at: daysAgo(1, 23, 32),
          run: { status: 'DONE', run_id: '99aabbcc-ddee-43f2-a1b0-c9d8e7f60123' },
        },
        {
          id: 'aabbccdd-eef3-42a1-b0c9-d8e7f6012345',
          role: 'USER',
          body: '첫 번째, 인원 배치 기한이 언제까지였습니까?',
          sent_at: daysAgo(1, 23, 36),
          run: null,
        },
        {
          id: 'bbccddee-f3a2-41b0-c9d8-e7f601234567',
          role: 'AGENT',
          body: '제출 마감은 금요일 18시로 제출 안내 문서에 있습니다. 다만 **인원 배치 기한은 어느 문서에도 적혀 있지 않습니다.** 회의에서도 나오지 않았습니다. 문서에 없는 것을 지어내지 않았으니 확인이 필요합니다.',
          sent_at: daysAgo(1, 23, 40),
          run: { status: 'DONE', run_id: 'ccddeef3-a2b1-40c9-d8e7-f60123456789' },
        },
      ],
      next_before: null,
    },
    'a6978899-aabb-4ccd-de3f-2a1b0c9d8e7f': {
      results: [
        {
          id: 'ddeef3a2-b1c0-49d8-e7f6-012345678 9ab'.replace(' ', ''),
          role: 'USER',
          body: '지금 멈춰 있는 PR 있습니까?',
          sent_at: daysAgo(2, 21, 0),
          run: null,
        },
        {
          id: 'eef3a2b1-c0d9-48e7-f601-23456789abcd',
          role: 'AGENT',
          body: '셋 다 리뷰 대기입니다. 백엔드 하나, 프론트 하나, Discord 하나입니다. 교차 리뷰 규칙이라 올린 사람이 자기 것을 승인할 수 없어 멈춰 있습니다.',
          sent_at: daysAgo(2, 21, 5),
          run: { status: 'DONE', run_id: 'f3a2b1c0-d9e8-47f6-0123-456789abcdef' },
        },
      ],
      next_before: null,
    },
  },

  briefings: {
    '0a3f6cd2-71b5-4d8e-9c4a-2f7b8e15d093': {
      narrative:
        '자리를 비우신 70분 동안 서재민의 Bordo가 한 가지를 대신 답했습니다. 제출 마감을 묻는 질문에 제출 안내 문서의 금요일 18시를 그대로 인용했습니다. 반면 부스 인원 배치 기한은 어느 문서에도 없어 유보하고 본인 확인으로 넘겼습니다 — 없는 기한을 지어냈다면 팀 전체가 그것을 기준으로 움직였을 것입니다. 회의 결과로 포스터 서체가 두 번째 안으로 확정됐고, 인원 배치는 초안 상태로 서재민 님 확인을 기다리고 있습니다.',
      needs_answer: [
        {
          id: 'na-poster-1',
          question: '부스 인원 배치는 언제까지 확정하면 됩니까?',
          asked_by: '유수인',
          reason: '어느 문서에도 기한이 없어 대리인이 답하지 못했습니다.',
          asked_at: daysAgo(6, 20, 15),
          answered_at: null,
        },
      ],
    },
  },
}
