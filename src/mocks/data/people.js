/**
 * 가상 데이터의 **뼈대**. 사람 · 팀 · 프로젝트의 id 는 전부 여기서 나온다.
 *
 * ## 왜 한곳에 모으는가
 *
 * 화면들이 id 로 서로를 잇는다. 플로우 노드의 `user_id` 와 채팅 참여자의 id 가
 * 다르면, 판에서 사람을 눌러도 그 사람의 대화가 안 열린다. 파일마다 id 를
 * 따로 지어내면 **그런 어긋남이 조용히 생기고, 가짜 데이터를 고치느라 시간을
 * 쓰게 된다.** 여기서만 만든다.
 *
 * ## id 가 진짜처럼 생긴 이유
 *
 * 서버가 UUID 를 주므로 화면 어딘가에 길이나 모양을 가정한 코드가 있을 수
 * 있다. `user-1` 같은 짧은 id 로 두면 가짜에서만 되고 진짜에서 깨진다.
 */

export const TEAM = {
  id: '8789287d-47fe-4b1c-9e15-a00bb4650396',
  name: '멋사 중앙해커톤',
  description: 'Bordo 개발팀',
}

export const PROJECTS = {
  bordo: {
    id: '841b29f3-659b-47a4-a62a-a9056aac8b4e',
    name: '글로벌 회의 도구',
  },
  academy: {
    id: '7d93361b-eb4c-4b88-9a81-933156f028eb',
    name: '연합학술제',
  },
}

/**
 * 로그인한 사람. 나머지 화면이 전부 이 사람 관점이다.
 *
 * 유수인으로 둔 이유는 **불참한 회의가 있는 사람**이어야 브리핑·대리인 화면이
 * 비지 않기 때문이다. 이 서비스가 묻는 질문이 "내가 없는 동안 무슨 일이
 * 있었지" 라서, 한 번도 빠진 적 없는 사람으로 두면 볼 것이 없다.
 */
export const ME = {
  id: 'ff62109f-0abd-4a8d-8b76-280a90d4a221',
  email: 'susu@bordo.dev',
  name: '유수인',
  avatar_url: '/flowchart/profile-2.jpeg',
  locale: 'ko',
  timezone: 'Asia/Seoul',
  /*
    나라 이름. 서버가 문자열로 완성해 준다.

    시간대(`Asia/Seoul`)에서 화면이 유추하지 않는다. `Europe/Berlin` → `독일`
    은 표를 들고 있어야 하는 변환이고, 그 표를 화면마다 하나씩 두면 같은
    사람이 화면에 따라 다른 나라에 있게 된다.
  */
  country: '대한민국',
  presence: 'ACTIVE',
}

export const PEOPLE = [
  ME,
  {
    id: 'ef9f0d5e-b68b-4a02-affc-26e70de3d13d',
    email: 'backend01@bordo.dev',
    name: '최비성',
    avatar_url: '/flowchart/profile-1.jpeg',
    locale: 'ko',
    timezone: 'Asia/Seoul',
    country: '대한민국',
    presence: 'ACTIVE',
  },
  {
    id: 'a78a912a-a174-406d-9487-34b96176fd0f',
    email: 'front01@bordo.dev',
    name: '임수연',
    avatar_url: '/flowchart/profile-3.jpeg',
    locale: 'ko',
    timezone: 'Asia/Seoul',
    country: '대한민국',
    presence: 'ACTIVE',
  },
  {
    id: '3c1f8a02-9d44-4f57-a1b6-5e2c7d0913aa',
    email: 'jaemin@bordo.dev',
    name: '서재민',
    avatar_url: '/flowchart/profile-4.jpeg',
    locale: 'ko',
    timezone: 'Asia/Seoul',
    country: '대한민국',
    /*
      한 명은 자리를 비워 둔다.

      `상대가 자리를 비웠고 그 사람의 Bordo 가 대신 받는 중` 이 이 서비스의
      핵심 장면인데, 전원이 `ACTIVE` 면 그 표시가 화면에서 한 번도 안 그려진다.
    */
    presence: 'AWAY',
  },
  {
    id: '9b7d4e61-2af8-4c03-8e15-6d90b3c47f22',
    email: 'daeun@bordo.dev',
    name: '강다은',
    avatar_url: '/flowchart/profile-5.jpeg',
    locale: 'ko',
    // **한 명은 다른 시간대에 둔다.** 하루를 자르는 기준이 보는 사람마다
    // 다르다는 것이 이 서비스의 전제인데, 전원이 서울이면 그 코드가 한 번도
    // 안 밟힌다.
    timezone: 'Europe/Berlin',
    country: '독일',
    presence: 'ACTIVE',
  },
]

export const BY_NAME = Object.fromEntries(PEOPLE.map((p) => [p.name, p]))

export function person(name) {
  return BY_NAME[name] ?? ME
}

/** 대리인 노드·채팅방 제목. 서버의 `{이름}의 Bordo` 규칙과 같아야 한다. */
export function agentName(name) {
  return `${name}의 Bordo`
}

/**
 * 며칠 전 시각.
 *
 * 고정된 날짜를 박으면 하루만 지나도 "3일 전 회의" 가 화면에서 미래가 된다.
 * 가짜 데이터가 눈에 띄게 상하는 것을 막으려고 **부를 때마다 지금 기준**으로
 * 계산한다.
 */
export function daysAgo(days, hour = 14, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

/** 오늘 몇 시. 오늘 일정에 쓴다. */
export function todayAt(hour, minute = 0) {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}
