import { daysAgo } from '../people.js'

/**
 * 유수인 — 기획·디자인, 팀 OWNER.
 *
 * **기본 시연 계정이다.** 회의 셋에 없었고 그중 둘은 대리인을 보냈다. 대리인이
 * 무엇을 대신 답했고 무엇을 유보했는지가 이 계정에서 가장 잘 보여야 한다.
 *
 * 유보를 일부러 여러 번 넣었다. 이 서비스에서 유보는 실패가 아니라 차별점이다 —
 * 대리인이 근거 없이 말하지 않았다는 사실이 화면에 남아야, 사용자가 대리인이
 * 한 말을 믿을 수 있다.
 */
export const viewer = {
  agentRoomId: '6e1b85a4-d3b7-4abd-92f8-1e4eb692caec',
  favoriteMeetings: [
    'b1a11546-5743-46d4-b052-06407fb69c3c',
    'baf061c5-2efc-4ca8-80e5-cecc15582780',
  ],
  delegatePrompt:
    '디자인 관련 결정은 확정하지 말고 후보만 전해 주십시오. 시안은 제 확인 전에 공유하지 마시고, 일정 이야기가 나오면 화·목 오전만 가능하다고만 말해 주십시오.',
  delegateSources: ['work', 'plan', 'document'],

  settings: {
    mention_feasibility: true,
    allow_schedule_change: false,
    allow_midmeeting_question: true,
    disclose_work: false,
    disclose_plan: false,
    disclose_thought: false,
    disclose_work_plan_thought: false,
    tone: 'FORMAL',
    active_version: 7,
    updated_at: daysAgo(2, 10, 6),
  },

  prompts: [
    {
      id: '90e2f7d1-51b4-4c63-8a7e-d4b60f2913c8',
      body: '색·타이포·간격처럼 시안이 바뀌는 이야기는 확정하지 말고 전부 저에게 넘겨 주십시오.',
      created_at: daysAgo(3, 14, 10),
      updated_at: daysAgo(3, 14, 10),
    },
    {
      id: '2f6c1e94-4b7a-4d51-9f38-c0a1d2e35b70',
      body: '일정은 후보만 말해 주십시오. 제 일정은 화요일과 목요일 오전만 비어 있습니다.',
      created_at: daysAgo(5, 11, 5),
      updated_at: daysAgo(5, 11, 5),
    },
    {
      id: '5a83b0c7-6d21-4e94-b3f7-8c14e0a95d63',
      body: '완성되지 않은 시안은 제 확인 전에 공유하지 마십시오. 작업 중이라는 사실까지만 전해 주시면 됩니다.',
      created_at: daysAgo(6, 9, 40),
      updated_at: daysAgo(6, 9, 40),
    },
    {
      id: '7e19d4f2-3b85-4c06-9a72-1d5f8b3e60c4',
      body: '제가 못 들은 부분은 결정한 사람 이름과 근거까지 같이 정리해 주십시오. 요약만 있으면 다시 묻게 됩니다.',
      created_at: daysAgo(1, 9, 3),
      updated_at: daysAgo(1, 9, 3),
    },
  ],

  conversations: [
    {
      id: 'd41c8e07-9a53-4bd6-8f21-6e0b7c53a9d2',
      title: '킥오프 회의에서 디자인 쪽만',
      last_message_preview: '이건 확인이 필요해 보입니다.',
      last_message_at: daysAgo(1, 10, 17),
      message_count: 4,
      created_at: daysAgo(1, 10, 9),
      updated_at: daysAgo(1, 10, 17),
    },
    {
      id: '7b3e5f19-2c84-40a7-b6d3-91f5c8e02a6b',
      title: '개발팀 Sync 에서 내 몫',
      last_message_preview: '두 건은 유수인 님 몫으로 잡아 두었습니다.',
      last_message_at: daysAgo(4, 17, 12),
      message_count: 4,
      created_at: daysAgo(4, 17, 2),
      updated_at: daysAgo(4, 17, 12),
    },
  ],

  conversationMessages: {
    'd41c8e07-9a53-4bd6-8f21-6e0b7c53a9d2': {
      results: [
        {
          id: '0b6f4a21-7d38-4c95-8e02-1a5c9b7e34d0',
          role: 'USER',
          body: '어제 킥오프에 제가 못 갔습니다. 디자인 쪽으로 나온 이야기만 정리해 주십시오.',
          sent_at: daysAgo(1, 10, 9),
          run: { status: 'DONE', run_id: '6c0d38f5-b2a9-4e17-8d43-5f19a7c02be6' },
        },
        {
          id: '1c7e5b32-8e49-4da6-9f13-2b6d0c8f45e1',
          role: 'AGENT',
          body: '세 가지였습니다.\n\n첫째, 플로우 화면의 노드 색을 콘텐츠 종류별로 나누기로 했습니다. 최비성 님이 서버에서 종류를 그대로 내려 준다고 하여, 어떤 색을 쓸지는 디자인에서 정하면 됩니다.\n\n둘째, 로그인 화면 시안은 공유하지 않았습니다. 확인 전에는 공유하지 말라는 지시가 있어 작업 중이라는 사실까지만 전달했습니다.\n\n셋째, 임수연 님이 버튼 컴포넌트에 비활성 상태 색이 정의돼 있지 않아 임의로 회색을 쓰고 있다고 했습니다.',
          sent_at: daysAgo(1, 10, 12),
          run: { status: 'DONE', run_id: '6c0d38f5-b2a9-4e17-8d43-5f19a7c02be6' },
        },
        {
          id: '2d8f6c43-9f5a-4eb7-8024-3c7e1d9f56f2',
          role: 'USER',
          body: '세 번째는 제가 정해야 하는 겁니까?',
          sent_at: daysAgo(1, 10, 15),
          run: null,
        },
        {
          id: '3e9a7d54-0a6b-4fc8-9135-4d8f2e0a67a3',
          role: 'AGENT',
          body: '거기까지는 확인이 필요합니다. 회의에서는 "디자인에서 정해 줘야 한다" 는 말만 나왔고 누가 언제까지 정할지는 정해지지 않았습니다. 제 기록에도 비활성 상태 색을 다룬 문서가 없어 지어내지 않았습니다. 이건 확인이 필요해 보입니다.',
          sent_at: daysAgo(1, 10, 17),
          run: { status: 'DONE', run_id: '7d1e49a6-c3ba-4f28-9e54-6a2b8d13cf07' },
        },
      ],
      next_before: null,
    },
    '7b3e5f19-2c84-40a7-b6d3-91f5c8e02a6b': {
      results: [
        {
          id: '4f0b8e65-1b7c-40d9-a246-5e9a3f1b78b4',
          role: 'USER',
          body: '개발팀 Sync 에서 제 쪽으로 넘어온 게 있습니까?',
          sent_at: daysAgo(4, 17, 2),
          run: null,
        },
        {
          id: '5a1c9f76-2c8d-41ea-b357-6f0b4a2c89c5',
          role: 'AGENT',
          body: '두 건입니다.\n\n하나는 카드 안의 긴 제목이 잘리지 않고 넘친다는 지적입니다. 임수연 님이 그날 바로 고쳤으니 확인만 하시면 됩니다.\n\n다른 하나는 이번 주에 새 기능을 넣지 않기로 한 결정입니다. 서재민 님이 정했고, 디자인 쪽에서 준비하던 것이 있으면 다음 주로 밀립니다.',
          sent_at: daysAgo(4, 17, 8),
          run: { status: 'DONE', run_id: '8e2f5ab7-d4cb-4039-af65-7b3c9e24d018' },
        },
        {
          id: '6b2d0a87-3d9e-42fb-c468-7a1c5b3d90d6',
          role: 'USER',
          body: '그날 저는 왜 못 들어갔죠?',
          sent_at: daysAgo(4, 17, 10),
          run: null,
        },
        {
          id: '7c3e1b98-4eaf-430c-d579-8b2d6c4ea1e7',
          role: 'AGENT',
          body: '그 회의는 불참으로만 기록돼 있고 사유는 남아 있지 않습니다. 제가 대신 들어간 것도 아니라 그날 오간 말은 회의 기록에서 읽은 것입니다. 두 건은 유수인 님 몫으로 잡아 두었습니다.',
          sent_at: daysAgo(4, 17, 12),
          run: { status: 'DONE', run_id: '9f3a6bc8-e5dc-414a-b076-8c4d0f35e129' },
        },
      ],
      next_before: null,
    },
  },

  /*
    빠진 회의의 브리핑.

    셋 다 성격이 다르다 — 대리인을 보낸 회의 둘과 그냥 못 간 회의 하나다.
    대리인을 보낸 쪽에는 "무엇을 대신 답했고 무엇을 유보했는지" 가 있고,
    그냥 못 간 쪽에는 정리만 있다. 화면이 그 차이를 그리는지 볼 수 있어야 한다.
  */
  briefings: {
    // 대리인을 보냄
    'b1a11546-5743-46d4-b052-06407fb69c3c': {
      narrative:
        '자리를 비우신 90분 동안 유수인의 Bordo가 세 가지를 대신 답했습니다. 회의 슬롯 조율은 저장해 두신 "오전은 피한다" 기준으로, 디자인 시안 마감은 "8/18 을 넘기지 않는다" 는 기존 답변을 그대로 인용했습니다. 반면 개발 일정 1주 연장과 QA 기간 단축은 근거가 부족해 유보하고 본인 확인으로 넘겼습니다. 회의 결과로 시안 마감이 이틀 앞당겨지고 개발 일정이 한 주 밀렸으니, 아래 두 변경만은 먼저 확인해 주십시오.',
    },
    // 대리인을 보냄
    '2f5c1d47-9b0a-4e3c-8f61-7a4d2c9e0b13': {
      narrative:
        '연합학술제 부스 운영 킥오프에 유수인의 Bordo가 대신 들어갔습니다. 부스 운영 이틀을 오전·오후로 나누는 안이 나왔고, 첫날 오전 인원을 둘로 줄이자는 강다은 님 의견에 이견이 없었습니다. 다만 서재민 님 일정과 겹치는지는 확인할 수 없어 유보했습니다 — 그 자리에서 확정했다면 없는 근거로 남의 일정을 정하는 셈이 됐을 것입니다. 인원 배치는 아직 초안입니다.',
      needs_answer: [
        {
          id: 'na-booth-1',
          question: '첫날 오후 인원을 몇 명으로 잡을까요?',
          asked_by: '강다은',
          reason: '기록에 인원 기준이 없어 대리인이 답하지 못했습니다.',
          asked_at: daysAgo(6, 20, 30),
          answered_at: null,
        },
      ],
    },
    // 대리인 없이 그냥 못 감 — 대신 답한 것이 없어 정리만 있다
    'cdcd5cda-d887-47dc-91aa-4bb7393d461b': {
      narrative:
        '개발팀 Sync 에는 대리인을 보내지 않으셔서 대신 답한 것이 없습니다. 오간 말만 정리했습니다. 작업 모드 인덱스가 늘 비어 있던 원인이 밝혀졌고, 카드의 긴 제목이 넘치는 문제는 임수연 님이 그 자리에서 고쳤습니다. 이번 주에는 화면 연결까지만 하고 새 기능을 넣지 않기로 서재민 님이 정했습니다.',
      needs_answer: [],
    },
  },
}
