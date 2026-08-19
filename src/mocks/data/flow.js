/**
 * 플로우 판(`/flow-board`)이 그리는 그래프. 이 서비스의 핵심 화면 두 개 중 하나다.
 *
 * ## 화살표를 손으로 안 적고 엣지에서 계산한다
 *
 * 이 화면은 같은 사실을 두 군데서 보여 준다. 판 위의 뱃지(`의견 3`)와, 그 뱃지를
 * 눌렀을 때 열리는 상세 목록이다. 둘을 따로 적으면 **뱃지는 3인데 패널에는 2개**인
 * 상태가 조용히 생기고, 보는 사람은 그것을 화면 버그로 읽는다. 그래서 여기서는
 * 엣지 원장(`*_EDGES`)만 손으로 적고 화살표 · 개수 · `edge_ids` · `total_count` ·
 * `filter_options` · 안건의 `related_edge_ids` 를 전부 거기서 만들어 낸다. 원장에
 * 한 줄을 더하면 판과 패널이 같이 움직인다.
 *
 * ## 종류를 골고루 쓴 이유
 *
 * 한 종류만 있으면 필터를 눌러도 판이 안 변해서 **필터가 고장 난 것처럼 보인다.**
 * 회의 6종 · 작업 5종을 다 깔아 뒀고, 회의 2는 일부러 `변동사항` 을 빼서
 * `filter_options.content_types` 가 조회마다 다르게 나오는 것도 볼 수 있게 했다.
 *
 * ## 시각 · 진하기 · 아바타
 *
 * 시각은 `daysAgo` · `minutesAgo` 로 만든다. 날짜를 박아 두면 하루만 지나도 "어제
 * 회의" 가 미래가 된다. `opacity` 는 서버가 최근일수록 1 에 가깝게 주는 값이라,
 * 여기서도 그 조회 안의 가장 이른 · 가장 늦은 시각 사이에서 계산한다.
 * 아바타는 **저장소에 실제로 있는 파일만** 쓴다(`public/flowchart` 에 profile-1~3
 * 만 있다). 없는 경로를 주면 판에 깨진 이미지가 뜨는데, 실서버도 그 두 사람은
 * `avatar_url: null` 로 내려 준다 — 화면은 그때 이름 첫 글자를 그린다.
 *
 * ## 엣지 id
 *
 * 작업 엣지는 `work-edge-1…`, 회의 엣지는 `meeting-edge-1…` 이다. 회의 · 작업
 * 문서의 `related_edge_ids`(meetings 목)가 이 id 로 판을 강조하므로, UUID 로 두면
 * 파일을 넘나들며 맞출 수가 없다. 안건 쪽 `related_edge_ids` 는 이 파일이 직접
 * 계산하니 항상 맞는다.
 */

import { PEOPLE, PROJECTS, agentName, daysAgo, minutesAgo, person } from './people.js'

/*
  회의 id. 사람 · 팀 · 프로젝트와 달리 `people.js` 에 없어서 여기 둔다.
  meetings 목과 같은 값을 써야 홈에서 넘어온 링크가 이 판을 연다.
*/
const MEETING_GLOBAL = 'b1a11546-5743-46d4-b052-06407fb69c3c'
const MEETING_DESIGN = 'baf061c5-2efc-4ca8-80e5-cecc15582780'
const MEETING_REGULAR = '4eb1040f-18d7-4841-bc72-360846888c3d'
const MEETING_SYNC = 'cdcd5cda-d887-47dc-91aa-4bb7393d461b'
const MEETING_BOOTH = '2f5c1d47-9b0a-4e3c-8f61-7a4d2c9e0b13'
const MEETING_POSTER = '0a3f6cd2-71b5-4d8e-9c4a-2f7b8e15d093'
const MEETING_REHEARSAL = '9d3e7b28-4c15-4a6f-b072-51e8f6a3c4d9'

/** 뱃지 라벨. 서버가 완성해 주는 값이라 화면은 이걸 그대로 읽는다. */
const CONTENT_LABEL = {
  OPINION: '의견',
  REQUEST: '요청사항',
  CHANGE: '변동사항',
  SCHEDULE: '일정',
  CONCLUSION: '결론',
  ETC: '기타',
  WORK: '작업',
  REVISION: '수정',
  FEEDBACK: '피드백',
  SHARE: '공유',
  AI_LOOKUP: 'AI 조회',
}

/** 뱃지가 앉는 순서. 적은 순서대로 두면 화살표마다 순서가 달라 눈이 헷갈린다. */
const CONTENT_ORDER = [
  'OPINION', 'REQUEST', 'CHANGE', 'SCHEDULE', 'CONCLUSION', 'ETC',
  'WORK', 'REVISION', 'FEEDBACK', 'SHARE', 'AI_LOOKUP',
]

const SURFACE_ORDER = ['DISCORD', 'SERVICE']
const SOURCE_ORDER = ['FIGMA', 'GITHUB', 'NOTION']

/** `public/flowchart` 에 실제로 있는 파일. 나머지는 `null` 로 내린다. */
const AVATAR_FILES = new Set([
  '/flowchart/profile-1.jpeg',
  '/flowchart/profile-2.jpeg',
  '/flowchart/profile-3.jpeg',
])

function avatarOf(name) {
  const url = person(name).avatar_url
  return AVATAR_FILES.has(url) ? url : null
}

/**
 * 노드 사전.
 *
 * 원장에서 사람을 **이름으로** 가리키게 하려고 만든다(`from: '최비성'`,
 * `from: '유수인의 Bordo'`). 원장에 UUID 를 적으면 읽으면서 누가 누구인지 알 수
 * 없고, 그러면 대화 내용과 화살표 방향이 어긋나도 아무도 못 본다.
 */
const NODES = {}

PEOPLE.forEach((p) => {
  NODES[p.name] = {
    id: p.id,
    kind: 'USER',
    user_id: p.id,
    name: p.name,
    avatar_url: avatarOf(p.name),
  }
  NODES[agentName(p.name)] = {
    // 대리인 노드 id 는 서버 규칙대로 `{user_id}:agent` 다. 화면이 `kind` 와
    // `user_id` 로 "내 대리인" 을 찾으므로 사람 id 를 그대로 달고 있어야 한다.
    id: `${p.id}:agent`,
    kind: 'AGENT',
    user_id: p.id,
    name: agentName(p.name),
    avatar_url: avatarOf(p.name),
  }
})

/* ────────────────────────────────────────────────────────────
   문서 — 엣지에 붙는 AI 정리본
   ──────────────────────────────────────────────────────────── */

/**
 * `delivery_context` 와 `direction_label` 은 여기 없다. 같은 문서가 화살표 여럿에
 * 걸릴 수 있고, 그 둘은 **어느 화살표로 열었는지**에 따라 달라지는 값이라
 * 엣지를 만들 때 붙인다.
 */
const DOCUMENTS = {
  plan: {
    id: '32619077-3e60-4ae9-b2e2-3b082c1d0d5b',
    title: '글로벌 회의 운영 기획안',
    visibility: 'team',
    sections: [
      {
        heading: '배경',
        one_line_summary: '시간대가 달라 회의가 겹친다',
        body: '팀원이 서울과 베를린에 나뉘어 있어 한쪽의 오후가 다른 쪽의 새벽이다. 지금은 매번 사람이 손으로 시간을 맞추고 있고, 그 과정에서 한 명씩 빠진다.',
      },
      {
        heading: '제안',
        one_line_summary: '겹치는 슬롯을 자동으로 추천한다',
        body: '참석자 timezone 을 모아 겹치는 구간을 계산하고 후보 슬롯을 최대 세 개까지 보여 준다. 고르는 것은 사람이 한다.',
      },
      {
        heading: '남은 질문',
        one_line_summary: '프로필에 timezone 이 비어 있는 계정',
        body: '가입할 때 받지 않아서 비어 있는 계정이 있다. 비어 있으면 팀 기본 시간대로 두고 회의 생성 폼에서 한 번 더 묻는 쪽으로 정리했다.',
      },
    ],
  },
  bot: {
    id: '5b0f2e77-1c48-4a91-8f2e-0d31c8a4b512',
    title: 'Discord 봇 권한 정리',
    visibility: 'team',
    sections: [
      {
        heading: '읽는 채널',
        one_line_summary: '연결한 채널만 읽는다',
        body: '봇을 서버에 넣으면 전체 채널이 보이지만, 팀이 명시적으로 연결한 채널 외에는 저장하지 않는다. 저장 범위를 좁혀 두지 않으면 사적인 대화가 회의 기록으로 들어온다.',
      },
      {
        heading: '멱등키',
        one_line_summary: 'guild + channel + message 로 중복을 막는다',
        body: '재연결이나 재시도 때 같은 메시지가 두 번 들어오면 화살표 개수가 부풀어 사실이 아니게 된다.',
      },
    ],
  },
  tone: {
    id: '9d4c1a30-77b6-4ee2-a0c1-3f5b6d2e8471',
    title: '대리인 요약 톤 가이드 (초안)',
    visibility: 'private',
    sections: [
      {
        heading: '문제',
        one_line_summary: '대리인 요약이 결정처럼 읽힌다',
        body: '지난주 회의에서 대리인이 남긴 "토큰 이름은 유지하기로 함" 을 두 사람이 확정으로 읽고 각자 작업을 시작했다. 실제로는 담당자가 자리에 없어 아무것도 확정되지 않은 상태였고, 되돌리는 데 이틀이 들었다. 대리인은 자리에 없는 사람의 이름을 달고 말하기 때문에, 문장이 단정적이면 듣는 사람은 그것을 본인의 결정으로 읽는다. 그래서 대리인 산출물은 서술의 주어를 분명히 하고(누가 말했는지), 근거가 되는 발언을 함께 남기고, 확정이 필요한 문장은 확정이 아니라 제안으로 적는다. 근거가 부족하면 지어내지 말고 유보한다 — 유보는 실패가 아니라 이 제품이 파는 것이다. 확정은 사람이 돌아와서 한 번 더 누른다.',
      },
      {
        heading: '적용 규칙',
        one_line_summary: '확정 문구는 사람이 누른 뒤에만',
        body: 'AI 가 만든 안건과 요약은 PENDING_APPROVAL 로 만들고, 승인 전에는 화면에서 회색 뱃지로 구분한다.',
      },
    ],
  },
  release: {
    id: 'a1e6b4c9-2d70-4f18-9b53-6c0a7e91d334',
    title: '8월 4주차 배포 범위',
    visibility: 'team',
    sections: [
      {
        heading: '들어가는 것',
        one_line_summary: '플로우 판과 브리핑까지',
        body: '플로우 판, AI 브리핑, Discord 수집. 세 개가 "내가 없는 동안 무슨 일이 있었지" 에 직접 답한다.',
      },
      {
        heading: '빼는 것',
        one_line_summary: '사람별 작업 요약은 다음으로',
        body: '사람 노드를 눌렀을 때 뜨는 개인 스코프 조회는 서버가 아직 없다. 범위가 두 번 줄어든 프로젝트라 다시 늘리지 않는다.',
      },
    ],
  },
  scratch: {
    id: 'c7f0d2b8-4a19-4c63-8e77-1b95d4f0a2c6',
    title: '회의 중 메모 (정리 전)',
    visibility: 'private',
    // 정리 전 메모라 본문이 아직 없다. 문서는 있는데 섹션이 0개인 상태를
    // 화면이 어떻게 그리는지 보려고 남겨 둔다.
    sections: [],
  },
  tokens: {
    id: 'e2b7c145-9f30-4d82-a6b1-7c4e0d938a55',
    title: '컴포넌트 토큰 정리안',
    visibility: 'team',
    sections: [
      {
        heading: '색',
        one_line_summary: 'primary 계열을 세 단계로 줄인다',
        body: '지금 다섯 단계인데 화면에서 실제로 구별되는 것은 셋이다. 남은 둘은 이름만 다르고 값이 거의 같아 고를 때마다 헷갈린다.',
      },
      {
        heading: '여백',
        one_line_summary: '4의 배수로 통일',
        body: '6px, 10px 처럼 어긋난 값이 시안마다 섞여 있어 구현에서 매번 다시 물어봐야 했다.',
      },
    ],
  },
  emptyRule: {
    id: 'f4a1d097-3b62-4e15-9d80-2a6c5b7e1043',
    title: '빈 상태 화면 규칙',
    visibility: 'team',
    sections: [
      {
        heading: '없는 것과 못 불러온 것',
        one_line_summary: '두 상태를 다른 문장으로 쓴다',
        body: '"아직 없습니다" 와 "불러오지 못했습니다" 를 같은 회색 문장으로 두면 장애가 평온한 화면으로 둔갑한다. 후자에는 다시 시도 버튼을 붙인다.',
      },
    ],
  },
  flowContract: {
    id: 'b8c3e520-6d47-41af-95e2-0f713a6d8c29',
    title: '플로우 API 응답 계약',
    visibility: 'team',
    sections: [
      {
        heading: '회의와 작업은 경로가 다르다',
        one_line_summary: '작업은 기간이 스코프다',
        body: '회의는 /meetings/{id}/flow, 작업은 /projects/{id}/flow?from&to 다. 응답 모양은 meeting_label 이 period_label 로 바뀌는 것 말고 같아서 렌더러는 하나면 된다.',
      },
      {
        heading: '오류',
        one_line_summary: 'HTTP 상태가 아니라 error.code 로 분기',
        body: '같은 404 라도 없는 회의와 권한 없음은 화면이 다르게 말해야 한다.',
      },
    ],
  },
  meetingCard: {
    id: 'd51a8f36-0c94-4b27-8e60-3d7ab1c94e08',
    title: '회의 카드 컴포넌트 v3',
    visibility: 'team',
    sections: [
      {
        heading: '변경',
        one_line_summary: '참석자 아바타를 세 개까지만',
        body: '다섯 명이 넘으면 카드가 두 줄이 돼 목록 스크롤이 길어진다. 넘치는 인원은 +N 으로 접는다.',
      },
    ],
  },
  botRelay: {
    id: '7e94b0c2-5a13-4d68-b0f7-9c26e4a15d83',
    title: 'Discord 릴레이 재시도 정리',
    visibility: 'team',
    sections: [
      {
        heading: '증상',
        one_line_summary: '재시도가 같은 메시지를 두 번 넣었다',
        body: '게이트웨이가 끊겼다 붙는 동안 받은 이벤트를 다시 보내면서 같은 message_id 가 두 번 저장됐다. 멱등키를 유니크 제약으로 걸어 막았다.',
      },
    ],
  },
  posterDraft: {
    id: '0af7d3e6-8b25-4917-a3c4-6e5d091b7f42',
    title: '연합학술제 포스터 시안 A/B',
    visibility: 'team',
    sections: [
      {
        heading: 'A안',
        one_line_summary: '제목을 크게, 정보는 아래로',
        body: '멀리서도 읽히는 대신 일시와 장소가 작아진다. 온라인 공유용으로는 A안이 낫다.',
      },
      {
        heading: 'B안',
        one_line_summary: '정보 밀도를 높인 격자',
        body: '인쇄해서 붙일 때는 B안이 낫다. 두 안을 한 장으로 합치자는 의견은 결국 둘 다 애매해져서 접었다.',
      },
    ],
  },
  submitGuide: {
    id: '3c6b9147-2e08-4a53-8f19-5d40b7ce2a61',
    title: '연합학술제 제출물 체크리스트',
    visibility: 'team',
    sections: [
      {
        heading: '필수',
        one_line_summary: '발표자료 · 시연 영상 · 저장소 링크',
        body: '시연 영상은 3분을 넘기면 잘린다. 저장소는 심사 기간 동안 공개로 두되 서버 정보가 든 파일이 없는지 먼저 확인한다.',
      },
    ],
  },
}

/* ────────────────────────────────────────────────────────────
   안건 — 회의 엣지에만 붙는다
   ──────────────────────────────────────────────────────────── */

/**
 * `owner` 는 이름이다. 응답에는 `owner_id` 로 나가고, `related_edge_ids` 와
 * `direction_label` 은 이 안건을 가리킨 엣지들에서 계산한다. 손으로 적으면
 * 안건을 눌렀을 때 강조되는 화살표가 실제와 어긋난다.
 */
const AGENDAS = {
  slot: {
    id: '6f156c00-027e-4f89-8272-6c811c2d39e5',
    title: '회의 일정 조율',
    sort_order: 1,
    owner: '최비성',
    status: 'DISCUSSED',
    content: '시간대가 다른 팀원을 고려해 정기 회의 슬롯을 다시 잡는다.',
    created_by_agent: false,
  },
  botScope: {
    id: '8a3d5b91-4c27-4e60-9f13-2b7e6d0a4c58',
    title: 'Discord 봇 권한 범위',
    sort_order: 2,
    owner: '강다은',
    status: 'DISCUSSED',
    content: '봇이 읽고 저장할 채널을 어디까지 허용할지 정한다.',
    created_by_agent: false,
  },
  agentTone: {
    id: 'c04e7f28-95b1-4a36-8d72-1e5c9b3f60d4',
    title: '대리인 요약 톤 정리',
    sort_order: 3,
    owner: '유수인',
    status: 'PENDING',
    // 회의에 없던 사람의 대리인이 만든 안건이라 사람이 한 번 더 확인해야 한다.
    content: '대리인 요약이 결정처럼 읽힌다는 지적을 모아 톤 규칙을 정한다. 확정은 담당자가 돌아온 뒤에.',
    created_by_agent: true,
  },
  release: {
    id: '1d92a6b7-3f50-4c81-b269-7a0e4d5c83f1',
    title: '8월 4주차 배포 범위',
    sort_order: 4,
    owner: '서재민',
    status: 'DECIDED',
    content: 'MVP 완료 기준에 없는 항목은 이번 배포에서 뺀다.',
    created_by_agent: false,
  },
  tokenCleanup: {
    id: '4b7c0e93-6d21-458a-9c04-8f13e2a75b60',
    title: '컴포넌트 토큰 정리',
    sort_order: 1,
    owner: '유수인',
    status: 'DISCUSSED',
    content: 'primary 다섯 단계를 셋으로 줄이고 여백을 4의 배수로 통일한다.',
    created_by_agent: false,
  },
  emptyState: {
    id: '2e58f1a4-7b93-4c06-8d51-9a4b7c30e2f8',
    title: '빈 상태 화면 규칙',
    sort_order: 2,
    owner: '임수연',
    status: 'DISCUSSED',
    content: '데이터가 없는 화면과 불러오지 못한 화면을 다른 문장으로 쓴다.',
    created_by_agent: false,
  },
  reviewFollowUp: {
    id: '5a0d3c76-1e84-42b9-a7f3-6c95b0e4d217',
    title: '리뷰 후속 작업 배분',
    sort_order: 3,
    owner: '서재민',
    status: 'PENDING',
    content: '리뷰에서 나온 수정 항목을 이번 주와 다음 주로 나눈다.',
    created_by_agent: true,
  },
}

/* ────────────────────────────────────────────────────────────
   엣지 원장
   ──────────────────────────────────────────────────────────── */

/**
 * 회의 1 — 어제 저녁. 유수인 · 강다은은 불참(대리인이 대신 들었다), 서재민은 늦게
 * 합류했다. 이 서비스가 묻는 질문("내가 없는 동안 무슨 일이 있었지")의 답이
 * 판 위에 그려지려면, **불참한 사람의 대리인이 실제로 말을 주고받아야 한다.**
 */
const MEETING_GLOBAL_EDGES = [
  {
    id: 'meeting-edge-1',
    from: '최비성', to: ['임수연'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(1, 20, 4), doc: 'plan', agenda: 'slot',
    says: [
      ['최비성', '기획안 먼저 공유드립니다. 시간대 계산은 서버가 하는 게 맞아요.'],
      ['임수연', '확인하고 시안에 반영할게요.'],
    ],
  },
  {
    id: 'meeting-edge-2',
    from: '최비성', to: ['임수연'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(1, 20, 9), agenda: 'slot',
    says: [
      ['최비성', '후보 슬롯은 세 개까지만 보여 주죠. 더 늘리면 고르기가 더 어려워집니다.'],
      ['임수연', '세 개면 카드로 한 줄에 들어가요.'],
    ],
  },
  {
    id: 'meeting-edge-3',
    from: '최비성', to: ['임수연'], type: 'OPINION', surface: 'SERVICE',
    at: daysAgo(1, 20, 15), doc: 'plan', agenda: 'slot',
    says: [
      ['최비성', '슬롯 하나가 몇 명한테 새벽인지도 같이 내려 줄게요. 그게 없으면 고르는 사람이 판단할 근거가 없어요.'],
      ['임수연', '그럼 카드에 "베를린 02:00" 같은 보조 문구를 붙일게요.'],
    ],
  },
  {
    id: 'meeting-edge-4',
    from: '최비성', to: ['임수연'], type: 'REQUEST', surface: 'DISCORD',
    at: daysAgo(1, 20, 21), agenda: 'slot',
    says: [
      ['최비성', '프로필에 timezone 이 비어 있는 사람은 회의 생성 폼에서 한 번 물어봐 주세요.'],
      ['임수연', '기본값은 팀 시간대로 채워 두고 바꿀 수 있게 할게요.'],
    ],
  },
  {
    id: 'meeting-edge-5',
    from: '최비성', to: ['임수연'], type: 'REQUEST', surface: 'DISCORD',
    at: daysAgo(1, 20, 26), doc: 'plan', agenda: 'slot',
    says: [
      ['최비성', '슬롯 카드 목 데이터 형태를 응답이랑 똑같이 맞춰 주세요. 지금은 키 이름이 달라요.'],
    ],
  },
  {
    id: 'meeting-edge-6',
    from: '최비성', to: ['임수연'], type: 'CHANGE', surface: 'SERVICE',
    at: daysAgo(1, 20, 31), doc: 'plan', agenda: 'slot',
    says: [
      ['최비성', '응답 키가 suggested_slots 에서 slots 로 바뀝니다. 오늘 배포에 같이 나가요.'],
      ['임수연', '반영하고 알려 드릴게요.'],
    ],
  },

  {
    id: 'meeting-edge-7',
    from: '최비성', to: ['서재민'], type: 'CHANGE', surface: 'DISCORD',
    at: daysAgo(1, 20, 19), doc: 'bot', agenda: 'botScope',
    says: [
      ['최비성', '봇이 읽는 채널을 연결한 것만으로 줄였습니다. 전체를 읽으면 사적인 대화까지 회의 기록으로 들어와요.'],
      ['서재민', '그게 맞습니다. 저장 범위는 좁을수록 좋아요.'],
    ],
  },
  {
    id: 'meeting-edge-8',
    from: '최비성', to: ['서재민'], type: 'SCHEDULE', surface: 'DISCORD',
    at: daysAgo(1, 20, 24), agenda: 'botScope',
    says: [
      ['최비성', '멱등키 유니크 제약은 내일 오전 마이그레이션으로 넣겠습니다.'],
    ],
  },

  {
    id: 'meeting-edge-9',
    from: '강다은의 Bordo', to: ['서재민'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(1, 20, 33), doc: 'bot', agenda: 'botScope',
    says: [
      ['강다은의 Bordo', '다은님 기록으로는, 봇 토큰을 채널마다 나누자는 제안이 지난주에 나왔다가 운영이 복잡해져서 접혔습니다.'],
      ['서재민', '그럼 이번에도 하나로 갑시다.'],
    ],
  },
  {
    id: 'meeting-edge-10',
    from: '강다은의 Bordo', to: ['서재민'], type: 'ETC', surface: 'SERVICE',
    at: daysAgo(1, 20, 36), agenda: 'botScope',
    says: [
      ['강다은의 Bordo', '다은님은 지금 베를린 기준 새벽이라 응답이 늦습니다. 확인 뒤에 직접 답할 예정입니다.'],
    ],
  },

  {
    id: 'meeting-edge-11',
    from: '임수연', to: ['유수인의 Bordo'], type: 'REQUEST', surface: 'SERVICE',
    at: daysAgo(1, 20, 38),
    says: [
      ['임수연', '수인님 돌아오시면 회의 카드 여백만 한 번 봐 달라고 전해 주세요.'],
      ['유수인의 Bordo', '전달해 두겠습니다. 확정이 필요한 건은 본인이 돌아온 뒤에 남기겠습니다.'],
    ],
  },
  {
    id: 'meeting-edge-12',
    from: '임수연', to: ['유수인의 Bordo'], type: 'CHANGE', surface: 'DISCORD',
    at: daysAgo(1, 20, 44), doc: 'tokens', agenda: 'agentTone',
    says: [
      ['임수연', 'primary 값이 토큰에서 바뀌어서 시안을 다시 뽑아야 해요.'],
      ['유수인의 Bordo', '어느 화면이 영향을 받는지 목록만 먼저 만들어 두겠습니다.'],
    ],
  },
  {
    id: 'meeting-edge-13',
    from: '임수연', to: ['유수인의 Bordo'], type: 'SCHEDULE', surface: 'SERVICE',
    at: daysAgo(1, 20, 49), agenda: 'agentTone',
    says: [
      ['임수연', '디자인 리뷰는 내일 오후 1시로 옮겼습니다.'],
    ],
  },

  {
    id: 'meeting-edge-14',
    from: '유수인의 Bordo', to: ['최비성', '서재민'], type: 'CONCLUSION', surface: 'DISCORD',
    at: daysAgo(1, 20, 55), doc: 'tone', agenda: 'agentTone',
    says: [
      ['유수인의 Bordo', '수인님 지난 발언 기준으로는 토큰 이름을 유지하는 쪽입니다. 다만 이건 제안이고, 확정은 본인이 돌아와서 하는 게 맞습니다.'],
      ['최비성', '알겠습니다. 그때까지 이름은 안 건드릴게요.'],
    ],
  },
  {
    id: 'meeting-edge-15',
    from: '유수인의 Bordo', to: ['최비성', '서재민'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(1, 21, 0), agenda: 'agentTone',
    says: [
      ['유수인의 Bordo', '근거가 될 만한 발언이 지난 회의 두 곳에 있습니다. 링크를 요약에 같이 남겨 두겠습니다.'],
    ],
  },

  {
    id: 'meeting-edge-16',
    from: '유수인의 Bordo', to: ['서재민'], type: 'ETC', surface: 'SERVICE',
    at: daysAgo(1, 21, 3), doc: 'scratch',
    // 대화 없이 대리인이 혼자 남긴 메모. `delivery_context` 가 빈 배열인 상태를
    // 패널이 어떻게 그리는지 보려고 하나 남겨 둔다.
    says: [],
  },

  {
    id: 'meeting-edge-17',
    from: '서재민', to: ['최비성', '임수연', '강다은의 Bordo', '유수인의 Bordo'],
    type: 'SCHEDULE', surface: 'SERVICE',
    at: daysAgo(1, 21, 6), doc: 'release', agenda: 'release',
    says: [
      ['서재민', '이번 주 금요일까지 플로우 판 · 브리핑 · 수집 세 개만 봅니다.'],
      ['최비성', '수집은 목요일에 붙일 수 있어요.'],
      ['임수연', '판은 내일 시안 반영하면 끝납니다.'],
    ],
  },
  {
    id: 'meeting-edge-18',
    from: '서재민', to: ['최비성', '임수연', '강다은의 Bordo', '유수인의 Bordo'],
    type: 'SCHEDULE', surface: 'SERVICE',
    at: daysAgo(1, 21, 8), agenda: 'release',
    says: [
      ['서재민', '교차 리뷰는 담당 저장소 밖 한 명이 봅니다. 금요일 오전까지 PR 올려 주세요.'],
    ],
  },
  {
    id: 'meeting-edge-19',
    from: '서재민', to: ['최비성', '임수연', '강다은의 Bordo', '유수인의 Bordo'],
    type: 'CONCLUSION', surface: 'SERVICE',
    at: daysAgo(1, 21, 12), doc: 'release', agenda: 'release',
    says: [
      ['서재민', '사람별 작업 요약은 이번 배포에서 뺍니다. 범위가 두 번 줄어든 프로젝트라 다시 늘리지 않겠습니다.'],
      ['최비성', '동의합니다.'],
    ],
  },
]

/**
 * 회의 2 — 오늘 오후의 디자인 리뷰. 일부러 `변동사항` 을 한 건도 안 넣었다.
 * `filter_options.content_types` 가 **그 조회에 나온 종류만** 담는다는 것을
 * 회의를 바꿔 가며 눈으로 확인할 수 있어야 한다.
 */
const MEETING_DESIGN_EDGES = [
  {
    id: 'meeting-edge-20',
    from: '유수인', to: ['임수연', '최비성'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(0, 13, 6), doc: 'tokens', agenda: 'tokenCleanup',
    says: [
      ['유수인', 'primary 다섯 단계 중 실제로 구별되는 건 셋이에요. 나머지 둘은 이름만 다릅니다.'],
      ['임수연', '지금 코드에 둘 다 쓰이고 있어서 치환은 제가 할게요.'],
    ],
  },
  {
    id: 'meeting-edge-21',
    from: '유수인', to: ['임수연', '최비성'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(0, 13, 14), agenda: 'tokenCleanup',
    says: [
      ['유수인', '여백은 4의 배수로 통일합니다. 6px, 10px 이 섞여 있어서 구현할 때마다 다시 물어보게 돼요.'],
    ],
  },
  {
    id: 'meeting-edge-22',
    from: '유수인', to: ['임수연', '최비성'], type: 'REQUEST', surface: 'SERVICE',
    at: daysAgo(0, 13, 22), doc: 'tokens', agenda: 'tokenCleanup',
    says: [
      ['유수인', '토큰 이름 바꾸기 전에 쓰이는 곳 목록만 뽑아 주실 수 있을까요.'],
      ['최비성', '오늘 중에 드릴게요.'],
    ],
  },
  {
    id: 'meeting-edge-23',
    from: '임수연', to: ['유수인'], type: 'OPINION', surface: 'SERVICE',
    at: daysAgo(0, 13, 31), doc: 'emptyRule', agenda: 'emptyState',
    says: [
      ['임수연', '빈 화면 문구를 하나로 쓰면 장애가 평온한 화면으로 보여요. 못 불러온 경우는 다시 시도 버튼이 있어야 합니다.'],
      ['유수인', '문장도 다르게 쓸게요. "아직 없습니다" 와 "불러오지 못했습니다" 는 다른 말이니까요.'],
    ],
  },
  {
    id: 'meeting-edge-24',
    from: '임수연', to: ['유수인'], type: 'REQUEST', surface: 'SERVICE',
    at: daysAgo(0, 13, 38), agenda: 'emptyState',
    says: [
      ['임수연', '빈 상태 일러스트는 화면마다 다르게 갈까요, 하나로 갈까요.'],
      ['유수인', '하나로 가고 문구만 바꾸죠. 화면마다 그리면 유지가 안 돼요.'],
    ],
  },
  {
    id: 'meeting-edge-25',
    from: '강다은의 Bordo', to: ['유수인', '임수연'], type: 'CONCLUSION', surface: 'SERVICE',
    at: daysAgo(0, 13, 45), doc: 'emptyRule', agenda: 'emptyState',
    says: [
      ['강다은의 Bordo', '다은님 기록에서는 Discord 알림 문구도 같은 규칙을 씁니다. 화면과 봇이 다른 말을 하면 같은 상황을 두 번 설명하게 됩니다.'],
    ],
  },
  {
    id: 'meeting-edge-26',
    from: '강다은의 Bordo', to: ['유수인', '임수연'], type: 'ETC', surface: 'SERVICE',
    at: daysAgo(0, 13, 49),
    says: [
      ['강다은의 Bordo', '다은님은 이동 중이라 오늘 저녁에 직접 확인합니다.'],
    ],
  },
  {
    id: 'meeting-edge-27',
    from: '서재민의 Bordo', to: ['유수인'], type: 'SCHEDULE', surface: 'SERVICE',
    at: daysAgo(0, 13, 54), agenda: 'reviewFollowUp',
    says: [
      ['서재민의 Bordo', '재민님 일정에서는 이번 주 안에 토큰 정리, 다음 주에 빈 상태 적용입니다. 순서를 바꾸려면 재민님 확인이 필요합니다.'],
      ['유수인', '그 순서면 됩니다.'],
    ],
  },
  {
    id: 'meeting-edge-28',
    from: '최비성', to: ['유수인'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(0, 13, 58), agenda: 'reviewFollowUp',
    says: [
      ['최비성', '토큰이 바뀌면 목 데이터도 같이 바뀝니다. 그건 제가 맞춰 둘게요.'],
    ],
  },
]

/**
 * 작업 플로우 — 글로벌 회의 도구, 최근 7일.
 *
 * 작업 엣지에는 안건이 없다. 안건은 회의에 속한 것이라 서버도 작업 조회에서는
 * 비워 내려 준다. 대신 `source` · `source_url` 이 채워져 패널에 원본 링크가 뜬다.
 * AI 조회 엣지는 대리인끼리 물어본 기록이라 `lookup_id` 를 채운다 — 이 서비스가
 * 가장 보여 주고 싶은 화살표다.
 */
const WORK_BORDO_EDGES = [
  {
    id: 'work-edge-1',
    from: '최비성의 Bordo', to: ['유수인의 Bordo'], type: 'AI_LOOKUP', surface: 'SERVICE',
    at: daysAgo(6, 11, 20), lookup: 'a7d0f4c1-58e3-4b26-9c17-2f6b0e934d85',
    doc: 'tokens',
    says: [
      ['최비성의 Bordo', '회의 카드에서 쓰는 색 토큰이 확정된 값인지 물었습니다.'],
      ['유수인의 Bordo', '수인님 기준으로는 아직 초안입니다. 이름은 바뀔 수 있으니 코드에 박지 말라고 전해 두었습니다.'],
    ],
  },
  {
    id: 'work-edge-2',
    from: '최비성의 Bordo', to: ['유수인의 Bordo'], type: 'AI_LOOKUP', surface: 'SERVICE',
    at: daysAgo(4, 9, 45), lookup: 'c93b1e07-6a45-4d38-8b02-71c5f4a06e29',
    says: [
      ['최비성의 Bordo', '빈 상태 문구를 서버가 내려 줘야 하는지 물었습니다.'],
      ['유수인의 Bordo', '문구는 화면 소유입니다. 서버는 상태 코드만 주는 쪽으로 정리돼 있습니다.'],
    ],
  },
  {
    id: 'work-edge-3',
    from: '유수인', to: ['서재민', '임수연', '최비성', '강다은'], type: 'WORK', surface: 'SERVICE',
    at: daysAgo(6, 15, 10), source: 'FIGMA',
    url: 'https://www.figma.com/design/bordo-mock/flow-board?node-id=210-88',
    doc: 'meetingCard',
    says: [
      ['유수인', '회의 카드 v3 올렸습니다. 참석자 아바타는 세 개까지만 보이고 나머지는 +N 이에요.'],
      ['임수연', '접히는 기준이 세 명이면 대부분 카드가 +2 로 뜨겠네요.'],
    ],
  },
  {
    id: 'work-edge-4',
    from: '유수인', to: ['서재민', '임수연', '최비성', '강다은'], type: 'WORK', surface: 'SERVICE',
    at: daysAgo(5, 11, 30), source: 'FIGMA',
    url: 'https://www.figma.com/design/bordo-mock/flow-board?node-id=244-12',
    says: [
      ['유수인', '플로우 판 뱃지 색을 종류별로 나눴습니다. 여섯 개가 한 화면에 같이 보여도 구별돼요.'],
    ],
  },
  {
    id: 'work-edge-5',
    from: '유수인', to: ['서재민', '임수연', '최비성', '강다은'], type: 'REVISION', surface: 'SERVICE',
    at: daysAgo(3, 14, 5), source: 'FIGMA',
    url: 'https://www.figma.com/design/bordo-mock/flow-board?node-id=311-4',
    doc: 'meetingCard',
    says: [
      ['유수인', '대리인 노드에 테두리를 넣었습니다. 사람과 대리인이 같은 원이라 구별이 안 된다는 얘기가 계속 나왔어요.'],
      ['최비성', '이제 판만 봐도 누가 대리인인지 보입니다.'],
    ],
  },
  {
    id: 'work-edge-6',
    from: '유수인', to: ['서재민', '임수연', '최비성', '강다은'], type: 'REVISION', surface: 'SERVICE',
    at: daysAgo(2, 16, 40), source: 'FIGMA',
    url: 'https://www.figma.com/design/bordo-mock/flow-board?node-id=318-27',
    says: [
      ['유수인', '요약표를 판 한가운데로 옮겼습니다. 사람이 여덟 명이 돼도 겹치지 않습니다.'],
    ],
  },
  {
    id: 'work-edge-7',
    from: '유수인', to: ['서재민', '임수연', '최비성', '강다은'], type: 'SHARE', surface: 'SERVICE',
    at: minutesAgo(95), source: 'NOTION',
    url: 'https://www.notion.so/bordo-mock/design-tokens-8fa1',
    doc: 'tokens',
    says: [
      ['유수인', '토큰 정리안 문서로 옮겨 뒀습니다. 리뷰에서 나온 것까지 반영했어요.'],
    ],
  },
  {
    id: 'work-edge-8',
    from: '임수연', to: ['유수인', '최비성'], type: 'REVISION', surface: 'SERVICE',
    at: daysAgo(2, 10, 15), source: 'GITHUB',
    url: 'https://github.com/AX-Lions/frontend/pull/42',
    doc: 'meetingCard',
    says: [
      ['임수연', '회의 카드 v3 붙였습니다. 아바타 접기까지 포함했어요.'],
      ['유수인', '간격만 4px 더 주면 좋겠어요.'],
    ],
  },
  {
    id: 'work-edge-9',
    from: '임수연', to: ['유수인', '최비성'], type: 'FEEDBACK', surface: 'SERVICE',
    at: daysAgo(1, 17, 20), source: 'GITHUB',
    url: 'https://github.com/AX-Lions/frontend/pull/45',
    says: [
      ['임수연', '플로우 응답에서 avatar_url 이 null 로 오는 사람이 있어서 이미지가 깨졌습니다. 첫 글자 원으로 대체해 뒀어요.'],
      ['최비성', '서버는 파일이 없으면 null 로 내려 줍니다. 그 처리로 맞습니다.'],
    ],
  },
  {
    id: 'work-edge-10',
    from: '최비성', to: ['임수연', '서재민'], type: 'WORK', surface: 'SERVICE',
    at: daysAgo(4, 20, 50), source: 'GITHUB',
    url: 'https://github.com/AX-Lions/backend/pull/88',
    doc: 'flowContract',
    says: [
      ['최비성', '플로우 응답에 filter_options 를 넣었습니다. 그 조회에 실제로 나온 종류만 담깁니다.'],
      ['임수연', '그럼 필터 목록은 거르지 않은 조회에서 받아야겠네요.'],
    ],
  },
  {
    id: 'work-edge-11',
    from: '최비성', to: ['임수연', '서재민'], type: 'FEEDBACK', surface: 'SERVICE',
    at: daysAgo(1, 11, 5), source: 'GITHUB',
    url: 'https://github.com/AX-Lions/backend/pull/91',
    says: [
      ['최비성', '오류를 상태 코드로 나누지 말고 error.code 로 봐 주세요. 404 하나에 두 가지 상황이 섞여 있습니다.'],
    ],
  },
  {
    id: 'work-edge-12',
    from: '강다은', to: ['서재민'], type: 'WORK', surface: 'SERVICE',
    at: daysAgo(3, 8, 25), source: 'GITHUB',
    url: 'https://github.com/AX-Lions/discord/pull/17',
    doc: 'botRelay',
    says: [
      ['강다은', '재연결 때 같은 메시지가 두 번 들어오던 것 막았습니다. 멱등키를 유니크로 걸었어요.'],
      ['서재민', '화살표 개수가 부풀던 원인이 이거였겠네요.'],
    ],
  },
  {
    id: 'work-edge-13',
    from: '유수인의 Bordo', to: ['서재민의 Bordo'], type: 'AI_LOOKUP', surface: 'SERVICE',
    at: minutesAgo(240), lookup: 'e6142b8d-0c79-4a35-91fe-3d58a7c02b64',
    doc: 'release',
    says: [
      ['유수인의 Bordo', '이번 배포에 사람별 작업 요약이 들어가는지 물었습니다.'],
      ['서재민의 Bordo', '빠집니다. 어제 회의에서 범위를 다시 늘리지 않기로 정리됐습니다.'],
    ],
  },
  {
    id: 'work-edge-14',
    from: '서재민', to: ['유수인', '임수연', '최비성', '강다은'], type: 'SHARE', surface: 'SERVICE',
    at: minutesAgo(35), source: 'NOTION',
    url: 'https://www.notion.so/bordo-mock/release-8-4th-week',
    doc: 'release',
    says: [
      ['서재민', '배포 범위 문서 갱신했습니다. 빠지는 것도 같이 적어 뒀어요.'],
      ['강다은', '봇 쪽은 목요일까지 맞추겠습니다.'],
    ],
  },
]

/**
 * 작업 플로우 — 연합학술제. 같은 팀이 병행하는 다른 프로젝트다.
 * GitHub 작업이 아직 없어서 `filter_options.sources` 가 회의 도구 쪽과 다르게
 * 나온다. 프로젝트를 바꾸면 필터 목록도 바뀌어야 한다는 것을 여기서 본다.
 */
/*
  오늘 진행 중인 회의.

  **끝나지 않은 회의도 판이 그려져야 한다.** 회의가 도는 동안 자리를 비운
  사람이 지금까지 무슨 이야기가 오갔는지 보는 것이 이 화면의 쓸모라, 진행
  중인 상태를 데이터에 넣어 둔다. 그래서 시각이 전부 `minutesAgo` 다.
*/
const MEETING_REGULAR_EDGES = [
  {
    id: 'meeting-regular-1',
    from: '서재민', to: ['최비성', '임수연'], type: 'SCHEDULE', surface: 'DISCORD',
    at: minutesAgo(48), agenda: 'slot',
    says: [
      ['서재민', '이번 주 목표부터 맞추고 갑시다. 금요일 시연 기준으로 잡습니다.'],
    ],
  },
  {
    id: 'meeting-regular-2',
    from: '최비성', to: ['서재민'], type: 'OPINION', surface: 'DISCORD',
    at: minutesAgo(41),
    says: [
      ['최비성', '시간대 처리는 어제 병합했습니다. 채팅 날짜 구분선이 이제 보는 사람 기준입니다.'],
      ['서재민', '해외 팀원 계정으로도 확인됐습니까?'],
      ['최비성', '베를린 계정으로 테스트 고정해 뒀습니다.'],
    ],
  },
  {
    id: 'meeting-regular-3',
    from: '임수연', to: ['서재민'], type: 'REQUEST', surface: 'SERVICE',
    at: minutesAgo(33), doc: 'plan',
    says: [
      ['임수연', '로그인 시안이 아직 없어서 임시 화면으로 돌고 있습니다. 이번 주 안에 필요합니다.'],
    ],
  },
  {
    id: 'meeting-regular-4',
    from: '유수인의 Bordo', to: ['서재민', '임수연'], type: 'CHANGE', surface: 'SERVICE',
    at: minutesAgo(31),
    says: [
      ['유수인의 Bordo', '유수인님 기록에 따르면 로그인 시안은 어제 초안까지 나왔고, 오늘 중 공유 예정으로 남아 있습니다.'],
    ],
  },
  {
    id: 'meeting-regular-5',
    from: '유수인의 Bordo', to: ['서재민'], type: 'ETC', surface: 'SERVICE',
    at: minutesAgo(29),
    says: [
      ['서재민', '그럼 오늘 중으로 받을 수 있다고 봐도 됩니까?'],
      ['유수인의 Bordo', '거기까지는 확인이 필요합니다. 기록에는 예정으로만 있고 확정한 흔적이 없어 본인께 넘겨 두었습니다.'],
    ],
  },
  {
    id: 'meeting-regular-6',
    from: '강다은', to: ['최비성'], type: 'CONCLUSION', surface: 'DISCORD',
    at: minutesAgo(18), agenda: 'botScope',
    says: [
      ['강다은', 'Outbox consumer 리뷰 반영 중입니다. 중복 게시 막는 것부터 넣겠습니다.'],
      ['최비성', '그 부분 백엔드도 같이 보겠습니다.'],
    ],
  },
]

/*
  이미 끝난 회의. 유수인이 참석한 회의라 브리핑이 없다.

  **불참한 회의만 있으면 화면이 한쪽만 보여 준다.** 참석한 회의는 브리핑 자리가
  비는 것이 정상인데, 그 정상을 데이터에 넣어 두지 않으면 화면이 그것을 오류로
  그리는지 알 수가 없다.
*/
const MEETING_SYNC_EDGES = [
  {
    id: 'meeting-sync-1',
    from: '최비성', to: ['서재민', '유수인'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(4, 15, 10), doc: 'flowContract',
    says: [
      ['최비성', '작업 모드 인덱스가 늘 비어 있던 원인을 찾았습니다. 회의 스코프로 물어서 그렇습니다.'],
      ['서재민', '작업 화살표에는 회의가 없으니 무엇을 넣든 0건이었겠습니다.'],
    ],
  },
  {
    id: 'meeting-sync-2',
    from: '유수인', to: ['임수연'], type: 'REQUEST', surface: 'SERVICE',
    at: daysAgo(4, 15, 22), doc: 'meetingCard',
    says: [
      ['유수인', '카드 안의 긴 제목이 잘리지 않고 넘칩니다. 줄임표가 안 걸려 있는 것 같습니다.'],
    ],
  },
  {
    id: 'meeting-sync-3',
    from: '임수연', to: ['유수인'], type: 'CHANGE', surface: 'SERVICE',
    at: daysAgo(4, 15, 40),
    says: [
      ['임수연', '확인했습니다. 줄임 규칙이 flex 안에서 무효가 되는 조건에 걸려 있었습니다. 고쳤습니다.'],
    ],
  },
  {
    id: 'meeting-sync-4',
    from: '서재민', to: ['최비성', '임수연', '유수인'], type: 'CONCLUSION', surface: 'DISCORD',
    at: daysAgo(4, 16, 5), agenda: 'release',
    says: [
      ['서재민', '이번 주는 화면 연결까지만 하고 새 기능은 넣지 않습니다.'],
    ],
  },
]

/*
  연합학술제 킥오프. 다른 프로젝트에도 회의가 있어야 프로젝트를 옮겨 다니는
  것이 화면에서 의미를 갖는다.
*/
/*
  **판이 커졌을 때를 보는 회의.**

  다른 회의는 노드가 넷에서 여덟인데, 그 규모에서는 겹침도 잘림도 안 나온다.
  여기는 사람 다섯이 전원 참석하고 그중 셋이 대리인을 보내, 노드가 여덟에
  화살표가 열둘이다.

  ## 무엇을 보려고 만드나

  - 노드가 많을 때 배치가 겹치지 않는가
  - 한 쌍 사이에 종류가 넷일 때 뱃지가 넘치지 않는가 (`rehearsal-5` 묶음)
  - **긴 이름이 잘리는가** — `유수인의 Bordo` 는 열 자인데, 대리인 호칭이
    길어지면(`{이름}의 Bordo`) 노드 폭을 넘는다. 여기서만 확인할 수 있다
  - 한 사람이 여럿에게 동시에 보낼 때 (`rehearsal-1` 은 넷에게)

  실제로 있을 법한 회의로 둔다. 억지 데이터로 채우면 배치는 확인되지만
  「이런 회의가 실제로 있나」 를 의심하게 되어 시연에 못 쓴다.
*/
const MEETING_REHEARSAL_EDGES = [
  {
    id: 'rehearsal-1',
    from: '서재민', to: ['유수인', '임수연', '최비성', '강다은'], type: 'SCHEDULE',
    surface: 'SERVICE', at: daysAgo(4, 10, 0), agenda: 'slot',
    says: [
      ['서재민', '리허설은 금요일 오전 10시입니다. 그날 오전은 다들 현장에 있어야 합니다.'],
    ],
  },
  {
    id: 'rehearsal-2',
    from: '유수인', to: ['서재민'], type: 'OPINION', surface: 'SERVICE',
    at: daysAgo(4, 10, 12),
    says: [
      ['유수인', '시안 최종본은 목요일 저녁에 올리겠습니다. 리허설 때는 그걸로 봅니다.'],
    ],
  },
  {
    id: 'rehearsal-3',
    from: '임수연', to: ['유수인'], type: 'REQUEST', surface: 'SERVICE',
    at: daysAgo(4, 10, 25),
    says: [
      ['임수연', '시안에서 간격 토큰만 먼저 주실 수 있을까요. 화면 네 개가 그것에 걸려 있습니다.'],
      ['유수인', '오늘 안에 그 부분만 따로 보내겠습니다.'],
    ],
  },
  {
    id: 'rehearsal-4',
    from: '최비성', to: ['서재민', '임수연'], type: 'CHANGE', surface: 'DISCORD',
    at: daysAgo(4, 10, 40),
    says: [
      ['최비성', '준비 화면 계약을 바꿨습니다. 저장이 셋으로 갈립니다.'],
    ],
  },
  {
    id: 'rehearsal-5',
    from: '강다은의 Bordo', to: ['서재민'], type: 'OPINION', surface: 'DISCORD',
    at: daysAgo(4, 10, 52),
    says: [
      ['강다은의 Bordo', '강다은 님은 이 시간대에 자리를 비웁니다. 리허설 시각은 확정으로 전달받았습니다.'],
    ],
  },
  {
    id: 'rehearsal-6',
    from: '강다은의 Bordo', to: ['서재민'], type: 'SCHEDULE', surface: 'DISCORD',
    at: daysAgo(4, 11, 4),
    says: [
      ['강다은의 Bordo', '봇 배포는 목요일 밤으로 잡아 두겠다고 미리 적어 두셨습니다.'],
    ],
  },
  {
    id: 'rehearsal-7',
    from: '강다은의 Bordo', to: ['서재민'], type: 'ETC', surface: 'DISCORD',
    at: daysAgo(4, 11, 15),
    says: [
      ['강다은의 Bordo', '포털 권한 두 개는 본인 확인이 필요해 보류했습니다.'],
    ],
  },
  {
    id: 'rehearsal-8',
    from: '강다은의 Bordo', to: ['서재민'], type: 'REQUEST', surface: 'DISCORD',
    at: daysAgo(4, 11, 26),
    says: [
      ['강다은의 Bordo', '돌아오시면 Intent 설정을 확인해 달라고 남겨 두었습니다.'],
    ],
  },
  {
    id: 'rehearsal-9',
    from: '유수인의 Bordo', to: ['임수연', '최비성'], type: 'CHANGE', surface: 'SERVICE',
    at: daysAgo(4, 11, 38), agenda: 'tokenCleanup',
    says: [
      ['유수인의 Bordo', '간격 값은 다음 주로 미루기로 정해 두셨습니다. 오늘 확정하지 않습니다.'],
    ],
  },
  {
    id: 'rehearsal-10',
    from: '최비성의 Bordo', to: ['서재민'], type: 'ETC', surface: 'SERVICE',
    at: daysAgo(4, 11, 50),
    says: [
      ['최비성의 Bordo', '이 건은 기록이 오래되어 현재 상태를 확신할 수 없습니다. 본인 확인이 필요합니다.'],
    ],
  },
  {
    id: 'rehearsal-11',
    from: '서재민', to: ['유수인', '임수연', '최비성', '강다은'], type: 'CONCLUSION',
    surface: 'SERVICE', at: daysAgo(4, 12, 2), agenda: 'slot',
    says: [
      ['서재민', '리허설 금요일 10시 확정. 시안은 목요일 저녁, 배포는 목요일 밤입니다.'],
    ],
  },
  {
    id: 'rehearsal-12',
    from: '임수연', to: ['서재민'], type: 'OPINION', surface: 'SERVICE',
    at: daysAgo(4, 12, 14),
    says: [
      ['임수연', '화면 쪽은 목요일 낮까지 맞추겠습니다.'],
    ],
  },
]

const MEETING_BOOTH_EDGES = [
  {
    id: 'meeting-booth-1',
    from: '유수인', to: ['강다은', '서재민'], type: 'SCHEDULE', surface: 'SERVICE',
    at: daysAgo(6, 11, 0), agenda: 'slot',
    says: [
      ['유수인', '부스 운영은 이틀입니다. 오전·오후로 나눠서 인원을 잡겠습니다.'],
    ],
  },
  {
    id: 'meeting-booth-2',
    from: '강다은', to: ['유수인'], type: 'OPINION', surface: 'SERVICE',
    at: daysAgo(6, 11, 18),
    says: [
      ['강다은', '첫날 오전은 사람이 적을 듯해 둘이면 충분해 보입니다.'],
      ['유수인', '그럼 오후에 더 붙이겠습니다.'],
    ],
  },
  {
    id: 'meeting-booth-3',
    from: '서재민의 Bordo', to: ['유수인', '강다은'], type: 'ETC', surface: 'SERVICE',
    at: daysAgo(6, 11, 30),
    says: [
      ['서재민의 Bordo', '서재민님 일정에 그 이틀 중 첫날 오후가 이미 잡혀 있습니다. 겹치는지 본인 확인이 필요합니다.'],
    ],
  },
  {
    id: 'meeting-booth-4',
    from: '유수인', to: ['강다은'], type: 'CONCLUSION', surface: 'SERVICE',
    at: daysAgo(6, 11, 52), agenda: 'slot',
    says: [
      ['유수인', '초안은 이걸로 두고, 서재민님 확인 받고 확정하겠습니다.'],
    ],
  },
]

/*
  홈의 최근 회의 카드가 가리키는 회의. **서재민이 빠진 회의**라 대리인이 대신
  말한 기록이 남는다.

  긴 제목을 일부러 그대로 뒀다. 카드와 헤더가 긴 제목을 어떻게 줄이는지
  확인할 자리가 하나는 있어야 한다.
*/
const MEETING_POSTER_EDGES = [
  {
    id: 'meeting-poster-1',
    from: '유수인', to: ['임수연', '강다은'], type: 'SHARE', surface: 'SERVICE',
    at: daysAgo(6, 19, 40), doc: 'posterDraft',
    says: [
      ['유수인', '포스터 초안 올렸습니다. 제목 서체만 두 안으로 뽑아 뒀습니다.'],
    ],
  },
  {
    id: 'meeting-poster-2',
    from: '임수연', to: ['유수인'], type: 'OPINION', surface: 'SERVICE',
    at: daysAgo(6, 19, 55),
    says: [
      ['임수연', '두 번째 안이 멀리서도 읽힙니다. 부스에서는 그게 중요할 것 같습니다.'],
      ['강다은', '저도 두 번째가 낫다고 봅니다.'],
    ],
  },
  {
    id: 'meeting-poster-3',
    from: '서재민의 Bordo', to: ['유수인', '임수연', '강다은'], type: 'CHANGE', surface: 'SERVICE',
    at: daysAgo(6, 20, 8), doc: 'submitGuide',
    says: [
      ['유수인', '서재민님, 제출 마감이 언제였습니까?'],
      ['서재민의 Bordo', '제출 안내 문서에 금요일 18시로 적혀 있습니다. 서재민님 작업 기록에도 같은 날짜가 있습니다.'],
    ],
  },
  {
    id: 'meeting-poster-4',
    from: '서재민의 Bordo', to: ['유수인'], type: 'ETC', surface: 'SERVICE',
    at: daysAgo(6, 20, 15),
    says: [
      ['유수인', '그럼 인원 배치도 그때까지 확정하면 됩니까?'],
      ['서재민의 Bordo', '그 부분은 확인이 필요합니다. 마감은 문서에 있지만 인원 배치 기한은 어디에도 적혀 있지 않아, 서재민님께 넘겨 두었습니다.'],
    ],
  },
  {
    id: 'meeting-poster-5',
    from: '유수인', to: ['강다은'], type: 'CONCLUSION', surface: 'SERVICE',
    at: daysAgo(6, 20, 33),
    says: [
      ['유수인', '포스터는 두 번째 안으로 갑니다. 인원 배치는 서재민님 확인 뒤에 확정하겠습니다.'],
    ],
  },
]

const WORK_ACADEMY_EDGES = [
  {
    id: 'work-edge-15',
    from: '강다은', to: ['유수인', '임수연'], type: 'WORK', surface: 'SERVICE',
    at: daysAgo(5, 19, 10), source: 'NOTION',
    url: 'https://www.notion.so/bordo-mock/academy-plan',
    doc: 'submitGuide',
    says: [
      ['강다은', '제출물 목록 정리했습니다. 시연 영상은 3분 넘으면 잘려요.'],
      ['임수연', '그럼 화면 녹화는 두 화면만 담죠.'],
    ],
  },
  {
    id: 'work-edge-16',
    from: '강다은', to: ['유수인', '임수연'], type: 'WORK', surface: 'SERVICE',
    at: daysAgo(4, 21, 30), source: 'NOTION',
    url: 'https://www.notion.so/bordo-mock/academy-schedule',
    says: [
      ['강다은', '발표 순서 나왔습니다. 우리는 둘째 날 오전이에요.'],
    ],
  },
  {
    id: 'work-edge-17',
    from: '강다은', to: ['유수인', '임수연'], type: 'REVISION', surface: 'SERVICE',
    at: daysAgo(2, 20, 15), source: 'NOTION',
    url: 'https://www.notion.so/bordo-mock/academy-plan',
    doc: 'submitGuide',
    says: [
      ['강다은', '저장소를 공개로 두기 전에 서버 정보가 든 파일이 없는지 확인하는 항목을 넣었습니다.'],
    ],
  },
  {
    id: 'work-edge-18',
    from: '강다은', to: ['유수인', '임수연'], type: 'SHARE', surface: 'SERVICE',
    at: daysAgo(1, 22, 5), source: 'NOTION',
    url: 'https://www.notion.so/bordo-mock/academy-checklist',
    says: [
      ['강다은', '체크리스트 공유합니다. 각자 맡은 줄에 이름 적어 주세요.'],
    ],
  },
  {
    id: 'work-edge-19',
    from: '유수인', to: ['서재민', '강다은', '임수연', '최비성'], type: 'REVISION', surface: 'SERVICE',
    at: daysAgo(3, 16, 45), source: 'FIGMA',
    url: 'https://www.figma.com/design/bordo-mock/academy-poster?node-id=12-4',
    doc: 'posterDraft',
    says: [
      ['유수인', '포스터 A안 제목 크기를 키웠습니다. 멀리서 읽히는 게 먼저라고 봤어요.'],
      ['강다은', '일시가 작아진 건 온라인 공유용이면 괜찮습니다.'],
    ],
  },
  {
    id: 'work-edge-20',
    from: '유수인', to: ['서재민', '강다은', '임수연', '최비성'], type: 'FEEDBACK', surface: 'SERVICE',
    at: daysAgo(1, 13, 25), source: 'FIGMA',
    url: 'https://www.figma.com/design/bordo-mock/academy-poster?node-id=18-9',
    says: [
      ['유수인', 'A안과 B안을 한 장으로 합치자는 의견은 접었습니다. 둘 다 애매해져요.'],
    ],
  },
  {
    id: 'work-edge-21',
    from: '임수연의 Bordo', to: ['강다은의 Bordo'], type: 'AI_LOOKUP', surface: 'SERVICE',
    at: minutesAgo(150), lookup: 'b45c8f21-9d63-4e07-a8b1-52f7c9046e3d',
    doc: 'submitGuide',
    says: [
      ['임수연의 Bordo', '발표 자료 마감이 언제인지 물었습니다.'],
      ['강다은의 Bordo', '다은님 기록으로는 발표 이틀 전입니다. 다만 공지에 확정 표시가 없어 다은님이 확인한 뒤 알려 드리겠습니다.'],
    ],
  },
  {
    id: 'work-edge-22',
    from: '서재민', to: ['강다은'], type: 'FEEDBACK', surface: 'SERVICE',
    at: minutesAgo(70), source: 'NOTION',
    url: 'https://www.notion.so/bordo-mock/academy-checklist',
    says: [
      ['서재민', '체크리스트에 담당자 칸이 비어 있는 줄이 셋 있습니다. 비워 두면 아무도 안 합니다.'],
      ['강다은', '오늘 안에 채우겠습니다.'],
    ],
  },
]

/* ────────────────────────────────────────────────────────────
   빌더
   ──────────────────────────────────────────────────────────── */

function round3(value) {
  return Math.round(value * 1000) / 1000
}

/**
 * 받는 사람은 id 순으로 세운다.
 *
 * 원장에 적은 순서를 그대로 쓰면 같은 화살표가 부를 때마다 다른 `id` 를 갖게 될
 * 수 있고(`a->b|c` 와 `a->c|b`), 그러면 뱃지 강조가 어긋난다. 서버도 정렬해서
 * 내려 준다.
 */
function sortNodes(nodes) {
  return [...nodes].sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

/** `유수인의 Bordo → 최비성, 임수연, 강다은 외 1명` */
function directionLabel(from, to) {
  const names = to.map((node) => node.name)
  const rest = names.length > 3 ? ` 외 ${names.length - 3}명` : ''
  return `${from.name} → ${names.slice(0, 3).join(', ')}${rest}`
}

/** 아바타는 세 개까지. 파일이 없는 사람은 `null` 이라 빠진다. */
function avatarsOf(to) {
  return to.map((node) => node.avatar_url).filter(Boolean).slice(0, 3)
}

function edgeNodes(spec) {
  return { from: NODES[spec.from], to: sortNodes(spec.to.map((name) => NODES[name])) }
}

/**
 * 안건.
 *
 * `related_edge_ids` 는 이 안건을 가리킨 엣지에서 모은다. `direction_label` 도
 * 그 엣지들이 실제로 오간 방향을 합쳐 만든다 — 손으로 적으면 안건을 눌렀을 때
 * 강조되는 화살표가 패널 내용과 어긋난다.
 */
function buildAgendas(edges) {
  const grouped = {}
  edges.forEach((spec) => {
    if (!spec.agenda) {
      return
    }
    if (!grouped[spec.agenda]) {
      grouped[spec.agenda] = []
    }
    grouped[spec.agenda].push(spec)
  })

  const out = {}
  Object.entries(grouped).forEach(([key, specs]) => {
    const base = AGENDAS[key]
    const from = NODES[specs[0].from]
    const toNames = [...new Set(specs.flatMap((spec) => spec.to))]
    out[key] = {
      id: base.id,
      title: base.title,
      sort_order: base.sort_order,
      category: '',
      owner_id: person(base.owner).id,
      status: base.status,
      content: base.content,
      direction_label: `${from.name} → ${toNames.join(', ')}`,
      created_by_agent: base.created_by_agent,
      related_edge_ids: specs.map((spec) => spec.id),
    }
  })
  return out
}

function buildArrows(edges, opacityAt) {
  const groups = new Map()

  edges.forEach((spec) => {
    const { from, to } = edgeNodes(spec)
    const id = `${from.id}->${to.map((node) => node.id).join('|')}`
    if (!groups.has(id)) {
      groups.set(id, { id, from, to, specs: [] })
    }
    groups.get(id).specs.push(spec)
  })

  return [...groups.values()]
    .map((group) => {
      const latest = group.specs
        .map((spec) => spec.at)
        .reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))

      return {
        id: group.id,
        from_node_id: group.from.id,
        to_node_ids: group.to.map((node) => node.id),
        direction_label: directionLabel(group.from, group.to),
        counts: CONTENT_ORDER
          .map((type) => group.specs.filter((spec) => spec.type === type))
          .filter((hit) => hit.length > 0)
          .map((hit) => ({
            content_type: hit[0].type,
            label: CONTENT_LABEL[hit[0].type],
            count: hit.length,
            edge_ids: hit.map((spec) => spec.id),
          })),
        total_count: group.specs.length,
        participant_avatar_urls: avatarsOf(group.to),
        extra_participant_count: Math.max(0, group.to.length - 3),
        latest_occurred_at: latest,
        opacity: opacityAt(latest),
        surfaces: SURFACE_ORDER
          .filter((surface) => group.specs.some((spec) => spec.surface === surface)),
      }
    })
    // 오래된 것부터. 서버 응답도 이 순서라, 진하기(`opacity`)가 뒤로 갈수록
    // 짙어지는 것이 눈에 보인다.
    .sort((a, b) => Date.parse(a.latest_occurred_at) - Date.parse(b.latest_occurred_at))
}

/**
 * 필터 목록.
 *
 * 사람은 **팀 전원**을 담는다(오간 것이 없는 사람도 고를 수 있어야 한다). 내용
 * 종류와 창구는 반대로 이 조회에 실제로 나온 것만 담는다 — 서버가 그렇게 준다.
 */
function filterOptions(edges, withSources) {
  const options = {
    participants: PEOPLE.map((p) => ({ id: p.id, label: p.name, kind: 'USER' })),
    content_types: CONTENT_ORDER.filter((type) => edges.some((spec) => spec.type === type)),
    surfaces: SURFACE_ORDER.filter((surface) => edges.some((spec) => spec.surface === surface)),
  }

  if (withSources) {
    options.sources = SOURCE_ORDER.filter((source) => edges.some((spec) => spec.source === source))
  }
  return options
}

function edgeDetail(spec, { agendas, opacityAt }) {
  const { from, to } = edgeNodes(spec)
  const document = spec.doc ? DOCUMENTS[spec.doc] : null
  const agenda = spec.agenda ? agendas[spec.agenda] : null
  const deliveryContext = (spec.says ?? [])
    .map(([participantName, utterance]) => ({
      participant_name: participantName,
      utterance,
    }))

  return {
    edge: {
      id: spec.id,
      from_node_id: from.id,
      to_node_ids: to.map((node) => node.id),
      content_type: spec.type,
      surface: spec.surface,
      // 회의 엣지는 원본 링크가 없다. `null` 이 아니라 빈 문자열인 것이 서버
      // 응답 모양이고, 화면은 이 값이 비면 링크를 아예 안 그린다.
      source: spec.source ?? '',
      source_url: spec.url ?? '',
      label: CONTENT_LABEL[spec.type],
      direction_label: directionLabel(from, to),
      participant_avatar_urls: avatarsOf(to),
      extra_participant_count: Math.max(0, to.length - 3),
      document_id: document ? document.id : null,
      agenda_id: agenda ? agenda.id : null,
      occurred_at: spec.at,
      /*
        화면에 찍을 시각. 서버가 완성해 준다.

        `occurred_at` 을 화면이 직접 찍으면 브라우저 시간대로 나가 **같은
        화살표를 사람마다 다른 시각으로 본다.** 참여자 시간대 계산이 서버
        몫인 것과 같은 이유다.
      */
      at_label: clockLabel(spec.at),
      opacity: opacityAt(spec.at),
    },
    delivery_context: deliveryContext,
    document: document
      ? {
        ...document,
        delivery_context: deliveryContext,
        // 문서 쪽 방향 표기는 화살표(`→`)가 아니라 `-->` 다. 서버가 그렇게 준다.
        direction_label: `${from.name} --> ${to.map((node) => node.name).join(', ')}`,
      }
      : null,
    agenda,
    lookup_id: spec.lookup ?? null,
  }
}

/* ────────────────────────────────────────────────────────────
   사람 · 대리인 한 명의 상세 (우측 패널, 시안 `601:9055`)
   ──────────────────────────────────────────────────────────── */

/**
 * `HH:MM`. 서버가 완성해 주는 표기라 화면은 그대로 읽는다 — 원본
 * `occurred_at` 을 화면이 찍으면 브라우저 시간대로 나가 같은 발언을 사람마다
 * 다른 시각으로 본다.
 */
function clockLabel(iso) {
  const at = new Date(iso)
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/**
 * 카드 제목.
 *
 * 원장에 제목을 따로 적지 않는다. 안건이 곧 "무엇에 대한 이야기였나" 이고,
 * 안건이 없는 엣지는 붙은 문서가 그 자리를 대신한다. 손으로 적으면 같은
 * 안건을 가리키는 카드들이 저마다 다른 제목을 갖게 된다.
 */
function cardTitle(spec, agendas) {
  if (spec.agenda && agendas[spec.agenda]) {
    return agendas[spec.agenda].title
  }
  if (spec.doc && DOCUMENTS[spec.doc]) {
    return DOCUMENTS[spec.doc].title
  }
  return CONTENT_LABEL[spec.type]
}

/** 이 엣지에서 그 사람이 실제로 한 말. 없으면 첫 발언을 쓴다. */
function utteranceOf(spec, name) {
  const mine = (spec.says ?? []).find(([who]) => who === name)
  const first = (spec.says ?? [])[0]
  return (mine ?? first ?? [null, ''])[1]
}

/**
 * 대리인이 답을 만들기까지의 진행 표시(시안 `601:9055` 의 `Bordo 생각 중…`).
 *
 * **대리인 카드에만 붙는다.** 사람이 한 말에는 이런 과정이 없다. 이 서비스가
 * 파는 것이 "없는 동안 대리인이 무엇을 근거로 말했나" 라, 근거를 모으는 단계가
 * 카드 안에서 보여야 한다 — 결과만 보여 주면 지어낸 말과 구별되지 않는다.
 */
function agentTrace(spec, agendas) {
  const agenda = spec.agenda ? agendas[spec.agenda] : null
  const document = spec.doc ? DOCUMENTS[spec.doc] : null
  const sources = [
    agenda ? `안건: ${agenda.title}` : null,
    document ? `문서: ${document.title}` : null,
    `창구: ${spec.surface === 'DISCORD' ? 'Discord' : '서비스'}`,
  ].filter(Boolean)

  return {
    title: 'Bordo 생각 중…',
    steps: [
      { key: 'receive', label: '접수', state: 'DONE', detail: '질문을 확인했어요.' },
      {
        key: 'analyze',
        label: '분석',
        state: 'DONE',
        detail: `관련된 프로젝트 기록 ${sources.length}개를 분석했어요.`,
        bullets: sources,
      },
      {
        key: 'search',
        label: '검색',
        state: 'DONE',
        detail: '관련 기록을 검색했어요.',
        note: `“${cardTitle(spec, agendas)}” 관련 기록을 찾았어요.`,
      },
      { key: 'verify', label: '정확도 확인', state: 'DONE' },
      { key: 'draft', label: '생성', state: 'DONE' },
      { key: 'send', label: '발송', state: 'DONE' },
      { key: 'done', label: '완료', state: 'DONE' },
    ],
  }
}

/**
 * 한 회의에서 **사람(또는 대리인) 한 명**이 주고받은 것 전부.
 *
 * 판 위의 화살표와 같은 원장에서 만든다. 따로 적으면 판에는 화살표가 있는데
 * 패널은 비어 있는 상태가 조용히 생긴다 — 이 파일이 애초에 원장 하나만 손으로
 * 적는 이유와 같다.
 */
function buildParticipantFlows(edges, agendas) {
  const out = {}

  Object.values(NODES).forEach((node) => {
    const sentSpecs = edges.filter((spec) => spec.from === node.name)
    const receivedSpecs = edges.filter((spec) => spec.to.includes(node.name))
    if (sentSpecs.length === 0 && receivedSpecs.length === 0) {
      return
    }

    const isAgent = node.kind === 'AGENT'

    const group = (specs, mode) => CONTENT_ORDER
      .map((type) => ({ type, hits: specs.filter((spec) => spec.type === type) }))
      .filter(({ hits }) => hits.length > 0)
      .map(({ type, hits }) => ({
        content_type: type,
        label: CONTENT_LABEL[type],
        items: hits.map((spec) => ({
          id: `${spec.id}::${mode}`,
          edge_id: spec.id,
          title: cardTitle(spec, agendas),
          quote: mode === 'sent'
            ? utteranceOf(spec, node.name)
            : utteranceOf(spec, spec.from),
          counterpart: mode === 'sent'
            ? spec.to.join(', ')
            : spec.from,
          at_label: clockLabel(spec.at),
          // 대리인이 **보낸** 카드에만 붙는다. 받은 쪽은 상대가 만든 과정이라
          // 이 사람의 패널에서 보여 줄 것이 아니다.
          trace: mode === 'sent' && isAgent ? agentTrace(spec, agendas) : null,
        })),
      }))

    // 「발언」은 카드 수가 아니라 **실제로 입을 연 횟수**다. 한 엣지 안에서
    // 두 번 말하면 두 번으로 센다 — 판의 화살표 수와 다른 것이 맞다.
    const utterances = edges.reduce(
      (total, spec) => total + (spec.says ?? []).filter(([who]) => who === node.name).length,
      0,
    )

    const headline = [...new Set(
      sentSpecs
        .map((spec) => utteranceOf(spec, node.name))
        .filter(Boolean),
    )]
      .sort((a, b) => b.length - a.length)
      .slice(0, 3)
      .join(' ')

    out[node.id] = {
      node_id: node.id,
      name: node.name,
      kind: node.kind,
      // 회의에 한 번도 입을 안 뗀 사람(대리인만 말한 사람)은 요약할 말이 없다.
      // 빈 문자열로 내려서 화면이 "없음" 을 그리게 한다 — 지어내지 않는다.
      headline,
      counts: [
        { key: 'utterance', label: '발언', count: utterances },
        ...CONTENT_ORDER
          .map((type) => ({ type, n: sentSpecs.filter((spec) => spec.type === type).length }))
          .filter(({ n }) => n > 0)
          .map(({ type, n }) => ({
            key: type,
            content_type: type,
            label: CONTENT_LABEL[type],
            count: n,
          })),
      ],
      sent: group(sentSpecs, 'sent'),
      received: group(receivedSpecs, 'received'),
    }
  })

  return out
}

/* ────────────────────────────────────────────────────────────
   시간순 인덱스 — 좌측 목록이자 재생 대본
   ──────────────────────────────────────────────────────────── */

/**
 * 회의에서 오간 전달을 **한 건씩** 시간 오름차순으로 편다.
 *
 * 안건 인덱스가 「무엇에 대한 이야기였나」 로 묶은 목록이라면 이쪽은 묶지 않은
 * 목록이다. 둘 다 있어야 하는 이유는, 안건에는 결론만 남지만 순서에는 **결론이
 * 어떻게 뒤집혔는지**가 남기 때문이다. 자리를 비웠던 사람이 알고 싶은 것은
 * 대개 후자다.
 *
 * ## 정렬이 흔들리면 안 되는 이유
 *
 * 이 목록은 재생 기능의 대본이기도 하다 — 재생을 누르면 판의 화살표를 전부
 * 지우고 이 순서대로 0.5초 간격으로 하나씩 되살린다. 같은 시각이 둘이면
 * `edge_id` 로 한 번 더 갈라 **매번 같은 순서**가 나오게 한다. 정렬의 안정성에
 * 기대면 원장에 줄을 하나 끼워 넣는 것만으로 재생 순서가 조용히 바뀐다.
 *
 * ## `seq` 는 정렬한 뒤에 붙인다
 *
 * 원장의 번호(`meeting-edge-7`)는 회의에서 오간 순서가 아니라 **적은 순서**다.
 * 그것을 좌측 순번으로 쓰면 7번 줄이 3번 줄보다 이른 시각을 달게 된다.
 */
function buildTimeline(edges, agendas) {
  return [...edges]
    .sort((a, b) => (
      Date.parse(a.at) - Date.parse(b.at) || String(a.id).localeCompare(String(b.id))
    ))
    .map((spec, index) => {
      const { from, to } = edgeNodes(spec)
      return {
        seq: index + 1,
        edge_id: spec.id,
        // 우측 패널 카드와 **같은 함수**로 만든다. 여기서 손으로 다시 적으면
        // 같은 화살표를 좌측과 우측이 다른 이름으로 부르게 된다.
        title: cardTitle(spec, agendas),
        content_type: spec.type,
        label: CONTENT_LABEL[spec.type],
        direction_label: directionLabel(from, to),
        from_node_id: from.id,
        to_node_ids: to.map((node) => node.id),
        surface: spec.surface,
        occurred_at: spec.at,
        // 화면이 `occurred_at` 을 직접 찍으면 브라우저 시간대로 나가 같은
        // 전달을 사람마다 다른 시각으로 본다. 엣지 상세와 같은 이유다.
        at_label: clockLabel(spec.at),
        /*
          줄을 눌렀을 때 판에서 강조할 화살표.

          지금은 전달 한 건이 화살표 한 개라 자기 자신 하나뿐이다. 그래도
          배열로 둔다 — 안건 인덱스의 `related_edge_ids` 와 모양이 같으면
          강조 로직을 하나로 쓸 수 있고, 나중에 서버가 이어진 전달을 묶어
          내려 주더라도 화면은 그대로다.
        */
        related_edge_ids: [spec.id],
      }
    })
}

/**
 * 원장 하나를 조회 응답과 엣지 상세로 편다.
 *
 * `opacity` 는 이 조회 안에서만 의미가 있다. 가장 이른 것을 0.4, 가장 늦은 것을
 * 0.95 로 두고 선형으로 나눈다 — 회의 하나 안에서 무엇이 나중에 오간 것인지가
 * 판에서 보여야 한다.
 */
function flowFor({ head, nodeNames, edges }) {
  const times = edges.map((spec) => Date.parse(spec.at))
  const first = Math.min(...times)
  const span = Math.max(...times) - first

  const opacityAt = (iso) => round3(0.4 + 0.55 * (span > 0 ? (Date.parse(iso) - first) / span : 1))
  const agendas = buildAgendas(edges)

  const details = {}
  edges.forEach((spec) => {
    details[spec.id] = edgeDetail(spec, { agendas, opacityAt })
  })

  // 판과 **같은 원장**에서 만든다. 따로 적으면 판에는 있는데 좌측 목록에 없는
  // 화살표가 생기고, 그건 재생해도 영영 나타나지 않는 화살표가 된다.
  const timeline = buildTimeline(edges, agendas)

  return {
    flow: {
      ...head,
      nodes: nodeNames.map((name) => NODES[name]),
      arrows: buildArrows(edges, opacityAt),
      filter_options: filterOptions(edges, head.category === 'WORK'),
    },
    details,
    agendas,
    participants: buildParticipantFlows(edges, agendas),
    // `count` 는 목록 길이에서 뽑는다. 손으로 적으면 목록과 숫자가 따로 논다.
    timeline: { count: timeline.length, results: timeline },
  }
}

/** `8/17` — 회의 제목 앞에 붙는 날짜. 시각이 상대값이라 라벨도 계산한다. */
function dayLabel(iso) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** `8.11 - 8.18 작업 흐름` */
function periodLabel(from, to) {
  const a = new Date(from)
  const b = new Date(to)
  return `${a.getMonth() + 1}.${a.getDate()} - ${b.getMonth() + 1}.${b.getDate()} 작업 흐름`
}

const WORK_FROM = daysAgo(7, 9, 0)
const WORK_TO = daysAgo(0, 23, 59)

const globalMeeting = flowFor({
  head: {
    meeting_id: MEETING_GLOBAL,
    meeting_label: `${dayLabel(daysAgo(1))} 글로벌 회의 일정 및 개발 방향 논의`,
    category: 'MEETING',
  },
  // 사람 다섯 + 대리인 셋. 강다은은 본인 노드가 조용하고 대리인만 말한다 —
  // 이 서비스가 보여 주려는 상태가 정확히 그것이다.
  nodeNames: [
    '최비성', '임수연', '서재민', '강다은', '유수인',
    '유수인의 Bordo', '강다은의 Bordo', '서재민의 Bordo',
  ],
  edges: MEETING_GLOBAL_EDGES,
})

const designMeeting = flowFor({
  head: {
    meeting_id: MEETING_DESIGN,
    meeting_label: `${dayLabel(daysAgo(0))} 디자인 리뷰`,
    category: 'MEETING',
  },
  nodeNames: [
    '유수인', '임수연', '최비성', '서재민', '강다은',
    '강다은의 Bordo', '서재민의 Bordo',
  ],
  edges: MEETING_DESIGN_EDGES,
})

const bordoWork = flowFor({
  head: {
    project_id: PROJECTS.bordo.id,
    period_label: periodLabel(WORK_FROM, WORK_TO),
    from: WORK_FROM,
    to: WORK_TO,
    category: 'WORK',
  },
  nodeNames: [
    '유수인', '임수연', '최비성', '서재민', '강다은',
    '유수인의 Bordo', '최비성의 Bordo', '서재민의 Bordo',
  ],
  edges: WORK_BORDO_EDGES,
})

const academyWork = flowFor({
  head: {
    project_id: PROJECTS.academy.id,
    period_label: periodLabel(WORK_FROM, WORK_TO),
    from: WORK_FROM,
    to: WORK_TO,
    category: 'WORK',
  },
  nodeNames: [
    '강다은', '유수인', '임수연', '서재민', '최비성',
    '강다은의 Bordo', '임수연의 Bordo',
  ],
  edges: WORK_ACADEMY_EDGES,
})

const regularMeeting = flowFor({
  head: {
    meeting_id: MEETING_REGULAR,
    meeting_label: '오늘 정기 팀 회의',
    category: 'MEETING',
  },
  nodeNames: ['서재민', '최비성', '임수연', '강다은', '유수인의 Bordo'],
  edges: MEETING_REGULAR_EDGES,
})

const syncMeeting = flowFor({
  head: {
    meeting_id: MEETING_SYNC,
    meeting_label: `${dayLabel(daysAgo(4))} 개발팀 Sync`,
    category: 'MEETING',
  },
  nodeNames: ['최비성', '임수연', '서재민', '유수인'],
  edges: MEETING_SYNC_EDGES,
})

const boothMeeting = flowFor({
  head: {
    meeting_id: MEETING_BOOTH,
    meeting_label: `${dayLabel(daysAgo(6))} 연합학술제 부스 운영 킥오프`,
    category: 'MEETING',
  },
  nodeNames: ['유수인', '강다은', '서재민', '서재민의 Bordo'],
  edges: MEETING_BOOTH_EDGES,
})

/**
 * `GET /meetings/{id}/flow`
 *
 * **아직 열리지 않은 회의는 여기 없다.** 없는 것이 맞다 — 오간 말이 없으니
 * 그릴 것도 없고, 화면은 그때 `이 회의에서 오간 내용이 없습니다` 를 그린다.
 * 빈 판을 억지로 만들어 두면 그 자리를 확인할 수가 없다.
 */
const posterMeeting = flowFor({
  head: {
    meeting_id: MEETING_POSTER,
    meeting_label: `${dayLabel(daysAgo(6))} 연합학술제 발표 자료 초안 검토`,
    category: 'MEETING',
  },
  nodeNames: ['유수인', '임수연', '강다은', '서재민의 Bordo'],
  edges: MEETING_POSTER_EDGES,
})

const rehearsalMeeting = flowFor({
  head: {
    meeting_id: MEETING_REHEARSAL,
    meeting_label: `${dayLabel(daysAgo(4))} 연합학술제 발표 리허설 일정 조율`,
    category: 'MEETING',
  },
  // 사람 다섯 + 대리인 셋. 다른 회의의 두 배다.
  nodeNames: ['서재민', '유수인', '임수연', '최비성', '강다은',
    '강다은의 Bordo', '유수인의 Bordo', '최비성의 Bordo'],
  edges: MEETING_REHEARSAL_EDGES,
})

export const meetingFlows = {
  [MEETING_GLOBAL]: globalMeeting.flow,
  [MEETING_DESIGN]: designMeeting.flow,
  [MEETING_REGULAR]: regularMeeting.flow,
  [MEETING_SYNC]: syncMeeting.flow,
  [MEETING_BOOTH]: boothMeeting.flow,
  [MEETING_POSTER]: posterMeeting.flow,
  [MEETING_REHEARSAL]: rehearsalMeeting.flow,
}

/** `GET /projects/{id}/flow` */
export const projectFlows = {
  [PROJECTS.bordo.id]: bordoWork.flow,
  [PROJECTS.academy.id]: academyWork.flow,
}

/**
 * `GET /meetings/{meeting_id}/timeline` — 좌측 `시간순 인덱스`.
 *
 * 판이 있는 회의에는 **전부** 있다. 안건 인덱스(`meetingAgendas`)와 달리
 * 회의를 골라 담지 않는다 — 안건은 없는 회의가 있을 수 있지만(아무 안건에도
 * 안 걸린 잡담만 오간 회의), 오간 것이 있는데 시간순 목록이 없는 회의는 없다.
 * 판이 있다는 말이 곧 전달이 하나 이상 있었다는 뜻이기 때문이다.
 */
export const meetingTimelines = {
  [MEETING_GLOBAL]: globalMeeting.timeline,
  [MEETING_DESIGN]: designMeeting.timeline,
  [MEETING_REGULAR]: regularMeeting.timeline,
  [MEETING_SYNC]: syncMeeting.timeline,
  [MEETING_BOOTH]: boothMeeting.timeline,
  [MEETING_POSTER]: posterMeeting.timeline,
  [MEETING_REHEARSAL]: rehearsalMeeting.timeline,
}

/**
 * `GET /projects/{project_id}/timeline`
 *
 * 작업 모드에도 같은 목록이 필요하다. 작업 엣지에는 안건이 없어 좌측 제목이
 * 문서 이름이나 종류 이름으로 떨어지는데, 그것까지 포함해 `cardTitle` 한
 * 곳에서 정한다.
 */
export const projectTimelines = {
  [PROJECTS.bordo.id]: bordoWork.timeline,
  [PROJECTS.academy.id]: academyWork.timeline,
}

/**
 * 회의별 안건과 **그 안건이 가리키는 화살표**.
 *
 * 좌측 인덱스(`meetings.js`)가 이것을 쓴다. 안건을 눌렀을 때 판에서 강조할
 * 화살표 목록인데, 인덱스 쪽에서 따로 적으면 **판에 없는 엣지를 가리키게 된다.**
 * 그러면 안건을 눌러도 아무 일이 없어, 목록이 눌리지 않는 장식처럼 보인다.
 * 실제로 그렇게 어긋나 있었다.
 *
 * 화살표를 만든 원장이 안건도 같이 만들었으므로 여기서 내보내 한 곳만 쓰게 한다.
 */
export const meetingAgendas = {
  [MEETING_GLOBAL]: globalMeeting.agendas,
  [MEETING_DESIGN]: designMeeting.agendas,
  [MEETING_REGULAR]: regularMeeting.agendas,
  [MEETING_SYNC]: syncMeeting.agendas,
  [MEETING_BOOTH]: boothMeeting.agendas,
  [MEETING_POSTER]: posterMeeting.agendas,
}

/**
 * `GET /flow-edges/{id}` — 뱃지를 눌렀을 때 열리는 상세.
 *
 * 판에 올라간 `edge_ids` 를 **전부** 담는다. 원장 하나에서 판과 상세를 같이
 * 만들어 내므로 하나라도 빠질 수가 없다.
 */
/**
 * `GET /meetings/{meeting_id}/participants/{node_id}/flow` — 판에서 사람이나
 * 대리인을 눌렀을 때 열리는 우측 패널(시안 `601:9055`).
 *
 * 키는 `{회의 id}::{노드 id}` 다. 같은 사람이라도 회의마다 주고받은 것이
 * 다르므로 회의를 빼면 어느 회의를 열어도 같은 내용이 뜬다.
 */
export const participantFlows = Object.fromEntries([
  [MEETING_GLOBAL, globalMeeting],
  [MEETING_DESIGN, designMeeting],
  [MEETING_REGULAR, regularMeeting],
  [MEETING_SYNC, syncMeeting],
  [MEETING_BOOTH, boothMeeting],
  [MEETING_POSTER, posterMeeting],
].flatMap(([meetingId, built]) => Object.entries(built.participants)
  .map(([nodeId, body]) => [`${meetingId}::${nodeId}`, body])))

export const flowEdges = {
  ...globalMeeting.details,
  ...designMeeting.details,
  ...regularMeeting.details,
  ...syncMeeting.details,
  ...boothMeeting.details,
  ...posterMeeting.details,
  ...rehearsalMeeting.details,
  ...bordoWork.details,
  ...academyWork.details,
}
