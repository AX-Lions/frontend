/**
 * 회의 도메인 가상 데이터 — 회의 상세 · 요약표 · Bordo 브리핑 · 인덱스.
 *
 * ## 왜 이렇게 만들었는가
 *
 * 이 파일이 답해야 하는 질문은 하나다 — **"내가 없는 동안 무슨 일이 있었지"**.
 * 그래서 분량을 브리핑에 몰아 뒀다. 로그인한 사람(유수인)이 **대리 참석으로
 * 빠진 회의**를 맨 앞에 두고 그 회의에만 확인·요청·유보 카드를 가득 채운다.
 * 회의 여섯 개에 골고루 조금씩 나눠 담으면 어느 화면을 열어도 절반쯤 빈
 * 상태가 되어, 정작 보여 줘야 할 화면이 제일 초라해진다.
 *
 * `used_answers`(대리인이 실제로 답한 것)와 `deferred_answers`(유보한 것)를
 * **둘 다** 채운다. 화면에는 아직 안 그리지만, 유보가 하나도 없는 응답을
 * 만들어 두면 "근거가 부족하면 유보한다" 는 이 서비스의 차별점이 데이터
 * 단계에서부터 사라진다.
 *
 * 화살표 id 는 실제 응답에 있던 값을 그대로 쓴다. 안건이나 칩을 눌렀을 때 판의
 * 화살표가 강조되는 동작은 `flow.js` 의 엣지 id 와 **글자 그대로 같아야만**
 * 일어나기 때문이다. 반대로 아직 오간 것이 없는 자리(예정 회의의 안건)는
 * 억지로 물리지 않고 빈 배열로 둔다 — 빈 배열은 "연결이 없다" 지만 틀린 id 는
 * "엉뚱한 화살표가 켜진다" 다.
 *
 * 예정 회의 한 건(디자인 리뷰)은 요약표·브리핑을 **일부러 비운다.** 아직 안
 * 열린 회의는 원래 비어 있고, 화면이 그 상태를 어떻게 그리는지 확인할 데가
 * 여기뿐이다. 다만 목록 자체를 비우지는 않는다.
 */

import { ME, PEOPLE, PROJECTS, TEAM, agentName, daysAgo, minutesAgo, person, todayAt } from './people.js'
import { meetingAgendas } from './flow.js'

/** 팀이 회의를 여는 Discord 채널. 실제 응답과 같은 값이다. */
const DISCORD_CHANNEL = '556677889900'

/**
 * 회의 id.
 *
 * 앞의 셋은 홈 화면이 쓰는 것과 **같은 값이어야** 한다. 홈에서 누른 회의가
 * 플로우에서 안 열리는 것이 이 저장소에서 제일 자주 난 어긋남이다.
 */
const MEETING_IDS = {
  direction: 'b1a11546-5743-46d4-b052-06407fb69c3c',
  designReview: 'baf061c5-2efc-4ca8-80e5-cecc15582780',
  weekly: '4eb1040f-18d7-4841-bc72-360846888c3d',
  devSync: 'cdcd5cda-d887-47dc-91aa-4bb7393d461b',
  academyKickoff: '2f5c1d47-9b0a-4e3c-8f61-7a4d2c9e0b13',
  academyRehearsal: '9d3e7b28-4c15-4a6f-b072-51e8f6a3c4d9',
  // 홈이 이 둘을 가리킨다(최근 회의 · 오늘 일정). 상세가 없으면 홈에서
  // 눌렀을 때 플로우 화면이 회의를 못 찾는다.
  academyBooth: '0a3f6cd2-71b5-4d8e-9c4a-2f7b8e15d093',
  partnerSync: 'c47e9b30-5a68-4f21-8d0c-6b39f2ae7154',
}

/**
 * 지난 회의에서 오간 화살표 id.
 *
 * 내용 6종으로 갈라 두는 이유는 브리핑의 정보 위치 칩이 `content_type` 단위로
 * 화살표를 묶기 때문이다. 여기서 한 번만 나눠 두면 칩 · 안건 · 확인 카드가
 * 모두 같은 id 를 보게 되어, 칩을 눌러 목록을 걸렀을 때 판에서도 같은 화살표가
 * 켜진다.
 */
const EDGES = {
  OPINION: [
    '234b09bc-8060-4790-96ae-e13923ed407e',
    '022067fc-5a42-44bb-96f6-74839b58dd41',
    'b8ada828-137c-46ab-abcc-a96b793711ad',
  ],
  REQUEST: [
    'ad6aec74-a042-411b-949f-981e3f95d79a',
    '7cca9f5c-8c93-426c-b5cb-9aad7543d472',
    'e0cfc42f-391a-442d-9422-53c52d0fa6e1',
  ],
  CHANGE: [
    'd69da90d-098b-4c06-a083-6c0c6265a618',
    'edfe8900-5a38-4eeb-a3ba-aa813ac869e9',
  ],
  SCHEDULE: ['84029327-adfb-4845-a315-27f275b80d92'],
  CONCLUSION: ['1b1833e3-7c4d-4f7f-a101-9779ba318776'],
  ETC: ['db0ccbc8-424d-470b-8108-3e02e578b078'],
}

/** 안건 id. 브리핑의 `agenda_id` 와 인덱스의 `id` 가 같은 값을 봐야 한다. */
const AGENDA_IDS = {
  slot: '6f156c00-027e-4f89-8272-6c811c2d39e5',
  designDeadline: '1fde0c91-5d7f-4e2a-bdcb-cef8f7882771',
  scheduleExtension: '85eef546-d408-4251-8cd5-5ae6558778c8',
  qaWindow: 'c3b2a1d0-7e64-4f18-9a25-0d7b8c6e4f31',
  discordScope: '5a90e2f7-1c48-4b63-8d07-e2f95a1b6c84',
  nextAgenda: '7e41c9b5-3d82-4a70-91ef-6b0c4d28a5f3',
}

/**
 * 유보한 질문에 답하러 들어가는 방.
 *
 * `chat.js` 의 대리인 방 id 다. 이 값이 어긋나면 브리핑에서 질문을 눌렀을 때
 * 열릴 대화가 없다.
 */
const AGENT_ROOM = '6e1b85a4-d3b7-4abd-92f8-1e4eb692caec'

/**
 * 참석자 목록.
 *
 * 이름과 참석 상태만 적으면 나머지는 `people.js` 에서 끌어온다. id 를 손으로
 * 옮겨 적다 한 글자 틀리면 판에서 사람을 눌러도 참석 상태가 안 뜬다.
 */
function attendees(byName) {
  return Object.entries(byName).map(([name, attendance]) => {
    const who = person(name)
    return {
      user_id: who.id,
      name: who.name,
      attendance,
      delegated: attendance === 'DELEGATED',
    }
  })
}

/** 전원이 같은 상태인 회의(대개 예정). 다섯 명을 다시 나열할 이유가 없다. */
function everyone(attendance) {
  return PEOPLE.map((who) => ({
    user_id: who.id,
    name: who.name,
    attendance,
    delegated: false,
  }))
}

function meetingOf({
  id, project, title, status, scheduledAt,
  startedAt = null, endedAt = null, durationMin = 60, participants,
}) {
  return {
    id,
    project_id: project.id,
    project_name: project.name,
    title,
    status,
    scheduled_at: scheduledAt,
    duration_min: durationMin,
    discord_channel_id: DISCORD_CHANNEL,
    started_at: startedAt,
    ended_at: endedAt,
    participants,
    version: 1,
    created_at: scheduledAt,
    updated_at: endedAt ?? scheduledAt,
  }
}

/* ------------------------------------------------------------------ 회의 */

const directionMeeting = meetingOf({
  id: MEETING_IDS.direction,
  project: PROJECTS.bordo,
  title: '글로벌 회의 일정 및 개발 방향 논의',
  status: 'ENDED',
  scheduledAt: daysAgo(1, 20),
  startedAt: daysAgo(1, 20),
  endedAt: daysAgo(1, 21, 30),
  durationMin: 90,
  // 유수인만 대리 참석이다. **이 한 줄이 브리핑 화면의 전제**라, 여기를
  // PRESENT 로 바꾸면 "내가 없는 동안" 이 성립하지 않는다.
  participants: attendees({
    유수인: 'DELEGATED',
    최비성: 'PRESENT',
    임수연: 'PRESENT',
    서재민: 'PRESENT',
    강다은: 'PRESENT',
  }),
})

const designReviewMeeting = meetingOf({
  id: MEETING_IDS.designReview,
  project: PROJECTS.bordo,
  title: '디자인 리뷰',
  status: 'CONFIRMED',
  // 음수를 넣으면 내일이 된다. 예정 회의를 고정 날짜로 박으면 하루만 지나도
  // 지난 회의가 `예정` 인 채로 남는다.
  scheduledAt: daysAgo(-1, 15),
  participants: everyone('PENDING'),
})

const weeklyMeeting = meetingOf({
  id: MEETING_IDS.weekly,
  project: PROJECTS.bordo,
  title: '정기 팀 회의',
  status: 'ACTIVE',
  scheduledAt: todayAt(10),
  startedAt: todayAt(10),
  participants: attendees({
    유수인: 'PRESENT',
    최비성: 'PRESENT',
    임수연: 'PRESENT',
    서재민: 'PRESENT',
    // 베를린은 아직 새벽이다. 시간대가 다른 사람이 늘 참석하는 것으로 두면
    // 그 사정이 데이터 어디에도 안 남는다.
    강다은: 'DELEGATED',
  }),
})

const devSyncMeeting = meetingOf({
  id: MEETING_IDS.devSync,
  project: PROJECTS.bordo,
  title: '개발팀 Sync',
  status: 'ENDED',
  scheduledAt: daysAgo(3, 21),
  startedAt: daysAgo(3, 21),
  endedAt: daysAgo(3, 22),
  participants: attendees({
    유수인: 'ABSENT',
    최비성: 'PRESENT',
    임수연: 'PRESENT',
    서재민: 'PRESENT',
    강다은: 'DELEGATED',
  }),
})

const academyKickoffMeeting = meetingOf({
  id: MEETING_IDS.academyKickoff,
  project: PROJECTS.academy,
  title: '연합학술제 부스 운영 킥오프',
  status: 'ENDED',
  scheduledAt: daysAgo(5, 19),
  startedAt: daysAgo(5, 19),
  endedAt: daysAgo(5, 20, 20),
  durationMin: 80,
  participants: attendees({
    유수인: 'DELEGATED',
    최비성: 'PRESENT',
    임수연: 'ABSENT',
    서재민: 'PRESENT',
    강다은: 'PRESENT',
  }),
})

const academyRehearsalMeeting = meetingOf({
  id: MEETING_IDS.academyRehearsal,
  project: PROJECTS.academy,
  title: '발표 리허설',
  status: 'SCHEDULED',
  scheduledAt: daysAgo(-3, 18),
  participants: everyone('PENDING'),
})

/*
  홈이 가리키는 두 회의.

  하나는 이미 끝났고(최근 회의 카드), 하나는 오늘 예정이다(오늘 일정).
  **홈에 뜨는 것은 전부 상세가 있어야 한다** — 눌렀을 때 열릴 화면이 없으면
  카드가 죽은 링크가 된다.
*/
const academyBoothMeeting = meetingOf({
  id: MEETING_IDS.academyBooth,
  project: PROJECTS.academy,
  title: '연합학술제 발표 자료 초안 검토 및 부스 운영 인원 배치 논의',
  status: 'ENDED',
  scheduledAt: daysAgo(6, 19, 30),
  startedAt: daysAgo(6, 19, 32),
  endedAt: daysAgo(6, 20, 40),
  durationMin: 70,
  participants: attendees({
    유수인: 'PRESENT',
    강다은: 'PRESENT',
    서재민: 'ABSENT',
    임수연: 'PRESENT',
  }),
})

const partnerSyncMeeting = meetingOf({
  id: MEETING_IDS.partnerSync,
  project: PROJECTS.bordo,
  title: '글로벌 파트너 정기 싱크',
  status: 'CONFIRMED',
  scheduledAt: todayAt(21, 30),
  durationMin: 45,
  participants: everyone('PENDING'),
})

const ALL_MEETINGS = [
  directionMeeting,
  designReviewMeeting,
  weeklyMeeting,
  devSyncMeeting,
  academyKickoffMeeting,
  academyRehearsalMeeting,
  academyBoothMeeting,
  partnerSyncMeeting,
]

export const meetings = Object.fromEntries(ALL_MEETINGS.map((one) => [one.id, one]))

/** 최근 것이 위다. 헤더의 회의 선택(▼)에서 방금 끝난 회의를 맨 앞에 봐야 한다. */
function meetingList(items) {
  const results = [...items].sort((a, b) => (a.scheduled_at < b.scheduled_at ? 1 : -1))
  return { count: results.length, results }
}

export const projectMeetings = {
  [PROJECTS.bordo.id]: meetingList([
    directionMeeting, designReviewMeeting, weeklyMeeting, devSyncMeeting,
  ]),
  [PROJECTS.academy.id]: meetingList([academyKickoffMeeting, academyRehearsalMeeting]),
}

/* --------------------------------------------------------------- 요약표 */

export const summaryTables = {
  [MEETING_IDS.academyBooth]: {
    one_line: '포스터는 두 번째 안으로 확정, 부스 인원 배치는 서재민 확인 뒤로 미뤘습니다.',
    discovered_issues: [
      '부스 인원 배치 기한이 어느 문서에도 적혀 있지 않습니다.',
      '첫날 오전은 관람객이 적을 것으로 보여 인원을 줄여도 될지 확인이 필요합니다.',
    ],
    changes: [
      '포스터 제목 서체를 두 번째 안으로 정했습니다.',
      '제출 마감이 금요일 18시로 확인됐습니다.',
    ],
    next_plans: [
      '서재민이 인원 배치 기한을 확인합니다.',
      '유수인이 확정된 서체로 포스터를 마무리합니다.',
    ],
    main_opinions: [
      { speaker: '임수연', body: '멀리서도 읽히는 쪽이 부스에서는 더 중요합니다.' },
      { speaker: '강다은', body: '첫날 오전은 둘이면 충분해 보입니다.' },
    ],
  },

  [MEETING_IDS.direction]: {
    discovered_issues: [
      '팀별 시간대가 달라 회의 슬롯이 겹친다',
      '디자인 시안 확정이 개발 착수를 막고 있다',
      // 긴 항목을 하나 섞는다. 요약표 칸이 한 줄로 잘리는지 줄바꿈이 되는지는
      // 짧은 문장만 넣어 두면 시연 직전까지 아무도 모른다.
      'Discord 봇이 같은 메시지를 두 번 올리는 경우가 있다. 멱등키를 message_id 하나로만 잡아 둬서, 같은 내용이 다른 채널에 다시 붙으면 새 이벤트로 세는 것이 원인으로 보인다',
      '브리핑에 유보가 하나도 안 뜨는 회의가 있어, 대리인이 판단을 미룬 것인지 애초에 물어본 사람이 없었던 것인지 구별이 안 된다',
    ],
    changes: [
      '디자인 시안 마감을 8/18 로 앞당김',
      '개발 일정 1주 연장',
      '브리핑 응답에 used_answers · deferred_answers 를 남기기로 함',
    ],
    next_plans: [
      '디자인 작업 우선 진행 후 개발팀에 전달',
      '다음 회의에서 API 명세 리뷰',
      '멱등키에 guild_id + channel_id 를 함께 넣어 재현 테스트',
    ],
    one_line: '디자인 작업을 우선 진행한 후 개발팀에 전달하기로 결정했어요.',
    main_opinions: [
      { speaker: '임수연', text: '시안이 늦어지면 개발이 통째로 밀립니다' },
      { speaker: '서재민', text: '일정 1주 연장이면 감당 가능합니다' },
      { speaker: '최비성', text: '플로우는 flow_edge 한 테이블만 읽으면 그려집니다. 조인을 더 늘리지 말고 이대로 갑시다' },
      { speaker: '강다은', text: '봇 쪽은 멱등키만 고치면 됩니다. 채널 id 를 키에 넣을게요' },
    ],
  },

  // 예정 회의라 아직 아무것도 없다. **키를 지우지 않고 빈 값으로 둔다** —
  // 없는 것(null)과 비어 있는 것을 화면이 다르게 그리는지 봐야 한다.
  [MEETING_IDS.designReview]: {
    discovered_issues: [],
    changes: [],
    next_plans: [],
    one_line: '',
    main_opinions: [],
  },

  [MEETING_IDS.weekly]: {
    discovered_issues: [
      '홈 카드에서 회의로 들어가는 길이 두 갈래라 사람마다 다른 화면을 연다',
      '가상 데이터 모드인지 아닌지 화면만 보고는 구별이 안 된다',
    ],
    changes: [
      '홈 카드 클릭은 플로우로 통일',
      '가상 데이터 모드일 때 상단에 띠를 띄우기로 함',
    ],
    next_plans: [
      '금요일까지 화면별 목 데이터 채우기',
      '데모 시나리오 초안 공유',
    ],
    one_line: '이번 주는 화면을 채우는 데 집중하고, 서버 연동은 다음 주에 붙이기로 했어요.',
    main_opinions: [
      { speaker: '서재민', text: '빈 화면으로는 리허설이 안 됩니다. 목부터 채웁시다' },
      { speaker: '유수인', text: '디자인 토큰은 오늘 중으로 넘길게요' },
    ],
  },

  [MEETING_IDS.devSync]: {
    discovered_issues: [
      'JWT 만료 처리에서 재발급 요청이 두 번 나간다',
      '플로우 필터를 전부 끄면 서버가 전체를 다시 돌려준다',
    ],
    changes: [
      '재발급은 요청 큐에서 한 번만 나가도록 정리',
      '필터가 비면 아예 조회하지 않기로 함',
    ],
    next_plans: [
      '엣지 상세 응답에 delivery_context 붙이기',
      'MCP 토큰 발급 흐름 문서화',
    ],
    one_line: '인증과 필터 쪽 버그를 정리하고, 엣지 상세를 다음 작업으로 잡았어요.',
    main_opinions: [
      { speaker: '최비성', text: '재발급은 서버가 아니라 클라이언트 큐 문제입니다' },
      { speaker: '임수연', text: '필터를 전부 끈 상태는 조회를 안 하는 게 맞습니다' },
    ],
  },

  [MEETING_IDS.academyKickoff]: {
    discovered_issues: [
      '부스 운영 인원이 발표 시간과 겹친다',
      '학술제 측 제출 양식이 아직 안 왔다',
    ],
    changes: ['부스 당번을 2교대로 나눔'],
    next_plans: [
      '제출 양식이 오면 초록 작성 시작',
      '리허설 일정 확정',
    ],
    one_line: '부스 당번을 2교대로 나누고, 제출 양식이 오는 대로 초록을 쓰기로 했어요.',
    main_opinions: [
      { speaker: '서재민', text: '발표자는 부스 당번에서 빼는 게 맞습니다' },
    ],
  },
}

/* -------------------------------------------------------------- 브리핑 */

/**
 * 정보 위치 칩.
 *
 * `count` 를 배열 길이에서 뽑는다. 손으로 적으면 숫자만 3 인데 눌러 보면 두
 * 개만 켜지는, 화면에서 제일 알아채기 어려운 종류의 거짓말이 된다.
 */
function chip(contentType, label) {
  const edgeIds = EDGES[contentType]
  return { content_type: contentType, label, count: edgeIds.length, edge_ids: edgeIds }
}

export const briefings = {
  /**
   * 이 서비스의 핵심 화면.
   *
   * 유수인이 대리 참석으로 빠진 회의라, 돌아와서 처음 보게 되는 것이 이 응답
   * 하나다. 확인 · 요청 · 유보를 모두 채워 둔다.
   */
  [MEETING_IDS.direction]: {
    meeting_id: MEETING_IDS.direction,
    narrative: `자리를 비우신 90분 동안 ${agentName(ME.name)}가 세 가지를 대신 답했습니다. 회의 슬롯 조율에서는 저장해 두신 "오전은 피한다" 기준으로, 디자인 시안 마감은 "8/18 을 넘기지 않는다" 는 기존 답변을 그대로 인용했습니다. 반면 개발 일정 1주 연장과 QA 기간 단축은 근거가 부족해 유보하고 본인 확인으로 넘겼습니다. 회의 결과로 시안 마감이 이틀 앞당겨지고 개발 일정이 한 주 밀렸으니, 아래 두 변경만은 먼저 확인해 주세요.`,
    location_chips: [
      chip('OPINION', '의견'),
      chip('REQUEST', '요청사항'),
      chip('CHANGE', '변동사항'),
      chip('SCHEDULE', '일정'),
      chip('CONCLUSION', '결론'),
      chip('ETC', '기타'),
    ],
    /*
      확인 카드의 `edge_id` 는 **`변동사항` 칩의 edge_ids 안에 있는 값**이다.
      칩을 눌렀을 때 목록이 함께 걸러지려면 두 곳이 같은 id 를 봐야 한다.
      아무 id 나 넣으면 칩을 누르는 순간 카드가 통째로 사라진다.
    */
    needs_confirmation: [
      {
        id: 'bc-1',
        title: '디자인 시안 마감 변경',
        body: '최종 시안 마감이 8/20 → 8/18 로 이틀 앞당겨졌어요.',
        edge_id: EDGES.CHANGE[0],
        agenda_id: AGENDA_IDS.designDeadline,
        confirmed_at: null,
        occurred_at: daysAgo(1, 20, 41),
      },
      {
        id: 'bc-2',
        title: '개발 일정 1주 연장',
        body: 'API 연동 완료일이 8/23 → 8/30 으로 변경됐어요. 시안 일정과 맞물려 있어 디자인 쪽 확인이 필요해요.',
        edge_id: EDGES.CHANGE[1],
        agenda_id: AGENDA_IDS.scheduleExtension,
        confirmed_at: null,
        occurred_at: daysAgo(1, 21, 4),
      },
    ],
    requests_to_me: [
      {
        id: 'br-1',
        title: '8/18 까지 로그인 화면 시안 수정',
        requester_name: '임수연',
        // 화면이 그대로 그리는 문장이다. 조사까지 서버가 붙여 준다 —
        // 클라이언트가 이름과 조사를 이어 붙이면 받침 처리가 어긋난다.
        body: '임수연님이 요청했어요 · 8/18 까지',
        note: '',
        due_at: daysAgo(-1, 12),
        edge_id: EDGES.REQUEST[0],
        task_id: null,
      },
      {
        id: 'br-2',
        title: '플로우 화면 색상 토큰 정리본 공유',
        requester_name: '서재민',
        body: '서재민님이 요청했어요 · 다음 회의 전까지 확인이 필요해요.',
        note: '다음 회의 전까지 확인이 필요해요.',
        due_at: null,
        edge_id: EDGES.REQUEST[1],
        task_id: null,
      },
    ],
    /*
      유보한 질문에는 `edge_id` 를 달지 않는다.

      브리핑 사이드바는 칩으로 목록을 거를 때 `edge_id` 없는 카드를 남기도록
      돼 있다. 여기에 id 를 달면 칩 하나를 누르는 순간 **반드시 답해야 하는
      것이 화면에서 사라진다.**
    */
    needs_answer: [
      {
        question_id: '8c0e2758-6a24-49bf-94f6-bed08dfee765',
        asker_name: '서재민',
        title: '디자인 시안 마감 관련',
        body: '8/18 마감이면 QA 기간이 3일뿐인데 괜찮을까요?',
        asked_at: daysAgo(1, 20, 22),
        // 시각 환산은 서버가 끝낸다. 여기서 다시 만들면 시간대가 다른 팀원끼리
        // 같은 질문을 다른 시각으로 본다.
        meta: '서재민 · 20:22',
        chat_room_id: AGENT_ROOM,
        answered_at: null,
      },
      {
        question_id: 'e41b7d90-2c5a-4f68-9d13-7a0e5b8c4162',
        asker_name: '임수연',
        title: '컴포넌트 분리 범위',
        body: '플로우 화면 사이드바를 공용 컴포넌트로 뺄지 화면 안에 둘지 정해 주셔야 이번 주 안에 붙일 수 있어요. 공용으로 빼면 홈에서도 쓸 수 있지만 지금 구조에서는 넘겨야 하는 props 가 열 개 가까이 되고, 화면 안에 두면 나중에 홈 브리핑을 만들 때 같은 것을 한 번 더 만들게 됩니다.',
        asked_at: daysAgo(1, 20, 55),
        meta: '임수연 · 20:55',
        chat_room_id: AGENT_ROOM,
        answered_at: null,
      },
      {
        question_id: 'a7f2c6b4-9e08-4d51-b3a7-1c4e9f60d825',
        asker_name: '최비성',
        title: '아이콘 에셋 형식',
        body: '아이콘을 SVG 로 받을 수 있을까요? PNG 라 어두운 배경에서 테두리가 남습니다.',
        asked_at: daysAgo(1, 21, 12),
        meta: '최비성 · 21:12',
        // Discord 에서 나온 질문이라 아직 답할 방이 없다. null 인 경우를
        // 화면이 어떻게 다루는지도 봐야 한다.
        chat_room_id: null,
        answered_at: null,
      },
    ],
    used_answers: [
      {
        edge_id: EDGES.OPINION[0],
        agenda_id: AGENDA_IDS.slot,
        excerpt: '오전 슬롯은 피해 주세요. 저는 오후 2시 이후가 가능합니다.',
        reason: null,
      },
      {
        edge_id: EDGES.OPINION[1],
        agenda_id: AGENDA_IDS.designDeadline,
        excerpt: '디자인 시안은 8월 18일을 넘기지 않습니다.',
        reason: null,
      },
      {
        edge_id: EDGES.CONCLUSION[0],
        agenda_id: AGENDA_IDS.designDeadline,
        excerpt: '색상 토큰은 확정본이 있어 이번 수정 범위에 들어가지 않습니다.',
        reason: null,
      },
    ],
    deferred_answers: [
      {
        edge_id: EDGES.SCHEDULE[0],
        agenda_id: AGENDA_IDS.scheduleExtension,
        excerpt: '개발 일정 연장은 제가 정할 수 없습니다.',
        reason: 'allow_schedule_change=false',
      },
      {
        edge_id: EDGES.REQUEST[2],
        agenda_id: AGENDA_IDS.qaWindow,
        excerpt: 'QA 기간을 3일로 줄여도 되는지는 저장된 근거가 없어 답을 미뤘습니다.',
        reason: 'no_saved_answer',
      },
    ],
    settings_version: 3,
    generated_at: daysAgo(1, 21, 35),
  },

  /*
    예정 회의. **아직 아무 일도 없었다.**

    빈 배열만 든 응답을 하나 남겨 두는 이유는, 화면이 이 상태에서 `대리인이
    유보한 질문이 없습니다.` 를 제대로 그리는지 확인할 데가 여기뿐이기
    때문이다. 키를 아예 빼면(응답 없음) 화면은 다른 경로로 빠진다.
  */
  [MEETING_IDS.designReview]: {
    meeting_id: MEETING_IDS.designReview,
    narrative: '',
    location_chips: [],
    needs_confirmation: [],
    requests_to_me: [],
    needs_answer: [],
    used_answers: [],
    deferred_answers: [],
    settings_version: 3,
    generated_at: null,
  },

  // 진행 중인 회의. 중간까지의 브리핑이 이미 잡혀 있다 — 회의가 끝나야만
  // 무언가 보이면 "지금 무슨 얘기 중이지" 에 답할 수 없다.
  [MEETING_IDS.weekly]: {
    meeting_id: MEETING_IDS.weekly,
    narrative: `지금까지는 이번 주 목표를 맞추는 이야기였습니다. 화면별 목 데이터를 금요일까지 채우기로 했고, 새벽 시간대라 ${agentName('강다은')}가 대신 들어와 Discord 쪽 진행 상황을 전했습니다.`,
    location_chips: [],
    needs_confirmation: [
      {
        id: 'bc-w1',
        title: '데모 순서 변경',
        body: '데모에서 홈보다 플로우를 먼저 보여 주기로 했어요.',
        edge_id: null,
        agenda_id: null,
        confirmed_at: null,
        occurred_at: minutesAgo(35),
      },
    ],
    requests_to_me: [],
    needs_answer: [
      {
        question_id: 'd9c1e5a3-6b74-4021-8f5c-3a9d7e2b0146',
        asker_name: '강다은',
        title: '봇 알림 문구 톤',
        body: '봇이 올리는 회의 시작 알림을 존댓말로 통일할까요?',
        asked_at: minutesAgo(20),
        meta: '강다은 · 진행 중',
        chat_room_id: AGENT_ROOM,
        answered_at: null,
      },
    ],
    used_answers: [
      {
        edge_id: null,
        agenda_id: null,
        excerpt: '디자인 토큰은 오늘 중으로 넘길 수 있습니다.',
        reason: null,
      },
    ],
    deferred_answers: [],
    settings_version: 3,
    generated_at: minutesAgo(12),
  },

  // 유수인이 대리인도 세우지 않고 빠진 회의. 대신 답한 것이 없으니
  // `used_answers` 도 비는 것이 맞다 — 억지로 채우면 대리 참석과 불참이
  // 데이터에서 구별되지 않는다.
  [MEETING_IDS.devSync]: {
    meeting_id: MEETING_IDS.devSync,
    narrative: '대리인을 세우지 않아 이 회의에서 대신 답한 것은 없습니다. 오간 내용만 정리해 두었습니다. 인증 재발급이 두 번 나가는 문제와 플로우 필터 처리 방식이 정리됐고, 엣지 상세 응답이 바뀝니다.',
    location_chips: [],
    needs_confirmation: [
      {
        id: 'bc-s1',
        title: '엣지 상세 응답 변경',
        body: '엣지 상세에 delivery_context 가 붙어요. 화면에서 발화 두 줄을 그릴 수 있어요.',
        edge_id: null,
        agenda_id: null,
        // 이미 확인을 누른 카드. 확인 전후가 화면에서 갈리는지 봐야 한다.
        confirmed_at: daysAgo(2, 11),
        occurred_at: daysAgo(3, 21, 40),
      },
    ],
    requests_to_me: [
      {
        id: 'br-s1',
        title: '로딩·빈 상태 문구 정리',
        requester_name: '최비성',
        body: '최비성님이 요청했어요 · 기한 없음',
        note: '급하지 않아요. 시간 날 때 봐 주세요.',
        due_at: null,
        edge_id: null,
        task_id: null,
      },
    ],
    needs_answer: [],
    used_answers: [],
    deferred_answers: [],
    settings_version: 2,
    generated_at: daysAgo(3, 22, 5),
  },

  [MEETING_IDS.academyKickoff]: {
    meeting_id: MEETING_IDS.academyKickoff,
    narrative: `${agentName(ME.name)}가 대신 참석해 부스 당번 이야기에서 "발표자는 당번에서 뺀다" 로 답했습니다. 초록 마감일은 학술제 측 양식이 아직 안 와서 유보했습니다.`,
    location_chips: [],
    needs_confirmation: [],
    requests_to_me: [
      {
        id: 'br-a1',
        title: '부스 배너 시안 1종',
        requester_name: '강다은',
        body: '강다은님이 요청했어요 · 8/22 까지',
        note: '',
        due_at: daysAgo(-4, 18),
        edge_id: null,
        task_id: null,
      },
    ],
    needs_answer: [
      {
        question_id: 'b6d0f847-15c9-4e73-a208-9f4b1c6e5d30',
        asker_name: '서재민',
        title: '부스 당번 시간',
        body: '오후 당번을 맡아 주실 수 있나요? 발표 준비와 겹치면 오전으로 옮길게요.',
        asked_at: daysAgo(5, 19, 40),
        meta: '서재민 · 19:40',
        chat_room_id: AGENT_ROOM,
        answered_at: null,
      },
    ],
    used_answers: [
      {
        edge_id: null,
        agenda_id: null,
        excerpt: '발표자는 부스 당번에서 빼는 것으로 알고 있습니다.',
        reason: null,
      },
    ],
    deferred_answers: [
      {
        edge_id: null,
        agenda_id: null,
        excerpt: '초록 마감일은 제가 답할 근거가 없습니다.',
        reason: 'no_evidence',
      },
    ],
    settings_version: 2,
    generated_at: daysAgo(5, 20, 30),
  },
}

/* ------------------------------------------------------- 인덱스 (안건) */

/** `count` 는 목록 길이에서 뽑는다. 손으로 적으면 목록과 숫자가 따로 논다. */
function indexList(results) {
  return { count: results.length, results }
}

function agenda(id, label, relatedEdgeIds = []) {
  return { id, label, kind: 'AGENDA', related_edge_ids: relatedEdgeIds }
}

/**
 * 좌측 인덱스(안건).
 *
 * **판을 만든 원장에서 그대로 가져온다.** 여기서 `related_edge_ids` 를 손으로
 * 적으면 판에 없는 엣지를 가리키게 되고, 안건을 눌러도 강조될 화살표가 없다.
 * 실제로 그렇게 어긋나 있었다 — 인덱스는 UUID 를, 판은 `meeting-edge-N` 을
 * 쓰고 있었다.
 */
export const meetingIndexes = Object.fromEntries(
  Object.entries(meetingAgendas).map(([meetingId, agendas]) => [
    meetingId,
    // `buildAgendas` 는 안건 키로 묶은 객체를 준다. 정렬은 서버가 주는
    // `sort_order` 를 따른다 — 화면이 목록 순서를 그대로 그린다.
    indexList(Object.values(agendas)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((one) => agenda(one.id, one.title, one.related_edge_ids))),
  ]),
)

/* ------------------------------------------------- 인덱스 (작업 문서) */

function workDocument(id, label, relatedEdgeIds = []) {
  return { id, label, kind: 'DOCUMENT', related_edge_ids: relatedEdgeIds }
}

/**
 * 작업 모드 좌측 목록.
 *
 * 실제 응답이 0건이었고, 그 탓에 작업 모드로 넘어가면 좌측이 늘 비어 있었다.
 * **비어 있는 것이 정상처럼 보이는 것이 이 화면의 원래 결함**이라 여기서는
 * 채운다. 키는 회의가 아니라 **프로젝트** 다 — 작업 엣지에는 회의가 없다.
 *
 * `related_edge_ids` 는 `flow.js` 의 작업 엣지와 맞춘 `work-edge-N` 이다.
 */
export const workIndexes = {
  [PROJECTS.bordo.id]: indexList([
    workDocument('32619077-3e60-4ae9-b2e2-3b082c1d0d5b', '글로벌 회의 운영 기획안', ['work-edge-1', 'work-edge-2']),
    workDocument('a4c7e0b9-5f31-4d86-92a0-6e8c1b3f7d54', '디자인 토큰 v2', ['work-edge-3', 'work-edge-4']),
    workDocument('9f2b6d18-7c34-4e05-b9a1-5d8c0e3f7a26', '플로우 화면 정의서', ['work-edge-5', 'work-edge-6']),
    workDocument('1c8e4a70-3b95-4d62-8f07-2a6d9c5b1e84', 'API 계약서 v0.3', ['work-edge-7', 'work-edge-8']),
    workDocument('7b05d9c3-6e21-4a84-95f3-0c7e2b8a4d61', 'Discord 이벤트 명세', ['work-edge-9']),
    workDocument('e30a8f52-1d74-4c69-b806-9f2c5a7e3b40', '브리핑 카피 초안', ['work-edge-10', 'work-edge-11']),
    // 긴 문서명 하나. 좌측 목록이 두 줄로 늘어나는지 잘리는지 봐야 한다.
    workDocument(
      '5d94b1e6-8a02-4f37-a5c1-3b7e0d9f6c28',
      '심사 데모 시나리오 — 홈에서 시작해 브리핑을 열고 플로우로 넘어가는 3분짜리 흐름',
      ['work-edge-12'],
    ),
    // 방금 올라온 문서라 아직 오간 흔적이 없다.
    workDocument('0a6f3c85-4d17-4b90-8e26-7c1b5a9d0f43', '회의록 템플릿'),
  ]),

  /*
    다른 프로젝트도 목록을 갖는다.

    다만 화살표는 안 묶는다 — 작업 플로우 가상 데이터가 `글로벌 회의 도구`
    쪽에만 있어서, 여기에 `work-edge-N` 을 적으면 **다른 프로젝트의 화살표가
    켜진다.** 빈 배열은 "연결이 없다" 지만 틀린 id 는 "엉뚱한 곳을 가리킨다" 다.
  */
  [PROJECTS.academy.id]: indexList([
    workDocument('c1e07b49-2f68-4a35-9d80-6b3f5c2a8e17', `${TEAM.name} 발표 자료 v3`),
    workDocument('83b5f2d0-9c47-4e16-a72b-5f0d8e3c6a91', '연합학술제 초록 초안'),
    workDocument('2d7a9c41-0e83-4b57-86f9-1c4b6d0e5a72', '부스 운영 체크리스트'),
  ]),
}
