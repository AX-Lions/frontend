/**
 * 회의 대리 참석 준비 화면 (`GET /meetings/{id}/prep`).
 *
 * 서버가 **문자열을 완성해서** 내려주는 응답이다. `논쟁점 01` 의 두 자리 맞춤도,
 * `8월 18일 14:00 - 15:00` 도, 뱃지 문구도 여기서 만들어진다 — 화면마다 조합하면
 * 같은 회의가 화면마다 다른 시각으로 보인다. 가상 데이터도 그 규칙을 지킨다.
 *
 * 세 회의를 준비한다.
 *
 * | 회의 | 무엇을 보게 하려고 |
 * |---|---|
 * | 디자인 리뷰 | 이미 맡긴 회의. 논쟁점 3개 중 2개에 **입장이 저장돼 있다** |
 * | 정기 팀 회의 | 아직 안 맡긴 회의. 논쟁점은 있고 **입장은 하나도 없다** |
 * | 글로벌 파트너 싱크 | **논쟁점이 아직 없는** 회의. 빈 목록 문구를 보는 자리 |
 *
 * 셋을 나눈 이유는 이 화면의 상태 뱃지가 세 갈래라서다(`답변완료 · 답변중 · 답변필요`).
 * 한 회의만 두면 `답변필요` 를 보려고 저장된 입장을 지워야 하고, 지우고 나면
 * `답변완료` 를 다시 못 본다.
 */

const MEETINGS = {
  designReview: 'baf061c5-2efc-4ca8-80e5-cecc15582780',
  standup: '4eb1040f-18d7-4841-bc72-360846888c3d',
  partnerSync: 'c47e9b30-5a68-4f21-8d0c-6b39f2ae7154',
}

/** 화면 뱃지와 1:1. 서버(`prep.py`)의 표를 그대로 옮긴다. */
const STATUS_LABEL = { ANSWERED: '답변완료', NEEDED: '답변필요' }

/**
 * 논쟁점 한 줄.
 *
 * `stance` 가 있으면 `ANSWERED`, 없으면 `NEEDED` 다. 상태와 라벨을 손으로 적지
 * 않는 이유는, 입장을 저장한 뒤 목록을 다시 그릴 때 **뱃지만 옛 값으로 남는**
 * 어긋남이 실제로 났기 때문이다.
 */
function pointOf({ id, order, title, options = [], rationale, evidence = [], stance = null }) {
  const status = stance ? 'ANSWERED' : 'NEEDED'
  return {
    id,
    order,
    label: `논쟁점 ${String(order).padStart(2, '0')}`,
    title,
    options,
    rationale,
    evidence,
    created_by_agent: true,
    status,
    status_label: STATUS_LABEL[status],
    stance: stance ? {
      id: `stance-${id}`,
      option_key: stance.option_key ?? null,
      body: stance.body,
      updated_at: stance.updated_at,
    } : null,
  }
}

function debateOf(points) {
  return {
    notice: points.length
      ? `Bordo가 회의 자료와 이전 논의를 바탕으로 ${points.length}개의 논쟁점을 예상했어요.`
      : '아직 예상된 논쟁점이 없어요. 회의 자료가 쌓이면 Bordo가 예상해 드려요.',
    count: points.length,
    answered_count: points.filter((one) => one.status === 'ANSWERED').length,
    points,
  }
}

/* ------------------------------------------------------------- 논쟁점 */

/*
  근거 카드는 **예측 당시의 스냅샷**이다.

  필드 이름을 서버(`DebatePoint.evidence`)와 한 글자까지 맞춘다. 여기서만
  `label`·`actor` 같은 편한 이름을 쓰면, 가상 데이터에서는 잘 그려지고
  실서버에서는 빈 칸이 나온다 — 그러면 이 모드로 확인하는 의미가 없다.
*/
const designReviewPoints = [
  pointOf({
    id: 'dp-design-1',
    order: 1,
    title: '간격 토큰을 이번 주에 확정할지, 다음 주로 미룰지',
    options: [
      {
        key: 'this_week',
        title: '이번 주 확정',
        description: '남은 화면 작업이 같은 간격 값을 쓰게 됩니다. 대신 이미 반영한 화면을 다시 손봐야 합니다.',
      },
      {
        key: 'next_week',
        title: '다음 주로 미룸',
        description: '토큰 정리를 끝내고 한 번에 반영합니다. 그동안은 현재 값으로 계속 갑니다.',
      },
    ],
    rationale: '지난 회의에서 A안으로 방향은 잡혔지만 간격 값은 아직 정리 중입니다. '
      + '오늘 확정하자는 말이 나올 가능성이 있어 미리 여쭙습니다.',
    evidence: [
      {
        kind: 'meeting',
        title: '디자인 리뷰 · 지난 회의',
        who: '유수인',
        body: '간격 토큰은 초안까지만 잡아 뒀어요. 값 확정은 화면 작업 보고 정하는 게 나을 것 같습니다.',
        at: '2026-08-15T16:40:00+09:00',
        link: '/flow-board?meeting=baf061c5-2efc-4ca8-80e5-cecc15582780',
      },
      {
        kind: 'work',
        title: '디자인 토큰 정의서 v0.3',
        who: '유수인',
        body: '간격 스케일 4/8/12/16 초안. 20 이상은 미정으로 남겨 둠.',
        at: '2026-08-16T10:05:00+09:00',
        link: null,
      },
    ],
    stance: {
      option_key: 'next_week',
      body: '간격 값은 다음 주로 미뤄 주세요. 지금 확정하면 이미 반영한 화면 네 개를 '
        + '다시 손봐야 합니다. A안 방향 자체에는 동의합니다.',
      updated_at: '2026-08-17T11:20:00+09:00',
    },
  }),
  pointOf({
    id: 'dp-design-2',
    order: 2,
    title: '다크 모드를 MVP 범위에 넣을지',
    options: [
      {
        key: 'include',
        title: '넣는다',
        description: '시안이 이미 있어 추가 디자인 없이 갑니다. 화면마다 색 토큰을 두 벌 검증해야 합니다.',
      },
      {
        key: 'exclude',
        title: '뺀다',
        description: '이번 범위를 그대로 유지합니다. 시안은 다음 반영을 위해 남겨 둡니다.',
      },
    ],
    rationale: '시안에 다크 모드 화면이 함께 올라와 있어 범위로 오해될 수 있습니다.',
    evidence: [
      {
        kind: 'work',
        title: '화면 정의서 · 다크 모드 시안',
        who: '유수인',
        body: '라이트 시안과 나란히 올려 뒀습니다. 범위 논의는 아직 안 했습니다.',
        at: '2026-08-16T14:20:00+09:00',
        link: null,
      },
    ],
    stance: {
      option_key: 'exclude',
      body: '이번 범위에서는 빼는 쪽입니다. 범위가 두 번 줄어든 프로젝트라 '
        + '다시 늘리는 것이 제일 큰 위험이라고 봅니다.',
      updated_at: '2026-08-17T11:24:00+09:00',
    },
  }),
  /*
    **답이 없는 줄을 하나 남겨 둔다.**

    셋 다 채워 두면 `답변필요` 뱃지도, 빈 칸에서 시작하는 입력도, 저장 직후
    뱃지가 바뀌는 것도 볼 수 없다. 이 화면에서 제일 자주 확인해야 하는 흐름이다.
  */
  pointOf({
    id: 'dp-design-3',
    order: 3,
    title: '아이콘 세트를 자체 제작할지 외부 라이브러리를 쓸지',
    options: [
      {
        key: 'custom',
        title: '자체 제작',
        description: '선 굵기와 모서리를 시안과 맞출 수 있습니다. 아이콘이 늘 때마다 손이 갑니다.',
      },
      {
        key: 'library',
        title: '외부 라이브러리',
        description: '지금 있는 것을 바로 씁니다. 시안과 선 굵기가 미묘하게 어긋납니다.',
      },
    ],
    rationale: '현재 시안에는 자체 아이콘과 라이브러리 아이콘이 섞여 있습니다.',
    evidence: [
      {
        kind: 'meeting',
        title: '디자인 채널',
        who: '임수연',
        body: '지금 화면에 자체 아이콘이랑 라이브러리 아이콘이 섞여 있어요. 하나로 정해야 할 것 같습니다.',
        at: '2026-08-16T19:12:00+09:00',
        link: null,
      },
    ],
  }),
]

const standupPoints = [
  pointOf({
    id: 'dp-standup-1',
    order: 1,
    title: '이번 주 배포를 목요일로 당길지',
    options: [
      {
        key: 'thursday',
        title: '목요일',
        description: '리허설 전에 배포가 끝납니다. 수요일까지 기능을 잠가야 합니다.',
      },
      {
        key: 'friday',
        title: '금요일 유지',
        description: '하루를 더 씁니다. 리허설과 겹쳐 문제가 나면 손볼 사람이 없습니다.',
      },
    ],
    rationale: '발표 리허설이 금요일 오전이라 배포가 겹칩니다.',
    evidence: [
      {
        kind: 'meeting',
        title: '연합학술제 리허설 일정',
        who: '강다은',
        body: '리허설은 21일 금요일 오전 10시입니다. 그날 오전은 다들 현장에 있어요.',
        at: '2026-08-17T09:30:00+09:00',
        link: null,
      },
    ],
  }),
  pointOf({
    id: 'dp-standup-2',
    order: 2,
    title: '가상 데이터 모드를 발표 시연에 쓸지',
    options: [
      {
        key: 'mock',
        title: '가상 데이터로 시연',
        description: '네트워크와 무관하게 같은 화면이 나옵니다. 실제로 도는 서버가 아니라는 점은 말해야 합니다.',
      },
      {
        key: 'real',
        title: '실서버로 시연',
        description: '진짜 동작을 보여 줍니다. 네트워크가 끊기면 복구할 방법이 없습니다.',
      },
    ],
    rationale: '실서버 시연은 네트워크에 걸리면 복구할 방법이 없습니다.',
    evidence: [
      {
        kind: 'meeting',
        title: '개발 채널',
        who: '최비성',
        body: '지난번 발표 때 와이파이가 끊겨서 3분 정도 아무것도 못 보여 줬습니다.',
        at: '2026-08-17T21:04:00+09:00',
        link: null,
      },
    ],
  }),
]

/* --------------------------------------------------------------- 헤더 */

function headerOf({ meetingId, title, projectName, when, delegated, status = 'SCHEDULED' }) {
  return {
    meeting_id: meetingId,
    title,
    project_name: projectName,
    team_name: 'AX Lions',
    when,
    location: 'Discord',
    status,
    delegated,
    // 뱃지 문구도 서버가 만든다. 화면이 필드를 조합하면 `대리 참석 예정` 과
    // `대리 참석 중` 이 화면마다 갈린다.
    badge: delegated
      ? `Bordo 대리 참석 ${status === 'ACTIVE' ? '중' : '예정'}`
      : '참석 예정',
  }
}

/* ----------------------------------------------------------- 활동 설정 */

/**
 * 「Bordo 활동 설정」.
 *
 * 평소 설정(`standing_settings`)과 **이번 회의에 실제로 쓰일 값**(`settings`)을
 * 함께 내려준다. 화면에 `현재 설정 사용` 과 `이번에만 다르게 사용` 이 나란히
 * 있어서, 되돌렸을 때 무엇으로 돌아가는지 보여주려면 둘 다 있어야 한다.
 */
function setupOf({ standing, override = null, extraNote = '', sources = null, prompts }) {
  const settings = override ? { ...standing, ...override } : standing
  return {
    mode: override ? 'ONCE' : 'STANDING',
    mode_label: override ? '이번에만 다르게 사용' : '현재 설정 사용',
    settings,
    standing_settings: standing,
    overridden_keys: override ? Object.keys(override).sort() : [],
    prompts: prompts.map((one) => one.body),
    standing_prompts: prompts,
    standing_prompt_limit: prompts.length,
    extra_note: extraNote,
    // `null` 은 고른 적 없음(제한 없음), `[]` 는 아무것도 안 봄. 둘을 같게
    // 다루면 아무것도 안 고른 사람에게 전부 켜진 화면을 보여 주게 된다.
    sources,
  }
}

const STANDING = {
  mention_feasibility: true,
  allow_schedule_change: false,
  allow_midmeeting_question: true,
  disclose_work: true,
  disclose_plan: true,
  disclose_thought: false,
}

const STANDING_PROMPTS = [
  { id: 'ap-1', body: '마감 일정을 묻는 말에는 확정된 날짜만 답하고, 확정 전이면 미확정이라고 말해 주세요.' },
  { id: 'ap-2', body: '제 이름으로 새 작업을 맡기로 약속하지 마세요. 검토해 보겠다고만 전해 주세요.' },
  { id: 'ap-3', body: '근거가 부족하면 지어내지 말고 본인 확인이 필요하다고 남겨 주세요.' },
]

/* --------------------------------------------------------------- 응답 */

export const preps = {
  [MEETINGS.designReview]: {
    header: headerOf({
      meetingId: MEETINGS.designReview,
      title: '디자인 리뷰',
      projectName: 'Bordo',
      when: '8월 18일 14:00 - 15:00',
      delegated: true,
    }),
    debate: debateOf(designReviewPoints),
    agent_setup: setupOf({
      standing: STANDING,
      // 이 회의만 일정 변경을 열어 뒀다. `이번에만 다르게 사용` 이 실제로
      // 무엇을 바꾸는지 화면에서 확인할 수 있는 유일한 자리다.
      override: { allow_schedule_change: true },
      extraNote: '간격 값을 오늘 확정하자는 말이 나오면 제 확인 없이 정하지 말고 '
        + '다음 주로 미뤄 달라고 전해 주세요.',
      sources: ['work', 'plan', 'document'],
      prompts: STANDING_PROMPTS,
    }),
  },

  [MEETINGS.standup]: {
    header: headerOf({
      meetingId: MEETINGS.standup,
      title: '정기 팀 회의',
      projectName: 'Bordo',
      when: '8월 18일 09:30 - 10:00',
      delegated: false,
    }),
    debate: debateOf(standupPoints),
    agent_setup: setupOf({ standing: STANDING, prompts: STANDING_PROMPTS }),
  },

  [MEETINGS.partnerSync]: {
    header: headerOf({
      meetingId: MEETINGS.partnerSync,
      title: '글로벌 파트너 정기 싱크',
      projectName: 'Bordo',
      when: '8월 18일 21:30 - 22:30',
      delegated: false,
    }),
    debate: debateOf([]),
    agent_setup: setupOf({ standing: STANDING, prompts: STANDING_PROMPTS }),
  },
}

export { STATUS_LABEL as PREP_STATUS_LABEL, pointOf as prepPointOf }
