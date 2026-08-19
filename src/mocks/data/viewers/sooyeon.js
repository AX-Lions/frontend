import { daysAgo } from '../people.js'

/**
 * 임수연 — 프론트엔드.
 *
 * ## 대리인 없이 그냥 빠진 경우
 *
 * 연합학술제 부스 운영 킥오프에 `ABSENT` 다. **대리인을 보내지 않았다.**
 *
 * 그래서 브리핑의 성격이 다르다 — 대리인이 대신 답한 것이 없으니 "무엇을
 * 대신 말했는가" 가 없고, 오간 말을 정리한 것만 있다. 유보(`needs_answer`)도
 * 없다. 유보는 대리인이 답하려다 근거가 없어 넘긴 것이라, 애초에 들어가지
 * 않았으면 생기지 않는다.
 *
 * 이 차이가 데이터에 있어야 **대리인을 보내는 것과 안 보내는 것이 무엇이
 * 다른지**를 화면에서 볼 수 있다.
 */
export const viewer = {
  agentRoomId: '7d5b92e0-41c8-4f36-b8a7-2e90c6d14f83',
  favoriteMeetings: [],
  delegatePrompt: '',
  delegateSources: null,

  settings: {
    mention_feasibility: false,
    allow_schedule_change: false,
    allow_midmeeting_question: true,
    disclose_work: true,
    disclose_plan: true,
    disclose_thought: false,
    disclose_work_plan_thought: true,
    tone: 'FRIENDLY',
    active_version: 2,
    updated_at: daysAgo(7, 15, 20),
  },

  prompts: [
    {
      id: '1a2b3c4d-5e6f-4708-8192-a3b4c5d6e7f8',
      body: '화면이 깨지는 문제는 어느 폭에서 그런지 같이 물어봐 주세요. 그것 없이는 재현이 안 돼요.',
      created_at: daysAgo(7, 15, 20),
      updated_at: daysAgo(7, 15, 20),
    },
    {
      id: '2b3c4d5e-6f70-4819-92a3-b4c5d6e7f809',
      body: '제 작업 진행률은 말해 주셔도 되는데, 아직 안 올린 건 "작업 중" 까지만 말해 주세요.',
      created_at: daysAgo(5, 14, 0),
      updated_at: daysAgo(5, 14, 0),
    },
    {
      id: '3c4d5e6f-7081-492a-a3b4-c5d6e7f8091a',
      body: '디자인 확정이 필요한 이야기는 유수인 님께 넘겨 주세요. 제가 임의로 정하면 나중에 다시 갈아엎게 돼요.',
      created_at: daysAgo(3, 13, 45),
      updated_at: daysAgo(3, 13, 45),
    },
  ],

  conversations: [
    {
      id: '4d5e6f70-8192-4a3b-b4c5-d6e7f8091a2b',
      title: '부스 킥오프에서 프론트 이야기 있었어요?',
      last_message_preview: '프론트 쪽으로 넘어온 건 없었어요.',
      last_message_at: daysAgo(5, 10, 12),
      message_count: 2,
      created_at: daysAgo(5, 10, 5),
      updated_at: daysAgo(5, 10, 12),
    },
    {
      id: '5e6f7081-92a3-4b4c-c5d6-e7f8091a2b3c',
      title: '카드 제목 넘치는 문제',
      last_message_preview: '확인이 필요해 보여요.',
      last_message_at: daysAgo(4, 16, 0),
      message_count: 4,
      created_at: daysAgo(4, 15, 45),
      updated_at: daysAgo(4, 16, 0),
    },
  ],

  conversationMessages: {
    '4d5e6f70-8192-4a3b-b4c5-d6e7f8091a2b': {
      results: [
        {
          id: '6f708192-a3b4-4c5d-d6e7-f8091a2b3c4d',
          role: 'USER',
          body: '어제 부스 킥오프에 못 갔는데 프론트 쪽으로 넘어온 거 있어요?',
          sent_at: daysAgo(5, 10, 5),
          run: null,
        },
        {
          id: '708192a3-b4c5-4d6e-e7f8-091a2b3c4d5e',
          role: 'AGENT',
          body: '없었어요. 부스 운영 인원 배치랑 포스터 서체 이야기가 전부였고, 화면 쪽 이야기는 안 나왔어요. 다만 그 회의는 제가 들어간 게 아니라 회의 기록을 읽은 거예요 — 대리인을 보내지 않으셔서, 그 자리에서 누가 임수연 님을 찾았는지는 알 수 없어요.',
          sent_at: daysAgo(5, 10, 12),
          run: { status: 'DONE', run_id: '8192a3b4-c5d6-4e7f-f809-1a2b3c4d5e6f' },
        },
      ],
      next_before: null,
    },
    '5e6f7081-92a3-4b4c-c5d6-e7f8091a2b3c': {
      results: [
        {
          id: '92a3b4c5-d6e7-4f80-091a-2b3c4d5e6f70',
          role: 'USER',
          body: '유수인 님이 카드 제목 넘친다고 하셨는데 어느 화면 말하는 거예요?',
          sent_at: daysAgo(4, 15, 45),
          run: null,
        },
        {
          id: 'a3b4c5d6-e7f8-4091-1a2b-3c4d5e6f7081',
          role: 'AGENT',
          body: '홈의 최근 회의 카드예요. 개발팀 Sync 에서 나온 이야기고, 긴 제목이 잘리지 않고 넘친다고 하셨어요.',
          sent_at: daysAgo(4, 15, 50),
          run: { status: 'DONE', run_id: 'b4c5d6e7-f809-41a2-2b3c-4d5e6f708192' },
        },
        {
          id: 'c5d6e7f8-091a-42b3-3c4d-5e6f70819 2a3'.replace(' ', ''),
          role: 'USER',
          body: '고쳤는데 다른 화면도 같은 문제 있을까요?',
          sent_at: daysAgo(4, 15, 56),
          run: null,
        },
        {
          id: 'd6e7f809-1a2b-43c4-4d5e-6f708192a3b4',
          role: 'AGENT',
          body: '확인이 필요해 보여요. 회의에서는 홈 카드 이야기만 나왔고, 다른 화면에서도 같은 규칙을 쓰는지는 제 기록으로 알 수 없어요. 직접 보셔야 할 것 같아요.',
          sent_at: daysAgo(4, 16, 0),
          run: { status: 'DONE', run_id: 'e7f8091a-2b3c-44d5-5e6f-708192a3b4c5' },
        },
      ],
      next_before: null,
    },
  },

  briefings: {
    '2f5c1d47-9b0a-4e3c-8f61-7a4d2c9e0b13': {
      narrative:
        '연합학술제 부스 운영 킥오프에는 대리인을 보내지 않으셔서 대신 답한 것이 없습니다. 오간 말만 정리했습니다. 부스 운영 이틀을 오전·오후로 나누기로 했고, 첫날 오전은 인원을 둘로 줄이자는 의견에 이견이 없었습니다. 포스터 서체는 두 번째 안으로 정해졌습니다. 프론트엔드 쪽으로 넘어온 일은 없었습니다.',
      // 대리인이 안 들어갔으니 유보할 것도 없다.
      needs_answer: [],
    },
  },
}
