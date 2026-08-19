/**
 * 홈 화면 · 로그인한 사람 · 팀 목록의 가상 데이터.
 *
 * `GET /home` 하나가 첫 화면 전부를 들고 온다 — 인사 · 최근 회의 · 오늘 일정 ·
 * 최근 회의 요약 · 프로젝트 진행 · 사이드바가 한 응답 안에 있다. 그래서 이
 * 파일이 비면 홈이 통째로 빈다. **실서버에서 떠 온 응답의 키 · 중첩 · null
 * 여부를 그대로 두고 양만 늘렸다** — 키 하나가 달라도 화면은 오류를 내지 않고
 * 조용히 빈칸이 되고, 그때 사람은 가짜 데이터를 의심하는 대신 멀쩡한 화면을
 * 고치기 시작한다.
 *
 * 실서버 응답보다 부풀린 곳이 셋이다.
 *
 * 1. **불참한 회의를 둘 넣었다.** 이 서비스가 답하려는 질문이 "내가 없는 동안
 *    무슨 일이 있었지" 인데, 빠진 회의가 하나도 없으면 최근 회의 카드 다섯 장이
 *    전부 똑같아 보여 화면만 보고는 무엇을 하는 물건인지 알 수 없다.
 * 2. **오늘 일정 네 건을 서로 다른 갈래로 두었다** — 불참 등록을 이미 한 것 /
 *    아직 안 한 것 / 참석자가 아니라 참여 링크만 있는 것 / 링크조차 없어
 *    서비스 안에서 여는 것. 화면이 이 넷을 다른 버튼으로 그리는데 한 갈래만
 *    넣으면 나머지 셋은 한 번도 안 밟힌다.
 * 3. **빈 값과 긴 글을 섞었다** — 한 번도 연 적 없는 프로젝트
 *    (`last_opened_at: null`), 진행률 0, 카드를 넘칠 만큼 긴 회의 제목.
 *    채워진 것만 보면 넘칠 때 어떻게 깨지는지 알 수 없다.
 *
 * 시각은 전부 `daysAgo` · `todayAt` · `minutesAgo` 로 만든다. 날짜를 박아 두면
 * 하루만 지나도 "3일 전 회의" 가 화면에서 미래가 된다. `displayed_at` ·
 * `time_range` 는 **서버가 사용자 시간대로 계산해 주는 값이라 화면이 다시
 * 찍지 않는다.** 그래서 여기서도 같은 시각 하나에서 함께 만들어, 표시 문자열과
 * 실제 시각이 따로 놀지 않게 한다.
 */

import { ME, PEOPLE, PROJECTS, TEAM, daysAgo, minutesAgo, person, todayAt } from './people.js'

// ─────────────────────────────────────────── 표시 문자열
//
// 서버가 만들어 주는 값들이라 화면은 그대로 그리기만 한다. 시각과 따로 적어
// 두면 **같은 회의가 카드에는 20:22, 요약에는 21:22** 로 보인다.

function pad(value) {
  return String(value).padStart(2, '0')
}

/** `22:00` */
function hhmm(iso) {
  const at = new Date(iso)
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/** `2026.08.18 · 22:00` — 최근 회의 카드 */
function stamp(iso) {
  const at = new Date(iso)
  return `${at.getFullYear()}.${pad(at.getMonth() + 1)}.${pad(at.getDate())} · ${hhmm(iso)}`
}

/** `08.17 · 21:22` — 요약 카드. 자리가 좁아 연도를 뗀다. */
function shortStamp(iso) {
  const at = new Date(iso)
  return `${pad(at.getMonth() + 1)}.${pad(at.getDate())} · ${hhmm(iso)}`
}

/** 회의 카드가 쓰는 두 값을 한 시각에서 같이 만든다. */
function when(iso) {
  return { scheduled_at: iso, displayed_at: stamp(iso) }
}

/** 오늘 일정 한 칸의 시간대. `time_range` 를 손으로 적으면 곧 어긋난다. */
function slot(fromHour, fromMinute, toHour, toMinute) {
  const at = todayAt(fromHour, fromMinute)
  const endsAt = todayAt(toHour, toMinute)
  return { at, ends_at: endsAt, time_range: `${hhmm(at)} - ${hhmm(endsAt)}` }
}

// ─────────────────────────────────────────── id
//
// `people.js` 에 없는 id 만 여기서 만든다. 앞의 넷은 **실서버 응답에 있던 회의
// id 그대로**다 — 회의 · 플로우 쪽 가상 데이터도 같은 응답을 보고 만들기
// 때문에, 카드를 눌렀을 때 실제로 열릴 확률이 가장 높은 값이다.

const MEETINGS = {
  direction: 'b1a11546-5743-46d4-b052-06407fb69c3c', // 불참 · 요약과 브리핑의 대상
  devSync: 'cdcd5cda-d887-47dc-91aa-4bb7393d461b', // 불참
  standup: '4eb1040f-18d7-4841-bc72-360846888c3d',
  designReview: 'baf061c5-2efc-4ca8-80e5-cecc15582780',
  academyBooth: '0a3f6cd2-71b5-4d8e-9c4a-2f7b8e15d093',
  partnerSync: 'c47e9b30-5a68-4f21-8d0c-6b39f2ae7154',
}

// 실서버 응답에 있던 세 번째 프로젝트. 이름이 붙은 두 개(`PROJECTS`)와 달리
// 회의가 하나도 없어서, 사이드바가 회의 id 없이 `?project=` 만 싣는 경로를
// 밟게 한다.
const PAYMENT_PROJECT_ID = '9eafc86c-0fd1-4350-8908-5f81464d461b'
const DESIGN_SYSTEM_PROJECT_ID = 'd58c1b74-3e29-4a06-b1f7-90ce4482ad61'

const DISCORD_GUILD = '556677889900'
const DISCORD_ACADEMY_CHANNEL = '556677889977'

/** 프로젝트가 전부 같은 팀 아래에 있다. 팀 이름을 네 번 적지 않는다. */
function project(id, name, progress, isFavorite, lastOpenedAt) {
  return {
    id,
    team_id: TEAM.id,
    team_name: TEAM.name,
    name,
    progress,
    thumbnail_url: '',
    is_favorite: isFavorite,
    last_opened_at: lastOpenedAt,
  }
}

const bordoProject = project(PROJECTS.bordo.id, PROJECTS.bordo.name, 62, true, minutesAgo(12))
const academyProject = project(PROJECTS.academy.id, PROJECTS.academy.name, 41, true, daysAgo(1, 21, 40))
const paymentProject = project(PAYMENT_PROJECT_ID, '결제 모듈', 12, false, daysAgo(6, 11, 5))
// 만들어만 두고 한 번도 안 연 프로젝트. 진행률 0 과 `last_opened_at: null` 이
// 화면에서 어떻게 그려지는지 보려고 남긴다. 실제로 흔한 상태다.
const designSystemProject = project(DESIGN_SYSTEM_PROJECT_ID, '디자인 시스템 정비', 0, false, null)

// ─────────────────────────────────────────── GET /home

export const home = {
  user_name: ME.name,
  user_avatar_url: ME.avatar_url,
  greeting_mode: 'WELCOME',

  /*
    브리핑 팝업.

    `always_open` 을 **거짓으로 둔다.** 참이면 홈이 들어오자마자 브리핑으로
    보내 버려서(`HomePage` 의 자동 열기), 정작 이 가상 데이터로 보려던 홈 화면을
    한 번도 못 본다. 자동 열기 쪽을 확인하고 싶으면 이 값 하나만 뒤집으면 된다.
    `me.always_open_briefing` 이 같은 설정이라 함께 맞춰 둔다.
  */
  briefing_pending: {
    exists: true,
    meeting_id: MEETINGS.direction,
    always_open: false,
  },

  shortcuts: {
    agent_room_id: '6e1b85a4-d3b7-4abd-92f8-1e4eb692caec',
    // 실서버에서는 `connected: false` 로 떴다. 연결된 쪽으로 둔 이유는
    // 사이드바가 `Discord 미연결` 안내와 실제 링크를 갈라 그리는데, 끊긴
    // 상태만 넣으면 링크 쪽을 한 번도 못 보기 때문이다.
    discord: {
      connected: true,
      url: `https://discord.com/channels/${DISCORD_GUILD}`,
    },
  },

  /*
    최근 회의 다섯 장.

    **둘은 불참(`missed: true`)이다.** 화면이 그 값으로 `불참한 회의` 뱃지를
    그리는데, 그 뱃지가 첫 화면에서 "내가 없는 동안" 을 가리키는 유일한 단서다.

    `progress` 는 화면이 아직 안 그리는 값이다 — 서버는 지금 회의가 속한
    프로젝트의 진행률을 그대로 넣어 준다. 카드마다 다르게 둔 것은 이 값을 쓰게
    됐을 때 다섯 장이 전부 같은 수라서 안 보이는 일이 없게 하려는 것이다.
  */
  recent_meetings: [
    {
      meeting_id: MEETINGS.direction,
      project_id: PROJECTS.bordo.id,
      project_name: PROJECTS.bordo.name,
      title: '글로벌 회의 일정 및 개발 방향 논의',
      thumbnail_url: null,
      is_favorite: true,
      progress: 72,
      missed: true,
      ...when(daysAgo(1, 20, 22)),
    },
    {
      meeting_id: MEETINGS.devSync,
      project_id: PROJECTS.bordo.id,
      project_name: PROJECTS.bordo.name,
      title: '개발팀 Sync',
      thumbnail_url: null,
      is_favorite: false,
      progress: 45,
      missed: true,
      ...when(daysAgo(2, 17, 0)),
    },
    {
      meeting_id: MEETINGS.standup,
      project_id: PROJECTS.bordo.id,
      project_name: PROJECTS.bordo.name,
      title: '정기 팀 회의',
      thumbnail_url: null,
      is_favorite: false,
      progress: 58,
      missed: false,
      ...when(daysAgo(3, 18, 0)),
    },
    {
      meeting_id: MEETINGS.designReview,
      project_id: PROJECTS.bordo.id,
      project_name: PROJECTS.bordo.name,
      title: '디자인 리뷰',
      thumbnail_url: null,
      is_favorite: true,
      progress: 20,
      missed: false,
      ...when(daysAgo(4, 22, 0)),
    },
    {
      // 카드 폭을 넘기는 제목. 회의 제목은 Discord 채널명이나 안건 문장을
      // 그대로 옮겨 적는 경우가 많아 실제로 이만큼 길어진다.
      meeting_id: MEETINGS.academyBooth,
      project_id: PROJECTS.academy.id,
      project_name: PROJECTS.academy.name,
      title: '연합학술제 발표 자료 초안 검토 및 부스 운영 인원 배치 논의',
      thumbnail_url: null,
      is_favorite: false,
      progress: 90,
      missed: false,
      ...when(daysAgo(6, 19, 30)),
    },
  ],

  /*
    오늘 일정 네 건.

    화면이 오른쪽 버튼을 **세 갈래**로 그린다.

        delegation 이 있다        → 회의에 참여하지 않아요 / 대리 참석 중
        delegation 이 null + url  → 참여하기 (참석자가 아닌 회의)
        둘 다 없다                → 보러가기 (서비스 안에서 연다)

    네 건을 그 갈래에 하나씩 걸쳐 둔다. 한 갈래만 넣으면 나머지는 시연에서도
    검수에서도 한 번을 안 뜬다. 이른 시각과 늦은 시각을 섞은 것은, 지나간
    일정과 남은 일정이 한 목록에 섞였을 때를 보려는 것이다.
  */
  today_schedule: [
    {
      ...slot(9, 30, 10, 0),
      project_id: PROJECTS.bordo.id,
      project_name: PROJECTS.bordo.name,
      title: '정기 팀 회의',
      location: 'Discord',
      meeting_id: MEETINGS.standup,
      discord_channel_id: DISCORD_GUILD,
      action: {
        kind: 'JOIN_DISCORD',
        label: '참여하기',
        url: `https://discord.com/channels/${DISCORD_GUILD}`,
      },
      // 아직 아무것도 안 정한 상태. `sources: null` 은 "고른 적 없음" 이라
      // 팝업이 전체 선택으로 연다 — 빈 배열(전부 끔)과 다른 뜻이다.
      delegation: { delegated: false, prompt: '', sources: null },
    },
    {
      ...slot(14, 0, 15, 0),
      project_id: PROJECTS.bordo.id,
      project_name: PROJECTS.bordo.name,
      title: '디자인 리뷰',
      location: 'Discord',
      meeting_id: MEETINGS.designReview,
      discord_channel_id: DISCORD_GUILD,
      action: {
        kind: 'JOIN_DISCORD',
        label: '참여하기',
        url: `https://discord.com/channels/${DISCORD_GUILD}`,
      },
      /*
        이미 불참 등록을 마친 회의. 이 화면에서 제일 중요한 한 칸이다.

        사전 지시를 길게 둔 이유는, 팝업이 저장된 지시를 **다시 띄워 주는지**를
        여기서만 확인할 수 있기 때문이다. 짧은 한 줄이면 잘리는지 접히는지
        알 수 없다.
      */
      delegation: {
        delegated: true,
        prompt: '시안 A안으로 가는 것에는 동의합니다. 다만 간격 토큰 정리가 아직 안 끝났으니, 간격 값을 오늘 확정하자는 말이 나오면 제 확인 없이 정하지 말고 다음 주로 미뤄 달라고 전해 주세요. 마감은 8월 18일 기준 그대로 답하시면 됩니다.',
        sources: ['work', 'plan', 'document'],
      },
    },
    {
      ...slot(17, 0, 18, 0),
      project_id: PROJECTS.academy.id,
      project_name: PROJECTS.academy.name,
      title: '연합학술제 부스 운영 점검',
      location: 'Discord',
      meeting_id: MEETINGS.academyBooth,
      discord_channel_id: DISCORD_ACADEMY_CHANNEL,
      action: {
        kind: 'JOIN_DISCORD',
        label: '참여하기',
        url: `https://discord.com/channels/${DISCORD_ACADEMY_CHANNEL}`,
      },
      // 참석자가 아니라 초대만 받은 회의. `null` 이면 불참 등록 버튼 대신
      // 참여 링크만 남는다 — 내 자리가 없는 회의에 대리인을 보낼 수는 없다.
      delegation: null,
    },
    {
      ...slot(21, 30, 22, 30),
      project_id: PROJECTS.bordo.id,
      project_name: PROJECTS.bordo.name,
      title: '글로벌 파트너 정기 싱크',
      // 시간대가 다른 사람이 끼어 있어 늦은 시각에 잡혔다.
      location: 'Google Meet',
      meeting_id: MEETINGS.partnerSync,
      discord_channel_id: null,
      // Discord 밖에서 하는 회의라 참여 링크가 없다. 이때 화면은 서비스 안의
      // 회의 화면으로 보낸다.
      action: null,
      delegation: null,
    },
  ],

  /*
    최근 회의 요약.

    **불참한 회의를 고른다.** 참석한 회의를 요약해 두면 이미 아는 이야기라
    카드를 읽을 이유가 없다. 이 카드가 답해야 하는 것은 자리를 비운 사이의
    회의다.
  */
  recent_meeting_summary: {
    meeting_id: MEETINGS.direction,
    team_name: TEAM.name,
    project_name: PROJECTS.bordo.name,
    title: '글로벌 회의 일정 및 개발 방향 논의',
    occurred_at: daysAgo(1, 21, 22),
    displayed_at: shortStamp(daysAgo(1, 21, 22)),
    missed: true,
    status: '불참한 회의',
    main_decisions: [
      '8월 18일까지 디자인 시안 확정',
      '개발 일정 1주 연장',
      '디자인 작업 우선 진행 후 개발팀에 전달',
      // 한 줄을 넘기는 항목. 결정문은 단서가 붙으면 실제로 이만큼 길어진다.
      'Discord 봇 연동은 시안 확정 이후로 미루되 채널 구조는 이번 주 안에 먼저 정해서, 백엔드가 멱등키 설계를 먼저 시작할 수 있게 한다',
      '다음 회의에서 API 명세 리뷰',
    ],
    zero_summary: '디자인 작업을 우선 진행한 후 개발팀에 전달하기로 결정했어요.',
  },

  // 내가 속한 프로젝트 전부. 최근 · 즐겨찾기는 이 목록의 부분집합이고,
  // 플로우 화면이 프로젝트 이름을 찾을 때도 이쪽을 먼저 본다.
  project_progress: [bordoProject, academyProject, paymentProject, designSystemProject],

  // 연 적 있는 것만 최근 순으로. 한 번도 안 연 `디자인 시스템 정비` 는 빠진다.
  recent_projects: [bordoProject, academyProject, paymentProject],

  favorite_projects: [bordoProject, academyProject],
}

// ─────────────────────────────────────────── GET /auth/me · GET /users/me
//
// 두 주소가 같은 몸을 돌려준다. 화면도 읽기는 `/auth/me` 하나로 하고 저장만
// `/users/me` 로 보내므로, 여기서도 하나를 나눠 쓴다.

export const me = {
  ...ME,
  project_role: 'design',
  // 서버가 빈 객체로 준다. 안쪽 모양을 모르는 채 그럴듯한 키를 지어 넣으면
  // 나중에 진짜 값이 왔을 때 화면이 엉뚱한 키를 보고 있게 된다. 비워 둔다.
  notification: {},
  // 홈의 `briefing_pending.always_open` 과 같은 설정이다. 둘이 어긋나면
  // 설정에서는 꺼 뒀는데 홈은 계속 자동으로 열리는 것처럼 보인다.
  always_open_briefing: false,
  dismissed_tooltips: [],
}

// ─────────────────────────────────────────── GET /teams
//
// 프로젝트 추가 팝업이 읽는다. **팀을 둘 둔 이유**는 그 팝업이 팀이 하나뿐일 때
// 선택칸을 잠그기 때문이다 — 하나만 두면 고르는 화면을 못 본다. 둘째 팀에는
// 프로젝트가 없다. 프로젝트 추가 버튼을 누르는 가장 흔한 이유가 바로 그
// 상태라서, 빈 팀 하나는 있어야 한다.

export const teams = {
  count: 2,
  results: [
    {
      id: TEAM.id,
      name: TEAM.name,
      description: TEAM.description,
      created_by: ME.id,
      my_role: 'OWNER',
      categories: ['backend', 'frontend', 'design'],
      member_count: PEOPLE.length,
      created_at: daysAgo(31, 10, 0),
    },
    {
      id: '2f0a6c19-84be-4d7a-9f35-c1e07b6d4a58',
      name: 'AX Lions 국민대',
      // 설명이 빈 팀. 목록이 설명 줄을 어떻게 접는지 보려고 남긴다.
      description: '',
      created_by: person('서재민').id,
      my_role: 'MEMBER',
      categories: [],
      member_count: 3,
      created_at: daysAgo(9, 15, 30),
    },
  ],
}

// ─────────────────────────────────────────── GET /teams/{team_id}/members
//
// 새 프로젝트 팝업의 `참여자 선택` 후보. 시간대가 다른 사람이 섞여 있어야
// 하루를 자르는 기준이 사람마다 다르다는 전제가 화면에서 보인다 —
// `people.js` 가 이미 한 명을 베를린에 두고 있으므로 그대로 쓴다.

export const teamMembers = {
  count: PEOPLE.length,
  results: PEOPLE.map((who, index) => ({
    user_id: who.id,
    name: who.name,
    avatar_url: who.avatar_url,
    team_role: index === 0 ? 'OWNER' : 'MEMBER',
    project_role: ['frontend', 'backend', 'frontend', 'design', 'backend'][index] ?? 'member',
    timezone: who.timezone,
    delegation_enabled: index % 2 === 0,
    agent_status: index % 2 === 0 ? 'ACTIVE' : 'IDLE',
    last_sync_at: minutesAgo(30 + index * 7),
  })),
}
