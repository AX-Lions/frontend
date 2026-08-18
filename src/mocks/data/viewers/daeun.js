import { daysAgo, minutesAgo } from '../people.js'

/**
 * 강다은 — Discord, 시간대가 `Europe/Berlin`.
 *
 * ## 시차 때문에 대리인을 보낸다
 *
 * 한국 팀 회의가 이 사람에게는 새벽·이른 아침이다. 두 회의(정기 팀 회의 ·
 * 개발팀 Sync)에 `DELEGATED` 인 것이 그래서다.
 *
 * **이 서비스가 풀려는 문제가 정확히 이것이다.** 시간대가 다른 팀원은 회의에
 * 못 들어가고, 못 들어가면 결정이 자기 없이 내려지고, 다음 날 아침에야 무슨
 * 일이 있었는지 알게 된다. 그 사이의 하루를 대리인이 메운다.
 *
 * 유보가 특히 중요한 계정이다 — 시차 때문에 되물을 수가 없어서, 대리인이
 * 근거 없이 답해 버리면 잘못을 바로잡을 사람이 그 자리에 없다.
 */
export const viewer = {
  agentRoomId: '4a91c6d8-2e57-4b03-9f68-7d0e5a2c39b1',
  favoriteMeetings: ['4eb1040f-18d7-4841-bc72-360846888c3d'],
  delegatePrompt:
    '베를린이라 이 시간대 회의는 들어가기 어렵습니다. 봇 동작과 배포 관련 질문은 제 작업 기록을 근거로 답해 주시고, 채널 권한이나 서버 설정을 바꾸는 이야기는 절대 확정하지 말고 저에게 넘겨 주십시오. 되돌리기 어렵습니다.',
  delegateSources: ['work', 'plan'],

  settings: {
    mention_feasibility: true,
    allow_schedule_change: false,
    allow_midmeeting_question: true,
    disclose_work_plan_thought: true,
    tone: 'FORMAL',
    active_version: 4,
    updated_at: daysAgo(4, 8, 20),
  },

  prompts: [
    {
      id: '0f1e2d3c-4b5a-4697-8879-a6b5c4d3e2f1',
      body: '채널 권한이나 서버 설정을 바꾸는 이야기는 확정하지 말고 저에게 넘겨 주십시오. 되돌리기 어렵습니다.',
      created_at: daysAgo(9, 8, 10),
      updated_at: daysAgo(9, 8, 10),
    },
    {
      id: '1e2d3c4b-5a69-4788-9a6b-5c4d3e2f1a0b',
      body: '제가 베를린이라 회의 시간에 깨어 있지 않을 수 있습니다. 급한 것은 유보하지 말고 서재민 님께 넘겨 주십시오.',
      created_at: daysAgo(7, 8, 30),
      updated_at: daysAgo(7, 8, 30),
    },
    {
      id: '2d3c4b5a-6978-489a-ab5c-4d3e2f1a0b9c',
      body: '봇 배포 상태는 제 작업 기록을 근거로 답해 주십시오. 기록에 없으면 없다고 말해 주십시오.',
      created_at: daysAgo(3, 9, 0),
      updated_at: daysAgo(3, 9, 0),
    },
  ],

  conversations: [
    {
      id: '3c4b5a69-7889-49ab-bc4d-3e2f1a0b9c8d',
      title: '자는 동안 뭐가 정해졌습니까',
      last_message_preview: '하나는 유보했습니다.',
      last_message_at: minutesAgo(95),
      message_count: 4,
      created_at: minutesAgo(120),
      updated_at: minutesAgo(95),
    },
    {
      id: '4b5a6978-899a-4abc-cd3e-2f1a0b9c8d7e',
      title: 'Outbox 중복 게시 지적',
      last_message_preview: 'ACK 실패와 게시 실패를 구분해야 합니다.',
      last_message_at: daysAgo(1, 9, 15),
      message_count: 2,
      created_at: daysAgo(1, 9, 8),
      updated_at: daysAgo(1, 9, 15),
    },
  ],

  conversationMessages: {
    '3c4b5a69-7889-49ab-bc4d-3e2f1a0b9c8d': {
      results: [
        {
          id: '5a697889-9aab-4bcd-de2f-1a0b9c8d7e6f',
          role: 'USER',
          body: '자는 동안 회의 있었죠? 제 쪽으로 정해진 거 있습니까?',
          sent_at: minutesAgo(120),
          run: null,
        },
        {
          id: '6978899a-abbc-4cde-ef1a-0b9c8d7e6f50',
          role: 'AGENT',
          body: '정기 팀 회의가 돌고 있고 제가 대신 들어가 있습니다. 지금까지 강다은 님 쪽 이야기는 하나입니다 — Outbox consumer 리뷰 반영 중이라고 전했고, 중복 게시를 막는 것부터 넣겠다고 답해 두었습니다. 근거는 어제 남기신 작업 기록입니다.',
          sent_at: minutesAgo(112),
          run: { status: 'DONE', run_id: '78899aab-bccd-4def-1a0b-9c8d7e6f5041' },
        },
        {
          id: '8899aabb-ccde-4ef1-a0b9-c8d7e6f50412',
          role: 'USER',
          body: '봇 채널 권한 이야기도 나왔습니까?',
          sent_at: minutesAgo(100),
          run: null,
        },
        {
          id: '99aabbcc-def1-40b9-c8d7-e6f504123456',
          role: 'AGENT',
          body: '나왔지만 답하지 않았습니다. 채널 권한을 바꾸는 이야기는 확정하지 말고 넘기라는 지시가 있어, 강다은 님 확인이 필요하다고만 말했습니다. 하나는 유보했습니다.',
          sent_at: minutesAgo(95),
          run: { status: 'DONE', run_id: 'aabbccde-f1a0-49c8-d7e6-f50412345678' },
        },
      ],
      next_before: null,
    },
    '4b5a6978-899a-4abc-cd3e-2f1a0b9c8d7e': {
      results: [
        {
          id: 'bbccdef1-a0b9-48d7-e6f5-041234567890',
          role: 'USER',
          body: 'Outbox PR 에 뭐라고 지적 왔습니까?',
          sent_at: daysAgo(1, 9, 8),
          run: null,
        },
        {
          id: 'ccdef1a0-b9c8-47e6-f504-1234567890ab',
          role: 'AGENT',
          body: '세 가지입니다. ACK 응답을 버려서 백엔드가 잠깐 재시작하면 같은 발언이 다시 올라갈 수 있다는 것, 2000자를 넘으면 한 글자도 안 나가고 조용히 사라진다는 것, 본문의 멘션이 그대로 나가 승인 없이 알림이 울린다는 것입니다. 첫 번째가 가장 급하다고 적혀 있습니다 — ACK 실패와 게시 실패를 구분해야 합니다.',
          sent_at: daysAgo(1, 9, 15),
          run: { status: 'DONE', run_id: 'def1a0b9-c8d7-46f5-0412-34567890abcd' },
        },
      ],
      next_before: null,
    },
  },

  briefings: {
    'cdcd5cda-d887-47dc-91aa-4bb7393d461b': {
      narrative:
        '베를린 시각으로 새벽에 열린 회의라 강다은의 Bordo가 대신 들어갔습니다. 봇 배포 상태를 묻는 질문에 작업 기록을 근거로 "자동 배포는 붙어 있고 main 으로 올라가면 반영된다" 고 답했습니다. 이번 주에는 화면 연결까지만 하고 새 기능을 넣지 않기로 정해졌으니, 준비하시던 것이 있으면 다음 주로 밀립니다. 채널 권한 범위 이야기가 한 번 나왔지만 지시하신 대로 확정하지 않고 넘겨 두었습니다.',
      needs_answer: [
        {
          id: 'na-sync-1',
          question: '봇이 읽고 저장할 채널을 어디까지 허용합니까?',
          asked_by: '최비성',
          reason: '되돌리기 어려운 설정이라 본인 확인 전에는 답하지 않았습니다.',
          asked_at: daysAgo(4, 15, 50),
          answered_at: null,
        },
      ],
    },
    // 오늘 진행 중인 회의. **아직 돌고 있는 동안에도 브리핑이 보여야 한다** —
    // 자리를 비운 사람이 지금까지 무슨 이야기가 오갔는지 보는 것이 이 화면의
    // 쓸모다. 회의가 끝나야만 볼 수 있으면 늦다.
    '4eb1040f-18d7-4841-bc72-360846888c3d': {
      narrative:
        '지금 돌고 있는 회의입니다. 강다은의 Bordo가 대신 들어가 있고, 지금까지 강다은 님 쪽 이야기는 하나입니다 — Outbox consumer 리뷰 반영 중이며 중복 게시를 막는 것부터 넣겠다고 전했습니다. 회의가 끝나면 다시 정리해 드리겠습니다.',
      needs_answer: [],
    },
  },
}
