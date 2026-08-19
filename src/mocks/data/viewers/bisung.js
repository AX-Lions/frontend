import { daysAgo } from '../people.js'

/**
 * 최비성 — 백엔드.
 *
 * ## 브리핑이 **비어 있는 것이 정답이다**
 *
 * 이 사람은 모든 회의에 참석했다. 그래서 `briefings` 가 빈 객체다.
 *
 * 그것이 이 계정의 쓸모다. 홈 상단의 `Bordo 브리핑 보러가기` 가 안 뜨고,
 * 회의 화면의 브리핑 칸이 비는 것이 **규약상 정상**인데(참석자가 브리핑을
 * 열면 서버가 404 를 준다), 그 정상을 볼 계정이 없으면 화면이 그것을 오류로
 * 그리는지 확인할 수가 없다. 억지로 채우지 않는다.
 *
 * 대신 말투를 `CONCISE` 로 두어, 같은 대리인이 사람마다 다르게 말하는 것을
 * 볼 수 있게 했다.
 */
export const viewer = {
  agentRoomId: '2c8f41a6-53d9-4b70-9e12-8a6d3c05f7b4',
  favoriteMeetings: ['cdcd5cda-d887-47dc-91aa-4bb7393d461b'],
  delegatePrompt: '',
  delegateSources: null,

  settings: {
    mention_feasibility: true,
    allow_schedule_change: true,
    allow_midmeeting_question: false,
    disclose_work: true,
    disclose_plan: true,
    disclose_thought: true,
    disclose_work_plan_thought: true,
    tone: 'CONCISE',
    active_version: 3,
    updated_at: daysAgo(5, 22, 40),
  },

  prompts: [
    {
      id: 'a1d3f5b7-2c48-4e69-8071-9a3b5c7d1e02',
      body: '구현 가능성은 되는지 안 되는지만 먼저 말하고, 이유는 그 다음에 붙여 주십시오.',
      created_at: daysAgo(6, 21, 15),
      updated_at: daysAgo(6, 21, 15),
    },
    {
      id: 'b2e4a6c8-3d59-4f7a-9182-0b4c6d8e2f13',
      body: '마이그레이션이 필요한 변경은 반드시 그 사실을 함께 말해 주십시오. 나중에 알면 배포가 막힙니다.',
      created_at: daysAgo(4, 20, 5),
      updated_at: daysAgo(4, 20, 5),
    },
    {
      id: 'c3f5b7d9-4e60-4a8b-a293-1c5d7e9f3024',
      body: '제 작업 기록은 팀에 공개해도 됩니다. 다만 아직 병합되지 않은 것은 "작업 중" 이라고만 말해 주십시오.',
      created_at: daysAgo(2, 19, 30),
      updated_at: daysAgo(2, 19, 30),
    },
  ],

  conversations: [
    {
      id: 'e5a7c9f1-6b82-4d04-b3a5-2e6f8a0b4c16',
      title: '시간대 처리 어디까지 갔나',
      last_message_preview: '병합됨. 인덱스 영향 없음.',
      last_message_at: daysAgo(1, 22, 8),
      message_count: 4,
      created_at: daysAgo(1, 21, 55),
      updated_at: daysAgo(1, 22, 8),
    },
    {
      id: 'f6b8d0a2-7c93-4e15-c4b6-3f70a1b5d627',
      title: '작업 모드 인덱스가 왜 비었나',
      last_message_preview: '회의 스코프로 물어서. 작업 화살표엔 회의가 없음.',
      last_message_at: daysAgo(4, 16, 20),
      message_count: 2,
      created_at: daysAgo(4, 16, 12),
      updated_at: daysAgo(4, 16, 20),
    },
  ],

  conversationMessages: {
    'e5a7c9f1-6b82-4d04-b3a5-2e6f8a0b4c16': {
      results: [
        {
          id: '01c3e5a7-8d94-4f26-b5c7-4a81b2c6e738',
          role: 'USER',
          body: '시간대 처리 지금 어디까지 됐지?',
          sent_at: daysAgo(1, 21, 55),
          run: null,
        },
        {
          id: '12d4f6b8-9ea5-4037-c6d8-5b92c3d7f849',
          role: 'AGENT',
          body: '병합됐습니다. 채팅 하루 경계를 서버 UTC 가 아니라 `User.timezone` 으로 자릅니다. 네 군데(활동일·메시지·검색·그날 요약)가 같은 경계를 씁니다. 근거는 어제 병합된 PR #80 입니다.',
          sent_at: daysAgo(1, 21, 58),
          run: { status: 'DONE', run_id: '23e5a7c9-0fb6-4148-d7e9-6ca3d4e8a95a' },
        },
        {
          id: '34f6b8d0-1ac7-4259-e8fa-7db4e5f9ba6b',
          role: 'USER',
          body: '인덱스 못 타게 만든 건 없고?',
          sent_at: daysAgo(1, 22, 4),
          run: null,
        },
        {
          id: '45a7c9e1-2bd8-436a-f90b-8ec5f6a0cb7c',
          role: 'AGENT',
          body: '없습니다. 컬럼에 함수를 씌우지 않고 범위 비교만 합니다. 병합됨. 인덱스 영향 없음.',
          sent_at: daysAgo(1, 22, 8),
          run: { status: 'DONE', run_id: '56b8d0f2-3ce9-447b-0a1c-9fd607b1dc8d' },
        },
      ],
      next_before: null,
    },
    'f6b8d0a2-7c93-4e15-c4b6-3f70a1b5d627': {
      results: [
        {
          id: '67c9e1a3-4df0-458c-1b2d-a0e718c2ed9e',
          role: 'USER',
          body: '작업 모드 좌측 인덱스가 계속 0건인데 원인 알아?',
          sent_at: daysAgo(4, 16, 12),
          run: null,
        },
        {
          id: '78d0f2b4-5ea1-469d-2c3e-b1f829d3fe0f',
          role: 'AGENT',
          body: '회의 스코프로 물어서입니다. 작업 화살표에는 회의가 없어 무엇을 넣든 0건입니다. 프로젝트와 기간으로 물어야 합니다. 근거는 `FlowEdge` 의 작업 행이 `meeting` 없이 만들어지는 것입니다.',
          sent_at: daysAgo(4, 16, 20),
          run: { status: 'DONE', run_id: '89e1a3c5-6fb2-47ae-3d4f-c209 3ae40f10'.replace(' ', '') },
        },
      ],
      next_before: null,
    },
  },

  // 전부 참석했다. 비어 있는 것이 맞다.
  briefings: {},
}
