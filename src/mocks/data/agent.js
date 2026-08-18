/**
 * 대리인 화면(`/me/agent/*`)의 가상 데이터.
 *
 * ## 왜 실제 응답보다 부풀렸는가
 *
 * 실서버에서 떠 온 응답은 설정만 값이 있고 `prompts` · `conversations` 는 둘 다
 * `count: 0` 이었다. 그래서 **화면을 열어도 늘 빈 목록**이라, 프롬프트 카드가
 * 몇 줄에서 넘치는지 · 대화 목록에서 미리보기가 어디서 잘리는지를 한 번도 못
 * 봤다. 여기서는 지시 5개와 대화 4개를 채워 그 자리를 눈으로 보게 한다.
 *
 * ## 설정 키는 실제 응답 그대로다
 *
 * `mention_feasibility` · `allow_schedule_change` · `allow_midmeeting_question` ·
 * `disclose_work_plan_thought` 네 개뿐이고, 화면의 스위치는 여섯 개다(뒤의 셋이
 * 한 키를 나눠 쓴다). **전부 켜 두지 않은 이유**는 켜짐만 있으면 꺼진 스위치가
 * 어떻게 그려지는지 알 수 없기 때문이다. 지금은 2개 켜짐 · 4개 꺼짐으로 보인다.
 *
 * ## 지어낸 부분을 밝혀 둔다
 *
 * 지시·대화는 실제 응답이 비어 있어 **화면이 실제로 읽는 키만 확실하다**
 * (지시는 `id` · `body`, 대화는 `id` · `title` · `last_message_preview`,
 * 메시지는 `id` · `role` · `body`). 나머지 시각 필드는 DRF 관례로 붙여 둔
 * 것이라, 서버가 다른 이름을 쓰면 화면이 아니라 이 파일을 고치면 된다.
 *
 * ## 내용을 진짜 팀 대화처럼 쓴 이유
 *
 * 이 서비스가 답해야 하는 질문이 "내가 없는 동안 무슨 일이 있었지" 다. 채움말로
 * 채우면 화면은 차 보이지만 **그 질문에 답이 되는지는 여전히 모른다.** 그래서
 * 대리인이 유보한 대화를 하나 넣었다 — 근거가 없을 때 지어내지 않고 남겨 두는
 * 것이 이 제품이 파는 값이라, 그 자리가 화면에 어떻게 보이는지가 빈 목록보다
 * 중요하다.
 */

import { ME, PROJECTS, agentName, daysAgo, minutesAgo, person } from './people.js'

/*
  오늘 나눈 대화는 `todayAt()` 이 아니라 `minutesAgo()` 로 센다.

  `todayAt(9, 42)` 처럼 오늘의 한 시각으로 박으면 **아침 9시에 화면을 열었을 때
  그 대화가 미래에 있게 된다.** 날짜를 박아 두면 안 되는 것과 같은 문제가 하루
  안에서 다시 생기는 것이라, 오늘 것은 전부 지금 기준으로 거슬러 센다.
*/

/**
 * `GET /me/agent/settings`.
 *
 * `tone` 은 `FORMAL` · `FRIENDLY` · `CONCISE` 셋 중 하나다. 아래 대화의 말투도
 * 여기에 맞춰 정중체로 썼다 — 설정은 정중인데 대화가 반말이면, 말투 설정이
 * 실제로 먹는지 화면만 보고는 판단할 수 없다.
 *
 * `agent_name` 은 실제 응답에서 빈 문자열이었다. 비워 두면 계정 화면이 늘
 * 자리표시자만 보여 주므로, 서버의 기본 규칙(`{이름}의 Bordo`)과 같은 값을 넣어
 * 이름이 들어찬 모습을 본다.
 */
export const agentSettings = {
  mention_feasibility: true,
  // 꺼 둔 이유는 아래 첫 번째 지시("일정은 확정하지 말고 후보만")와 짝이기
  // 때문이다. 설정과 지시가 서로 어긋나면 가짜 데이터를 보고 없는 버그를 찾게 된다.
  allow_schedule_change: false,
  allow_midmeeting_question: true,
  // 이 한 키에 화면의 `작업 공개` · `계획 공개` · `생각 공개` 셋이 걸려 있다.
  // 꺼 두면 스위치 셋이 함께 꺼진 모습을 볼 수 있다.
  disclose_work_plan_thought: false,
  tone: 'FORMAL',
  agent_name: agentName(ME.name),
  active_version: 7,
  updated_at: daysAgo(2, 10, 6),
}

/**
 * `GET /me/agent/prompts` — 회의마다 다시 쓰지 않아도 되도록 걸어 두는 평소 지시.
 *
 * 최근에 넣은 것이 위로 온다(화면이 새로 만든 것을 목록 앞에 붙이므로, 같은
 * 순서여야 새로고침 전후가 같아 보인다).
 *
 * 길이를 일부러 벌려 놨다 — 한 줄짜리와 여러 문단짜리가 같은 카드 안에서 어떻게
 * 보이는지가, 이 목록을 채우는 가장 큰 이유다.
 */
export const agentPrompts = {
  count: 5,
  results: [
    {
      id: '90e2f7d1-51b4-4c63-8a7e-d4b60f2913c8',
      body: '말은 짧게 해 주십시오.',
      created_at: daysAgo(1, 23, 10),
      updated_at: daysAgo(1, 23, 10),
    },
    {
      id: '2f6c1e94-4b7a-4d51-9f38-c0a1d2e35b70',
      body: '일정은 확정하지 말고 후보만 말해 주십시오. 확정은 제가 돌아와서 하겠습니다.',
      created_at: daysAgo(2, 10, 5),
      updated_at: daysAgo(2, 10, 5),
    },
    {
      id: 'c8471ab3-6d90-4e28-b15f-2a3c9d07e6f4',
      body: '회의에서 나온 말이 근거가 되지 않으면 지어내지 말고 유보해 주십시오. '
        + '특히 "누가 무엇을 언제까지" 처럼 사람과 기한이 함께 붙는 이야기는, 그 자리에서 '
        + '그렇게 말한 사람이 없으면 제 이름으로 답하지 마십시오. 제가 없는 자리에서 제 '
        + '이름으로 생긴 약속은 나중에 되돌리기 어렵고, 되돌리는 동안 다른 사람의 일정까지 '
        + '함께 밀립니다. 모르겠으면 "확인이 필요하다" 로 남겨 두는 편이 낫습니다.',
      created_at: daysAgo(4, 21, 30),
      // 한 번 고친 적 있는 지시. 만든 시각과 고친 시각이 늘 같기만 하면, 두 값을
      // 따로 쓰는 화면이 있어도 차이가 드러나지 않는다.
      updated_at: daysAgo(3, 9, 15),
    },
    {
      id: 'a13d5c88-77e2-4a0b-8b9c-1e4f6a2d9c31',
      body: '디자인 시안은 제 확인 전에는 공유하지 마십시오. 작업 중이라는 사실까지만 말해 주십시오.',
      created_at: daysAgo(6, 15, 20),
      updated_at: daysAgo(6, 15, 20),
    },
    {
      id: '5e9b0f42-3c16-4a7d-9d02-8f7b1c6e4a55',
      body: `구현 난이도를 물으면 ${person('임수연').name} 님과 상의가 필요하다고 답하고, `
        + '되는지 안 되는지는 임의로 판단하지 마십시오.',
      created_at: daysAgo(9, 11, 45),
      updated_at: daysAgo(9, 11, 45),
    },
  ],
}

/**
 * `GET /me/agent/conversations` — 대리인과 나 둘뿐인 대화. 최근 순이다.
 *
 * **맨 앞이 채워져 있어야 한다.** 화면이 목록의 첫 번째를 자동으로 열기 때문에,
 * 빈 대화를 앞에 두면 열자마자 "아직 나눈 대화가 없습니다" 만 보여 나머지를 안
 * 보게 된다. 그래서 한 번도 안 쓴 대화는 맨 뒤에 뒀다.
 */
export const agentConversations = {
  count: 4,
  results: [
    {
      id: 'd41c8e07-9a53-4bd6-8f21-6e0b7c53a9d2',
      title: '킥오프 회의에서 디자인 쪽만',
      last_message_preview: '나왔지만 확정하지 않았습니다. 목요일과 금요일이 후보로만…',
      last_message_at: minutesAgo(22),
      message_count: 4,
      created_at: minutesAgo(360),
      updated_at: minutesAgo(22),
    },
    {
      id: '7b3e5f19-2c84-40a7-b6d3-91f5c8e02a6b',
      title: '로그인 시안, 회의에서 어떻게 답했습니까',
      last_message_preview: '판단하지 않고 남겨 두었습니다. 회의에서는 사실만 나왔고…',
      last_message_at: daysAgo(1, 20, 10),
      message_count: 4,
      created_at: daysAgo(1, 20, 5),
      updated_at: daysAgo(1, 20, 10),
    },
    {
      id: 'f052a6c4-8b71-4e39-9c05-3d7a1e64b8f0',
      title: `${PROJECTS.academy.name} 발표 순서`,
      last_message_preview: '시연 스크립트에서 디자인 설명이 들어갈 자리를 표시해 두겠습니다.',
      last_message_at: daysAgo(3, 16, 16),
      message_count: 4,
      created_at: daysAgo(3, 16, 12),
      updated_at: daysAgo(3, 16, 16),
    },
    {
      /*
        만들어 두고 한 번도 안 쓴 대화.

        목록 줄에서 미리보기가 빈 문자열일 때 화면이 대신 넣는 문구가 있는데,
        진짜 데이터가 전부 채워져 있으면 그 코드가 한 번도 안 밟힌다.
      */
      id: '31a97d5b-46e0-4f82-a3c9-b5e28017d64a',
      title: '이번 주에 물어볼 것',
      last_message_preview: '',
      last_message_at: null,
      message_count: 0,
      created_at: daysAgo(5, 18, 0),
      updated_at: daysAgo(5, 18, 0),
    },
  ],
}

/**
 * 대화 id → `GET /me/agent/conversations/{id}/messages`.
 *
 * 오래된 것이 앞이다. 화면이 마지막 줄을 보고 "대리인 답이 왔는지" 를 판단해서
 * (`results[results.length - 1].role`), 순서를 뒤집으면 답이 이미 와 있는 대화가
 * 계속 기다리는 중으로 보인다.
 *
 * `run` 은 내 메시지에만 붙는다 — 서버가 내 말을 받아 큐에 넣고 그 결과로 대리인
 * 답을 만들기 때문이다. 답 쪽에는 실행이 없으므로 `null` 이다.
 */
export const conversationMessages = {
  // ── 오늘. 회의에 못 간 사람이 실제로 묻게 되는 모양.
  'd41c8e07-9a53-4bd6-8f21-6e0b7c53a9d2': {
    results: [
      {
        id: '0b6f4a21-7d38-4c95-8e02-1a5c9b7e34d0',
        role: 'USER',
        body: '어제 킥오프에 제가 못 갔습니다. 디자인 쪽으로 나온 이야기만 정리해 주십시오.',
        sent_at: minutesAgo(360),
        run: { status: 'DONE', run_id: '6c0d38f5-b2a9-4e17-8d43-5f19a7c02be6' },
      },
      {
        // 긴 답. 말풍선이 여러 문단일 때 줄 간격과 스크롤이 어떻게 되는지 보려고
        // 일부러 길게 뒀다.
        id: '1c7e5b32-8e49-4da6-9f13-2b6d0c8f45e1',
        role: 'AGENT',
        body: '세 가지였습니다.\n\n'
          + `첫째, 플로우 화면의 노드 색을 콘텐츠 종류별로 나누기로 했습니다. ${person('최비성').name} `
          + '님이 서버에서 종류를 그대로 내려 준다고 하여, 어떤 색을 쓸지는 디자인에서 정하면 됩니다.\n\n'
          + '둘째, 로그인 화면 시안은 공유하지 않았습니다. 확인 전에는 공유하지 말라는 지시가 있어 '
          + '작업 중이라는 사실까지만 전달했습니다.\n\n'
          + `셋째, ${person('임수연').name} 님이 버튼 컴포넌트에 비활성 상태 색이 정의돼 있지 않아 `
          + '임의로 회색을 쓰고 있다고 했습니다. 이건 확인이 필요해 보입니다.',
        sent_at: minutesAgo(352),
        run: null,
      },
      {
        id: '2d8f6c43-9f5a-4eb7-a024-3c7e1d9056f2',
        role: 'USER',
        body: '비활성 색은 제가 오늘 올리겠습니다. 그 자리에서 마감 날짜도 나왔습니까?',
        sent_at: minutesAgo(340),
        run: { status: 'DONE', run_id: '7d1e49a6-c3ba-4f28-9e54-6a20b8d13cf7' },
      },
      {
        id: '3e907d54-a06b-4fc8-b135-4d8f2e0167a3',
        role: 'AGENT',
        body: `나왔지만 확정하지 않았습니다. ${person('서재민').name} 님이 목요일과 금요일을 후보로 `
          + '말했고, 일정은 확정하지 말라는 지시가 있어 후보만 기록해 두었습니다. 확정은 돌아오신 '
          + '뒤에 하기로 정리했습니다.',
        sent_at: minutesAgo(22),
        run: null,
      },
    ],
    next_before: null,
  },

  // ── 어제. **대리인이 유보한 대화.** 이 파일에서 가장 중요한 자리다.
  '7b3e5f19-2c84-40a7-b6d3-91f5c8e02a6b': {
    results: [
      {
        id: '4fa18e65-b17c-4a09-8246-5e903f1278b4',
        role: 'USER',
        body: `${person('최비성').name} 님이 로그인 화면 시안을 지금 볼 수 있냐고 물었다고 들었습니다. `
          + '어떻게 답하셨습니까?',
        sent_at: daysAgo(1, 20, 5),
        run: { status: 'DONE', run_id: '8e2f5ab7-d4cb-4039-af65-7b31c9e24d08' },
      },
      {
        id: '50b29f76-c28d-4b1a-9357-6f0a4e2389c5',
        role: 'AGENT',
        body: '공유하지 않았습니다. 확인 전에는 시안을 공유하지 말라는 지시가 있어, 작업 중이라는 '
          + '사실까지만 말하고 링크는 전달하지 않았습니다.',
        sent_at: daysAgo(1, 20, 6),
        run: null,
      },
      {
        id: '61c30a87-d39e-4c2b-a468-701b5f349ad6',
        role: 'USER',
        body: '그럼 비성 님이 말한 "로그인 응답에 프로필 이미지가 없다" 는 건 시안을 바꿔야 한다는 '
          + '뜻입니까?',
        sent_at: daysAgo(1, 20, 9),
        run: { status: 'DONE', run_id: '9f3a6bc8-e5dc-414a-b076-8c42d0f35e19' },
      },
      {
        // 유보. 답을 못 한 것이 아니라 **답하지 않기로 한 것**이라는 게 문장에서
        // 드러나야 한다 — 화면에서 이 둘이 같은 말풍선으로 보이면 곤란하다.
        id: '72d41b98-e4af-4d3c-b579-812c6045abe7',
        role: 'AGENT',
        body: '판단하지 않고 남겨 두었습니다. 회의에서는 "응답에 프로필 이미지가 없다" 는 사실만 '
          + '나왔고, 그것이 시안을 바꾸자는 뜻인지 기본 이미지로 대체하자는 뜻인지는 아무도 말하지 '
          + '않았습니다. 제가 둘 중 하나로 정하면 회의에 없던 결정이 생깁니다. 비성 님께 확인이 '
          + '필요합니다.',
        sent_at: daysAgo(1, 20, 10),
        run: null,
      },
    ],
    next_before: null,
  },

  // ── 사흘 전. 짧게 끝난 대화. 한 줄짜리 말풍선도 섞여 있어야 한다.
  'f052a6c4-8b71-4e39-9c05-3d7a1e64b8f0': {
    results: [
      {
        id: '83e52ca9-f5b0-4e4d-b68a-923d7156bcf8',
        role: 'USER',
        body: `${PROJECTS.academy.name} 회의에서 발표 순서 정해졌습니까?`,
        sent_at: daysAgo(3, 16, 12),
        run: { status: 'DONE', run_id: 'a04b7cd9-06ed-425b-a187-9d53e1046f2a' },
      },
      {
        id: '94f63dba-06c1-4f5e-979b-a34e8267cd09',
        role: 'AGENT',
        body: `정해졌습니다. 팀 소개는 ${person('서재민').name} 님, 화면 시연은 `
          + `${person('임수연').name} 님, 구조 설명은 ${person('최비성').name} 님입니다. `
          + '디자인 설명 자리는 따로 두지 않고 화면 시연 안에 넣기로 했습니다.',
        sent_at: daysAgo(3, 16, 13),
        run: null,
      },
      {
        id: 'a5074ecb-17d2-4a6f-a8ac-b45f9378de1a',
        role: 'USER',
        body: '알겠습니다.',
        sent_at: daysAgo(3, 16, 15),
        run: { status: 'DONE', run_id: 'b15c8dea-17fe-4360-9298-ae64f2157a3b' },
      },
      {
        id: 'b6185fdc-28e3-4b70-a9bd-c560a489ef2b',
        role: 'AGENT',
        body: '시연 스크립트에서 디자인 설명이 들어갈 자리를 표시해 두겠습니다.',
        sent_at: daysAgo(3, 16, 16),
        run: null,
      },
    ],
    next_before: null,
  },

  // ── 만들어만 두고 안 쓴 대화. 목록에서 골랐을 때 빈 화면이 어떻게 그려지는지.
  '31a97d5b-46e0-4f82-a3c9-b5e28017d64a': {
    results: [],
    next_before: null,
  },
}
