/**
 * 채팅 가상 데이터 — 사이드바 · 방 목록 · 방별 메시지 · 날짜별 요약.
 *
 * ## 왜 방과 메시지를 따로 적지 않고, 메시지에서 방을 만드는가
 *
 * 실서버 응답을 그대로 베껴 두면 `last_message.preview` 와 실제 마지막 메시지,
 * `has_important` 와 실제 중요 표시, `active-dates` 의 날짜와 메시지의 날짜가
 * **전부 손으로 맞춰야 하는 값**이 된다. 하나만 어긋나도 화면은 조용히
 * 이상해진다 — 사이드바에는 없는 말이 미리보기로 뜨고, 달력에서 파란 날을
 * 눌렀는데 빈 날이 나온다. 그래서 여기서는 **메시지 배열이 원본이고, 방의
 * 미리보기 · 중요 여부 · 대화한 날짜는 전부 거기서 계산한다.** 손으로 남겨 둔
 * 것은 계산할 수 없는 것(미읽음 수, 방 참여자)뿐이다.
 *
 * ## 대리인 방을 굳이 채운 이유
 *
 * 실서버의 대리인 방은 비어 있어서 화면이 늘 `아직 나눈 이야기가 없습니다`
 * 였다. 이 서비스의 핵심 화면이 거기인데 정작 그 화면만 볼 것이 없었다.
 * **유보하는 답("본인 확인이 필요합니다")을 일부러 섞어 둔다** — 유보는 실패가
 * 아니라 이 제품이 내세우는 차별점이라, 가상 데이터에서 빠지면 그 화면을
 * 다듬을 기회 자체가 없어진다.
 *
 * ## 시각을 고정하지 않는다
 *
 * 날짜를 박아 두면 하루만 지나도 "3일 전 회의" 가 미래가 된다. 전부
 * `daysAgo()` · `minutesAgo()` · `todayAt()` 로 만든다. 대신 날짜가 매일
 * 움직이므로 `activeDates` · `dailySummaries` 의 키도 같은 배열에서 뽑는다.
 *
 * **오늘 오간 말에는 `todayAt()` 을 안 쓴다.** 오전 10시에 화면을 열면
 * `todayAt(9, 10)` 은 `minutesAgo(180)`(= 오전 7시)보다 뒤라서, 대화가 거꾸로
 * 쌓이고 날짜 구분선도 엉뚱한 자리에 붙는다. 최근 대화는 전부 `minutesAgo()` 로
 * 두어 **몇 시에 열어도 순서가 유지되게** 한다. 어제 이전 블록은 오전 시각만
 * 쓴다 — 새벽에 열면 `minutesAgo()` 가 어제로 넘어오는데, 어제 블록이 저녁
 * 시각이면 그때 순서가 뒤집히기 때문이다. `todayAt()` 은 아직 오지 않아도
 * 되는 것, 즉 **일정**(`schedules`)에만 쓴다.
 */

import {
  ME,
  PEOPLE,
  PROJECTS,
  TEAM,
  TEAM_ACADEMY,
  agentName,
  daysAgo,
  minutesAgo,
  person,
  teamOf,
  todayAt,
} from './people.js'

/**
 * 방 id.
 *
 * 대리인 방 id 는 **홈의 `shortcuts.agent_room_id` 와 같아야 한다.** 다르면
 * `Bordo 바로가기` 가 없는 방을 열어 빈 화면이 뜬다. 나머지는 실서버에서 떠 온
 * 값을 그대로 쓰거나 같은 UUID 모양으로 만들었다.
 */
const ROOM_IDS = {
  agent: '6e1b85a4-d3b7-4abd-92f8-1e4eb692caec',
  lounge: '8fb541e3-e926-4f48-ab2e-3cb545c9b4f6',
  design: 'c4a7d210-9b3e-4f61-8a52-0d61f0a9c7b4',
  rehearsal: 'a1c47f6b-2d90-4e83-b5f1-70ac9d3e6428',
  slides: 'd06b3e95-8f24-4a17-9c68-31e5b7a0c42d',
  academy: '27d8cb39-34ad-48fb-809c-f7659c43eaf5',
  academySubmit: 'f92d5a08-6c31-4b7e-a04f-83b1e7c26d95',
  team: '6d30247e-c0d3-4983-a006-65236ddd97cc',
  daeun: '7c0f9851-6ea1-4c82-bff5-b26196f2604a',
  suyeon: '2a5d47b8-11c3-4e0a-9df6-8c7b3e5a1902',
  biseong: '9d3e6f01-74ba-4c58-b2e7-5f0a8c1d6b43',
  jaemin: '41c8b7e2-05df-4a93-9c16-7e2b40d85fa9',
  biseongAgent: '5b2f9a06-c83d-4711-a4e9-6d0c72f31e85',
}

/**
 * 대리인 발신자 id.
 *
 * 사람 id 를 그대로 쓰면 **"유수인이 한 말" 과 "유수인의 대리인이 한 말" 이 같은
 * id** 가 된다. 플로우 화면이 사람 노드와 대리인 노드를 나눠 그리는데, 채팅에서
 * 둘을 한 id 로 묶어 두면 대리인이 대신 답했다는 사실이 사라진다. 사람 id 는
 * `people.js` 에서만 만들되, 대리인은 자기 id 를 따로 가진다.
 */
const AGENT_IDS = {
  유수인: '1a0d7c53-6f92-4b18-9c47-2e5b8d0a3f61',
  최비성: '2b1e8d64-70a3-4c29-8d58-3f6c9e1b4a72',
  임수연: '3c2f9e75-81b4-4d3a-9e69-4a7d0f2c5b83',
  서재민: '4d3a0f86-92c5-4e4b-8f7a-5b8e1a3d6c94',
  강다은: '5e4b1a97-a3d6-4f5c-9a8b-6c9f2b4e7d05',
}

// ─────────────────────────────────────────── 만드는 도구

/**
 * 메시지 id.
 *
 * 순번을 UUID 자리에 채워 넣는다. 화면 어딘가에 id 길이나 모양을 가정한 코드가
 * 있을 수 있어서, `msg-1` 같은 짧은 id 로 두면 가짜에서만 되고 진짜에서 깨진다.
 */
let messageSeq = 0
function nextMessageId() {
  messageSeq += 1
  return `c4e17a90-2b6d-4f13-9a05-${String(messageSeq).padStart(12, '0')}`
}

let attachmentSeq = 0
function attachment(name, { kind = 'FILE', sizeBytes = 0, mimeType = 'application/octet-stream' } = {}) {
  attachmentSeq += 1
  const id = `7bd2f501-3c8e-4a67-b19d-${String(attachmentSeq).padStart(12, '0')}`
  return {
    id,
    kind,
    name,
    size_bytes: sizeBytes,
    mime_type: mimeType,
    // 서버가 넣는 자리표시자와 같은 모양. 저장소가 안 붙어 있어 눌러도 404 다.
    url: `/media/chat/${id}/${name}`,
  }
}

function humanSender(name) {
  const who = person(name)
  return { id: who.id, name: who.name, avatar_url: who.avatar_url, is_agent: false }
}

/**
 * 대리인 발신자.
 *
 * `avatar_url` 을 빈 문자열로 둔다. 서버가 사진 없는 계정에 그렇게 내려주고,
 * 화면은 그때 Bordo 기본 아바타를 그린다. `null` 로 두면 그 분기가 안 밟힌다.
 */
function agentSender(name) {
  return { id: AGENT_IDS[name], name: agentName(name), avatar_url: '', is_agent: true }
}

function message(roomId, sender, body, sentAt, extra = {}) {
  return {
    id: nextMessageId(),
    room_id: roomId,
    sender,
    body,
    attachments: [],
    sent_at: sentAt,
    is_mine: sender.id === ME.id,
    /*
      **내 대리인이 내 대신 한 말.**

      `is_mine` 과는 다르다. 화면에서 자리는 내 쪽(오른쪽)이지만 — 상대에게는
      나에게서 온 말이므로 — **고치거나 지울 수는 없다.** 내가 쓴 문장이
      아니기 때문이다. 둘을 한 필드로 합치면 대리인이 한 말에 `수정` 이
      붙는데, 눌러 봐야 서버가 거절한다.

      남의 대리인이 한 말은 여기서 거짓이다. 그건 상대 쪽 말풍선이다.
    */
    is_from_my_agent: sender.is_agent && sender.id === AGENT_IDS[ME.name],
    is_important: false,
    important_confirmed_at: null,
    read_count: 0,
    edited_at: null,
    deleted_at: null,
    // 대리인의 유보 답변에는 서버가 `pending_question_id` 를 실어 준다. 여기서는
    // 비워 둔다 — 그 질문 목록은 다른 가상 데이터 파일이 가지고 있어서, 아무
    // id 나 적으면 눌렀을 때 없는 질문으로 가는 링크가 된다.
    pending_question_id: null,
    ...extra,
  }
}

/** 사람이 한 말. */
function say(roomId, name, body, sentAt, extra) {
  return message(roomId, humanSender(name), body, sentAt, extra)
}

/** 대리인이 한 말. */
function bot(roomId, name, body, sentAt, extra) {
  return message(roomId, agentSender(name), body, sentAt, extra)
}

/**
 * 한 페이지.
 *
 * 전부 한 번에 준다. `has_older` 를 켜 두면 화면이 위로 더 읽으러 가는데,
 * 가상 데이터에는 커서로 자를 이전 페이지가 없어서 같은 목록을 다시 받는다.
 * **없는 것을 있는 척하지 않는다.**
 */
function page(list) {
  return { results: list, next_before: null, has_older: false, has_newer: false }
}

/**
 * 보는 사람 시간대 기준 날짜.
 *
 * `chat.format.js` 의 `localDate` 와 **같은 규칙**이어야 한다. `toISOString()` 을
 * 잘라 쓰면 UTC 기준이라, 한국에서 새벽에 보낸 메시지가 전날로 묶여 달력의
 * 파란 날과 구분선의 날짜가 어긋난다.
 */
function localDate(iso) {
  const at = new Date(iso)
  const year = at.getFullYear()
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function localMonth(iso) {
  return localDate(iso).slice(0, 7)
}

/** 사이드바 미리보기. 지운 메시지는 자리만 남으므로 문구도 서버와 같게 둔다. */
function toLastMessage(list) {
  const last = list[list.length - 1]
  if (!last) {
    return null
  }
  return {
    sender_name: last.sender.name,
    preview: last.deleted_at ? '삭제된 메시지입니다' : last.body,
    sent_at: last.sent_at,
  }
}

// ─────────────────────────────────────────── 대리인 방
/*
  유수인이 자기 대리인에게 묻고, 대리인이 **근거를 대며** 답한다.

  근거를 빼면 이 화면은 그냥 챗봇이 된다. 시각·발언자·커밋 시각처럼 확인
  가능한 것을 붙여 두고, 확인이 안 되는 것은 유보한다.
*/
const agentRoom = ROOM_IDS.agent
const agentMessages = [
  say(agentRoom, '유수인', '어제 3시 회의 내가 못 들어갔는데, 내 쪽으로 넘어온 결정 있어?', daysAgo(1, 8, 40)),
  bot(
    agentRoom,
    '유수인',
    '세 건입니다. ① 프로필 이미지 원형 통일 — 회의에서 확정됐습니다. ② 우측 패널이 1280 이하에서 잘리는 문제 — 임수연 님이 시안 수정을 요청했습니다. ③ 회의 상세 화면의 모바일 기준폭 축소 — 서재민 님 제안이고 아직 결정은 아닙니다. ①과 ②는 디자인 쪽 일이라 유수인 님 몫으로 잡아 두었습니다.',
    daysAgo(1, 8, 41),
  ),
  say(agentRoom, '유수인', '②는 내가 어제 올린 시안에 이미 반영돼 있는데?', daysAgo(1, 8, 44)),
  bot(
    agentRoom,
    '유수인',
    '회의 시각이 15:04, 시안 커밋이 16:20 입니다. 회의에서는 반영 전 시안을 보고 이야기했습니다. 임수연 님께 새 시안을 전달해 둘까요?',
    daysAgo(1, 8, 45),
  ),
  say(agentRoom, '유수인', '응, 전달해 줘', daysAgo(1, 8, 47)),
  bot(agentRoom, '유수인', '결정 모드 라운지에 남겼습니다. 임수연 님이 09:12 에 읽었습니다.', daysAgo(1, 9, 13)),
  say(agentRoom, '유수인', '회의에서 색 토큰 이름 바꾸자는 이야기 나왔어?', daysAgo(1, 11, 5)),
  bot(
    agentRoom,
    '유수인',
    '확실하지 않아 유보합니다. 녹취에 "서페이스 두 개는 합치는 게 낫겠다" 는 발언이 있지만, 토큰 이름을 바꾸자는 뜻인지 컴포넌트를 합치자는 뜻인지 갈립니다. 발언자인 임수연 님께 본인 확인이 필요합니다. 제가 대신 정하지 않겠습니다.',
    daysAgo(1, 11, 6),
  ),
  say(agentRoom, '유수인', '오늘 4시 리허설에 나 대신 들어갈 수 있어?', minutesAgo(420)),
  bot(
    agentRoom,
    '유수인',
    '들어갑니다. 사전 지시로 남겨 두실 것이 있으면 지금 적어 주십시오. 디자인 확정이 필요한 안건은 제 선에서 결정하지 않고 유보로 남깁니다.',
    minutesAgo(419),
  ),
  say(
    agentRoom,
    '유수인',
    '리허설 지시 사항 정리해서 남길게.\n1) 색·타이포·간격처럼 시안이 바뀌는 이야기는 전부 유보로 남기고 나한테 넘겨.\n2) 내 일정은 화·목 오전만 비어 있으니 새 일정은 그 안에서만 잡아 줘.\n3) 데모 순서는 홈 → 대리인 → 플로우 순서로 하자고 전해 줘.\n4) 내가 못 들은 부분은 결정한 사람 이름이랑 근거까지 같이 정리해 줘. 근거 없이 요약만 있으면 나중에 다시 묻게 되더라.',
    minutesAgo(417),
  ),
  bot(
    agentRoom,
    '유수인',
    '네 가지 모두 사전 지시로 등록했습니다. 2번은 캘린더의 화·목 오전 일정과 대조해 두겠습니다.',
    minutesAgo(416),
  ),
  say(agentRoom, '유수인', '지금까지 나온 것 중에 내가 오늘 안에 해야 하는 건?', minutesAgo(95)),
  bot(
    agentRoom,
    '유수인',
    '두 건입니다. ① 원형 프로필을 적용한 시안 재업로드 — 임수연 님이 오늘 리허설 전까지 필요하다고 했습니다. ② 색 토큰 문서에서 `--color-surface-2` 삭제 표시 — 최비성 님 쪽 화면 코드가 아직 그 이름을 참조하고 있습니다.',
    minutesAgo(94),
  ),
  say(agentRoom, '유수인', '고마워', minutesAgo(20)),
  bot(agentRoom, '유수인', '리허설 시작 10분 전에 다시 알려 드리겠습니다.', minutesAgo(19)),
]

// ─────────────────────────────────────────── 동료 대리인 방
/*
  최비성이 자리에 없을 때 그의 대리인에게 묻는 방. 여기서도 유보가 한 번
  나온다 — 남의 대리인이 남의 일을 단정하는 것이 제일 위험하다.
*/
const peerRoom = ROOM_IDS.biseongAgent
const peerMessages = [
  say(peerRoom, '유수인', '비성님 오늘 회의 못 들어오셨는데, 응답 필드 이름 바뀐 것 확정인가요?', daysAgo(2, 16, 10)),
  bot(
    peerRoom,
    '최비성',
    '확정입니다. 어제 16:40 커밋과 함께 결정했습니다. 기존 이름은 다음 주 화요일까지만 같이 내려갑니다.',
    daysAgo(2, 16, 11),
  ),
  say(peerRoom, '유수인', '그럼 프론트 목 데이터도 같이 고쳐야 하나요?', daysAgo(2, 16, 14)),
  bot(
    peerRoom,
    '최비성',
    '네. 바뀐 필드는 셋입니다. `room.name` → `room.title`, `room.path` → `room.path_label`, `message.author` → `message.sender`.',
    daysAgo(2, 16, 15),
  ),
  say(peerRoom, '유수인', '회의 시각 필드도 바뀌었나요?', daysAgo(2, 16, 22)),
  bot(
    peerRoom,
    '최비성',
    '본인 확인이 필요합니다. 그 커밋에는 시각 관련 필드가 없고, 최비성 님이 "시간 쪽은 아직 손 안 댔다" 고 한 것은 이틀 전 대화입니다. 그 사이에 바뀌었는지는 제가 확인할 수 없습니다.',
    daysAgo(2, 16, 23),
  ),
]

// ─────────────────────────────────────────── 프로젝트 방: 결정 모드 라운지
/*
  여러 사람이 오간 방. **아주 긴 말과 아주 짧은 말을 일부러 섞었다** — 말풍선이
  줄바꿈과 최대폭을 어떻게 처리하는지는 그런 데이터가 있어야만 보인다.
*/
const loungeRoom = ROOM_IDS.lounge
const loungeMessages = [
  say(
    loungeRoom,
    '서재민',
    '오늘 3시 정기 회의 안건 올려 둡니다. 1) 로그인 오류 문구 2) 회의 상세 반응형 3) Discord 공지 템플릿',
    daysAgo(3, 10, 2),
  ),
  say(loungeRoom, '임수연', '3번은 다은님 확인이 필요해 보입니다.', daysAgo(3, 10, 5)),
  say(loungeRoom, '강다은', '확인했습니다. 공지 템플릿 초안은 제가 가져갈게요.', daysAgo(3, 10, 11)),
  say(
    loungeRoom,
    '유수인',
    '저는 오늘 학교 발표라 회의 못 들어갑니다. 대리인에 사전 지시 넣어 뒀습니다.',
    daysAgo(3, 10, 14),
    { read_count: 4 },
  ),
  say(loungeRoom, '서재민', '네, 디자인 확정이 필요한 건은 대리인이 유보로 남기게 하겠습니다.', daysAgo(3, 10, 15)),
  say(
    loungeRoom,
    '최비성',
    '응답 구조를 바꿨습니다. 방 목록과 메시지 목록에서 이름이 겹치던 필드를 정리했습니다. `name` 은 사람 이름에만 쓰고 방 제목은 `title` 로, 경로 문자열은 `path_label` 로 갑니다. 메시지의 `author` 는 `sender` 로 바뀌고 그 안에 `is_agent` 가 들어갑니다. 대리인이 한 말인지 사람이 한 말인지 화면이 구분해야 하는데 지금 응답으로는 알 수가 없어서입니다. 기존 필드는 한 주만 같이 내려갑니다.',
    daysAgo(3, 10, 41),
    { is_important: true },
  ),
  say(loungeRoom, '임수연', '넵', daysAgo(3, 10, 47)),
  say(
    loungeRoom,
    '임수연',
    '다만 필드명이 바뀌면 목 데이터도 같이 고쳐야 합니다. 어느 쪽 이름으로 확정인가요?',
    daysAgo(3, 10, 48),
  ),
  say(
    loungeRoom,
    '최비성',
    '`snake_case` 유지합니다. 기존 필드는 한 주만 같이 내려갑니다.',
    daysAgo(3, 10, 52),
    { is_important: true },
  ),
  say(loungeRoom, '서재민', '어제 회의 결과 정리해서 올립니다.', daysAgo(1, 9, 30)),
  say(
    loungeRoom,
    '서재민',
    '[회의 결과]\n1. 프로필 이미지는 원형으로 통일 — 확정 (유수인 대리인이 유보 → 오늘 본인 확인)\n2. 회의 상세 모바일 기준폭 1280 → 1120 — 확정\n3. Discord 공지 템플릿에서 회의 시각 중복 제거 — 확정, 서버에서 뺀다\n4. 로그인 오류 문구 세분화 — 다음 회의로 넘김\n못 들어온 분들은 4번만 따로 봐 주시면 됩니다.',
    daysAgo(1, 9, 31),
    { is_important: true },
  ),
  say(
    loungeRoom,
    '유수인',
    '프로필 이미지는 원형으로 통일해 주십시오.',
    daysAgo(1, 9, 52),
    { is_important: true, important_confirmed_at: daysAgo(1, 10, 0), read_count: 4 },
  ),
  say(
    loungeRoom,
    '임수연',
    '우측 패널이 1280 이하에서 잘립니다. 너비를 다시 봐야 합니다.',
    daysAgo(1, 10, 3),
    { is_important: true },
  ),
  say(loungeRoom, '유수인', '제가 시안 다시 올릴게요.', daysAgo(1, 10, 5), { read_count: 3 }),
  say(
    loungeRoom,
    '강다은',
    'Discord 공지 문구에 회의 시각이 두 번 들어갑니다.',
    daysAgo(1, 11, 20),
    { is_important: true },
  ),
  say(
    loungeRoom,
    '최비성',
    '봇 템플릿에서 한 번, 서버 응답에서 한 번 넣고 있어서 그렇습니다. 서버에서 빼겠습니다.',
    daysAgo(1, 11, 25),
  ),
  say(loungeRoom, '강다은', '감사합니다.', daysAgo(1, 11, 26)),
  say(loungeRoom, '서재민', '오늘 4시 데모 리허설입니다. 각자 화면 하나씩 맡아 주세요.', minutesAgo(400)),
  say(loungeRoom, '임수연', '홈이랑 플로우는 제가 봅니다.', minutesAgo(395)),
  say(loungeRoom, '최비성', '회의 상세랑 채팅은 제가 봅니다.', minutesAgo(390)),
  say(
    loungeRoom,
    '유수인',
    '디자인 토큰 반영본 커밋했습니다. 색 이름이 바뀐 게 있어서 확인 부탁드려요.',
    minutesAgo(180),
    { read_count: 3 },
  ),
  say(loungeRoom, '임수연', '확인했습니다. `--color-surface-2` 가 없어진 것 같은데 맞나요?', minutesAgo(150)),
  say(loungeRoom, '유수인', '네, `--surface-raised` 로 합쳤습니다.', minutesAgo(145), { read_count: 2 }),
  say(
    loungeRoom,
    '서재민',
    '로그인 실패 원인에 따라 오류 메시지를 구분하는 게 좋겠습니다. 지금은 비밀번호가 틀려도, 계정이 잠겨도 전부 "로그인에 실패했습니다" 로 나옵니다.',
    minutesAgo(40),
    { is_important: true },
  ),
  say(
    loungeRoom,
    '최비성',
    '`error.code` 로 갈리게 내려주고 있습니다. 화면에서 코드 보고 문구 고르면 됩니다.',
    minutesAgo(25),
  ),
  say(loungeRoom, '임수연', '그럼 문구표 하나 만들어서 여기 올릴게요.', minutesAgo(12)),
]

// ─────────────────────────────────────────── 프로젝트 방: 디자인 시스템 정리
const designRoom = ROOM_IDS.design
const designMessages = [
  say(designRoom, '유수인', '디자인 토큰 1차 정리본 올립니다.', daysAgo(4, 13, 20), {
    attachments: [
      attachment('bordo-tokens-v1.pdf', { sizeBytes: 482130, mimeType: 'application/pdf' }),
    ],
    read_count: 2,
  }),
  say(designRoom, '임수연', '받았습니다. 색 이름이 코드랑 다른 게 몇 개 있어요.', daysAgo(4, 13, 35)),
  say(designRoom, '유수인', '어떤 거요?', daysAgo(4, 13, 36), { read_count: 1 }),
  say(
    designRoom,
    '임수연',
    '코드에는 `--color-bg` / `--color-surface` / `--color-surface-2` 로 되어 있는데 문서에는 배경 / 표면 / 표면-강조 로 적혀 있습니다. 한글 이름을 그대로 쓸 것은 아니니 문서에도 변수명을 같이 적어 주시면 옮길 때 헷갈리지 않을 것 같습니다.',
    daysAgo(4, 13, 40),
  ),
  say(designRoom, '유수인', '그렇게 할게요. 다음 정리본부터 변수명 같이 적겠습니다.', daysAgo(4, 13, 44), {
    edited_at: daysAgo(4, 13, 46),
    read_count: 2,
  }),
  say(designRoom, '최비성', '다크 모드도 이번에 같이 정하나요?', daysAgo(2, 10, 5), { is_important: true }),
  say(
    designRoom,
    '유수인',
    'MVP 에서는 뺍니다. 범위가 이미 두 번 줄었는데 여기서 또 늘리면 데모를 못 맞춥니다.',
    daysAgo(2, 10, 9),
    { read_count: 3 },
  ),
  say(designRoom, '임수연', '동의합니다.', daysAgo(2, 10, 12)),
  say(
    designRoom,
    '유수인',
    '토큰 2차 정리본 커밋했습니다. `--color-surface-2` 는 `--surface-raised` 로 합쳤습니다.',
    minutesAgo(200),
    { is_important: true, read_count: 2 },
  ),
  say(designRoom, '임수연', '확인했습니다.', minutesAgo(160)),
]

// ─────────────────────────────────────────── 프로젝트 방: 데모 리허설
/*
  `데모 발표 준비` 프로젝트의 방 둘.

  프로젝트를 하나 더 둔 이유는 **팀 아래 프로젝트가 하나뿐이면 팀과 프로젝트의
  경계가 화면에서 안 보이기 때문**이다. 팀 선과 프로젝트 선이 겹쳐 한 줄로만
  읽혀서, 어느 선이 무엇을 감싸는지 확인할 방법이 없었다.
*/
const rehearsalRoom = ROOM_IDS.rehearsal
const rehearsalMessages = [
  say(rehearsalRoom, '서재민', '데모 순서 확정합니다. 홈 → 대리인 → 플로우 순서입니다.', daysAgo(3, 10, 20)),
  say(rehearsalRoom, '임수연', '화면 전환은 제가 잡겠습니다. 세 화면 다 같은 계정으로 갑니다.', daysAgo(3, 10, 24)),
  say(rehearsalRoom, '최비성', '서버는 리허설 30분 전에 한 번 더 올려 두겠습니다.', daysAgo(3, 10, 31)),
  say(
    rehearsalRoom,
    '서재민',
    '시연 중에 무엇이 실패했을 때 어디서 멈출지 미리 정해 둡시다. 지난 중간 점검 때 로그인이 한 번 안 돼서 3분을 거기서 썼습니다. 각 화면마다 "여기서 막히면 다음으로 넘어간다" 를 하나씩 적어 주세요.',
    daysAgo(2, 11, 5),
    { is_important: true },
  ),
  say(rehearsalRoom, '임수연', '홈은 브리핑 팝업까지만 보여주고 넘어가겠습니다.', daysAgo(2, 11, 12)),
  say(rehearsalRoom, '최비성', '플로우는 필터 하나만 걸고 끝냅니다. 세 개 다 누르면 시간이 안 맞습니다.', daysAgo(2, 11, 18)),
  say(
    rehearsalRoom,
    '유수인',
    '대리인 화면은 유보 카드가 보이는 데까지 가야 합니다. 심사에서 지적받은 부분이 거기라서요.',
    daysAgo(1, 14, 40),
    { is_important: true, read_count: 3 },
  ),
  say(rehearsalRoom, '서재민', '그럼 대리인 화면에 시간을 더 주고 홈을 줄입시다.', daysAgo(1, 14, 52)),
  say(rehearsalRoom, '임수연', '수인님, 리허설용 계정 비밀번호 어디에 적어 두셨나요?', minutesAgo(35)),
  /*
    자리를 비운 사이 대리인이 대신 답한 자리를 이 프로젝트에도 하나 둔다.
    `자리 비운 사이` 목록이 늘 같은 세 방만 보이면, 그 목록이 방을 어떻게
    가리키는지(`path_label`) 새 프로젝트에서 확인할 수가 없다.
  */
  bot(
    rehearsalRoom,
    '유수인',
    '수인님은 지금 자리를 비우셨습니다. 리허설 계정은 지난주에 팀 방에 공유된 것을 그대로 쓰기로 되어 있고, 그 뒤로 바뀐 기록은 없습니다. 비밀번호 자체는 제가 옮겨 적지 않겠습니다 — 수인님이 돌아오시면 직접 전달하시도록 남겨 두겠습니다.',
    minutesAgo(34),
    { answered_while_away: true },
  ),
  say(rehearsalRoom, '임수연', '알겠습니다. 그럼 기다릴게요.', minutesAgo(31)),
]

// ─────────────────────────────────────────── 프로젝트 방: 발표 자료
const slidesRoom = ROOM_IDS.slides
const slidesMessages = [
  say(slidesRoom, '유수인', '발표 자료 초안 올립니다. 12장이고 데모는 6장부터입니다.', daysAgo(4, 9, 30), {
    attachments: [
      attachment('bordo-demo-v1.pdf', { sizeBytes: 1284300, mimeType: 'application/pdf' }),
    ],
    read_count: 2,
  }),
  say(slidesRoom, '서재민', '문제 정의가 3장까지 가는 게 길어 보입니다. 두 장으로 줄이죠.', daysAgo(4, 9, 48)),
  say(slidesRoom, '유수인', '줄이겠습니다. 대신 "내가 없는 동안" 문장은 남기겠습니다.', daysAgo(4, 9, 55), {
    read_count: 2,
  }),
  say(
    slidesRoom,
    '임수연',
    '9장 화면 캡처가 옛날 시안입니다. 원형 프로필 적용 전 것이라 데모랑 안 맞습니다.',
    daysAgo(1, 15, 10),
    { is_important: true },
  ),
  say(slidesRoom, '유수인', '오늘 시안 다시 올리면서 같이 갈아 끼우겠습니다.', daysAgo(1, 15, 22), { read_count: 1 }),
  say(slidesRoom, '서재민', '심사 시간이 7분이라 12장은 많습니다. 9장까지 줄여 봅시다.', minutesAgo(210)),
]

// ─────────────────────────────────────────── 프로젝트 방: 학술제 제출물
/*
  다른 팀(`연합 학술제`)의 방. 사람은 겹쳐도 **팀은 다르다.**

  이 방이 있어야 팀이 둘인 목록이 실제로 그려진다. 팀 하나에 방을 더 넣는
  것으로는 "이 대화가 어느 팀 것인지" 를 화면에서 확인할 수 없다.
*/
const academySubmitRoom = ROOM_IDS.academySubmit
const academySubmitMessages = [
  say(academySubmitRoom, '강다은', '제출물 목록 정리했습니다. 시연 영상은 3분 넘으면 잘립니다.', daysAgo(5, 19, 10)),
  say(academySubmitRoom, '임수연', '그럼 화면 녹화는 두 화면만 담죠.', daysAgo(5, 19, 22)),
  say(
    academySubmitRoom,
    '강다은',
    '저장소를 공개로 두기 전에 서버 정보가 든 파일이 없는지 확인하는 항목을 넣었습니다. 지난번에 설정 파일이 그대로 올라간 적이 있어서요.',
    daysAgo(2, 20, 15),
    { is_important: true },
  ),
  say(academySubmitRoom, '유수인', '포스터는 제가 목요일까지 올리겠습니다.', daysAgo(2, 20, 30), { read_count: 2 }),
  say(academySubmitRoom, '강다은', '체크리스트 공유합니다. 각자 맡은 줄에 이름 적어 주세요.', daysAgo(1, 22, 5), {
    attachments: [
      attachment('academy-checklist.pdf', { sizeBytes: 118400, mimeType: 'application/pdf' }),
    ],
  }),
  say(
    academySubmitRoom,
    '서재민',
    '체크리스트에 담당자 칸이 비어 있는 줄이 셋 있습니다. 비워 두면 아무도 안 합니다.',
    minutesAgo(70),
    { is_important: true },
  ),
  say(academySubmitRoom, '강다은', '오늘 안에 채우겠습니다.', minutesAgo(58)),
]

// ─────────────────────────────────────────── 팀 방
const teamRoom = ROOM_IDS.team
const teamMessages = [
  say(teamRoom, '서재민', '이번 주 일정 공유합니다. 수요일 중간 점검, 금요일 데모입니다.', daysAgo(5, 9, 0)),
  say(teamRoom, '강다은', 'Discord 서버 공지에 올려 두었습니다.', daysAgo(5, 9, 12)),
  say(teamRoom, '최비성', '서버 배포는 목요일 밤에 한 번 더 하겠습니다.', daysAgo(5, 9, 30)),
  say(teamRoom, '유수인', '발표 자료 초안은 제가 목요일까지 올릴게요.', daysAgo(5, 10, 0), { read_count: 4 }),
  say(
    teamRoom,
    '서재민',
    '중간 점검 결과 정리합니다. 심사에서 나온 지적은 두 가지였습니다. 하나는 "대리인이 사람 대신 결정하는 것처럼 보인다" 는 것이고, 다른 하나는 백엔드에서 신경 쓴 부분이 화면에 안 드러나서 채팅창 하나로 보인다는 것이었습니다. 앞의 것은 유보 화면을 더 앞에 내세우는 것으로, 뒤의 것은 플로우 화면에서 근거 링크를 노출하는 것으로 대응하기로 했습니다. 둘 다 이번 주 안에 화면에 반영돼야 합니다.',
    daysAgo(3, 18, 40),
    { is_important: true },
  ),
  say(teamRoom, '임수연', '유보 화면 시안 필요하면 말씀해 주세요.', daysAgo(3, 18, 55)),
  say(teamRoom, '강다은', '봇은 회의 시작·종료 알림까지 붙었습니다.', daysAgo(1, 11, 5)),
  say(teamRoom, '서재민', '오늘 4시 리허설 잊지 마세요.', minutesAgo(300)),
]

// ─────────────────────────────────────────── 1:1 방
const daeunRoom = ROOM_IDS.daeun
const daeunMessages = [
  say(daeunRoom, '강다은', '수인님, 공지 문구 한 번 봐 주실 수 있나요?', daysAgo(2, 21, 10)),
  say(
    daeunRoom,
    '강다은',
    '[정기 회의 안내]\n오늘 15:00 에 정기 회의가 시작됩니다.\n안건: 로그인 오류 문구 / 회의 상세 반응형 / 공지 템플릿\n참석이 어려우신 분은 대리인에 사전 지시를 남겨 주세요.\n회의 시작 시각은 15:00 입니다.',
    daysAgo(2, 21, 11),
  ),
  say(
    daeunRoom,
    '유수인',
    '마지막 줄이 위에 있는 시각이랑 겹쳐요. 아래 줄은 빼는 게 좋겠습니다.',
    daysAgo(2, 21, 40),
    { read_count: 1 },
  ),
  say(daeunRoom, '강다은', '고칠게요.', daysAgo(2, 21, 42)),
  say(daeunRoom, '강다은', '고쳤습니다. 다시 봐 주세요.', daysAgo(1, 9, 12)),
  /*
    자리를 비운 사이 내 대리인이 대신 답한 자리.

    **이 서비스가 파는 장면이 정확히 이것**인데 목에 한 줄도 없었다. 대리인은
    남의 방(`동료 대리인`)에서만 말했고, 내 대리인이 내 대신 팀원에게 답한
    기록은 화면 어디에도 없었다 — `자리 비운 사이` 목록을 만들어도 늘 비어
    있게 된다.

    `answered_while_away` 로 표시한다. 대리인이 한 말이라고 다 부재 중 응답은
    아니다(내가 옆에서 시켜서 한 것도 있다). 목록에 담을지 가르는 것은 서버가
    아는 사실이라 필드로 온다.
  */
  bot(
    daeunRoom,
    '유수인',
    '수인님이 자리를 비우셔서 제가 대신 답합니다. 공지 문구는 지난주에 정한 템플릿을 그대로 쓰기로 되어 있어, 마지막 줄만 빼면 확정입니다. 최종 확인은 수인님이 돌아오시면 남기겠습니다.',
    daysAgo(1, 9, 30),
    { answered_while_away: true },
  ),
  say(daeunRoom, '강다은', '네 알겠습니다. 그럼 그대로 올릴게요.', daysAgo(1, 9, 34)),
  // 지운 메시지. 자리는 남고 본문만 빈다 — 사이드바 미리보기도 `삭제된 메시지입니다` 가 된다.
  say(daeunRoom, '유수인', '', minutesAgo(320), { deleted_at: minutesAgo(319), read_count: 1 }),
]

const suyeonRoom = ROOM_IDS.suyeon
const suyeonMessages = [
  say(suyeonRoom, '임수연', '수인님 오늘 회의 들어오세요?', daysAgo(3, 11, 0)),
  say(suyeonRoom, '유수인', '오늘은 학교 발표라 못 들어가요. 대리인 보냅니다.', daysAgo(3, 11, 2), { read_count: 1 }),
  say(suyeonRoom, '임수연', '넵. 디자인 관련해서 결정 나오면 제가 따로 정리해서 보낼게요.', daysAgo(3, 11, 3)),
  say(suyeonRoom, '유수인', '감사합니다 🙏', daysAgo(3, 11, 4), { read_count: 1 }),
  say(
    suyeonRoom,
    '임수연',
    '어제 회의에서 디자인 쪽으로 나온 것만 모았습니다.\n1. 프로필 이미지 원형 통일 — 확정\n2. 회의 상세 기준폭 1120 으로 — 확정\n3. 우측 패널 최소 너비 — 미정. 수인님이 시안으로 정해 주셔야 합니다.\n4. 유보 상태를 보여주는 카드 — 새로 필요합니다. 대리인이 "본인 확인 필요" 로 남긴 것을 그대로 보여줄 자리가 지금 화면에 없습니다.\n4번이 제일 급합니다. 심사에서 지적받은 부분이라서요.',
    daysAgo(1, 16, 20),
    { is_important: true },
  ),
  say(suyeonRoom, '유수인', '정리 고맙습니다. 3번이랑 4번은 오늘 안에 볼게요.', daysAgo(1, 16, 45), { read_count: 1 }),
  say(suyeonRoom, '임수연', '혹시 원형 프로필 시안 언제쯤 올라올까요? 리허설 전에 붙여 두고 싶어서요.', minutesAgo(240)),
  say(suyeonRoom, '유수인', '2시까지 올릴게요.', minutesAgo(230), { read_count: 1 }),
  say(suyeonRoom, '임수연', '넵', minutesAgo(30)),
  say(suyeonRoom, '임수연', '그리고 아까 말한 색 이름 표는 정리해서 라운지에 올려 뒀습니다.', minutesAgo(28)),
  say(suyeonRoom, '임수연', '수인님, 원형 프로필 시안 지금 올라왔나요? 리허설 10분 뒤예요.', minutesAgo(24)),
  bot(
    suyeonRoom,
    '유수인',
    '수인님은 지금 자리를 비우셨습니다. 원형 프로필 시안은 오늘 14:00 까지 올리기로 하신 것이 기록에 있고, 아직 올라오지 않았습니다. 리허설에는 직전 버전으로 진행해 주시면, 돌아오시는 대로 바로 전달하겠습니다.',
    minutesAgo(23),
    { answered_while_away: true },
  ),
  say(suyeonRoom, '임수연', '알겠습니다. 직전 버전으로 갈게요.', minutesAgo(22)),
]

const biseongRoom = ROOM_IDS.biseong
const biseongMessages = [
  say(biseongRoom, '유수인', '비성님, 아바타 이미지 경로 규칙이 어떻게 되나요?', daysAgo(6, 15, 0), { read_count: 1 }),
  say(
    biseongRoom,
    '최비성',
    '지금은 `/flowchart/profile-N.jpeg` 로 박혀 있습니다. 저장소 붙기 전까지는 그대로 갑니다.',
    daysAgo(6, 15, 20),
  ),
  say(biseongRoom, '유수인', '네 알겠습니다.', daysAgo(6, 15, 22), { read_count: 1 }),
  say(
    biseongRoom,
    '최비성',
    '아바타 없는 계정은 빈 문자열로 내려갑니다. 화면에서 기본 아이콘 처리 부탁드려요.',
    minutesAgo(400),
  ),
  bot(
    biseongRoom,
    '유수인',
    '수인님 대신 확인했습니다. 기본 아이콘 처리는 이미 들어가 있고(사진 없는 계정은 Bordo 아이콘), 경로 규칙이 바뀌면 화면 쪽은 손댈 곳이 없습니다. 이 내용은 수인님께 남겨 두겠습니다.',
    minutesAgo(395),
    { answered_while_away: true },
  ),
]

/*
  빈 방 둘.

  하나는 아직 말을 안 건 1:1(서재민), 하나는 만들어만 둔 프로젝트 방(부스 배치)
  이다. **목록 전체를 비우지는 않되 빈 방은 남겨 둔다** — `아직 나눈 이야기가
  없습니다` 를 그리는 자리가 실제로 어떻게 보이는지 확인해야 한다.
*/
const emptyMessages = []

/** 방 id → 메시지 목록 응답. `GET /chat/rooms/{id}/messages`. */
export const roomMessages = {
  [ROOM_IDS.agent]: page(agentMessages),
  [ROOM_IDS.lounge]: page(loungeMessages),
  [ROOM_IDS.design]: page(designMessages),
  [ROOM_IDS.rehearsal]: page(rehearsalMessages),
  [ROOM_IDS.slides]: page(slidesMessages),
  [ROOM_IDS.academy]: page(emptyMessages),
  [ROOM_IDS.academySubmit]: page(academySubmitMessages),
  [ROOM_IDS.team]: page(teamMessages),
  [ROOM_IDS.daeun]: page(daeunMessages),
  [ROOM_IDS.suyeon]: page(suyeonMessages),
  [ROOM_IDS.biseong]: page(biseongMessages),
  [ROOM_IDS.jaemin]: page(emptyMessages),
  [ROOM_IDS.biseongAgent]: page(peerMessages),
}

// ─────────────────────────────────────────── 방

/**
 * 방 하나. 미리보기 · 중요 여부는 메시지에서 계산한다.
 *
 * 팀은 **참·거짓이 아니라 팀 객체**로 받는다. 팀이 하나뿐일 때는 `team: true`
 * 로 두고 `TEAM` 을 갖다 써도 됐지만, 팀이 둘이 되면 그 방식은 조용히 틀린다 —
 * 학술제 방에 해커톤 팀 이름이 붙는다. 프로젝트가 있으면 팀은 물어볼 것도 없이
 * 그 프로젝트의 팀이다.
 */
function buildRoom({ id, type, title, team = TEAM, project = null, members, unread = 0,
                    muted = false }) {
  const owner = project ? teamOf(project) : team
  const list = roomMessages[id].results
  const avatars = members
    .map((name) => person(name).avatar_url)
    .filter(Boolean)
    .slice(0, 4)

  return {
    id,
    type,
    title,
    /*
      참여자. **시간대까지 같이 준다.**

      방 머리에 각자의 그곳 시각을 띄우려면 필요하다. 화면이 사람 id 로
      팀 구성원 목록을 다시 뒤지게 두면, 팀에 안 매인 1:1 방에서는 뒤질
      목록조차 없다.

      `is_me` 는 서버가 정한다 — 1:1 방에서 "상대"가 누구인지는 보는 사람에
      따라 다르고, 그 판정을 화면이 하면 계정마다 다른 규칙이 생긴다.
    */
    members: members.map((name) => {
      const who = person(name)
      return {
        id: who.id,
        name: who.name,
        avatar_url: who.avatar_url,
        timezone: who.timezone,
        // 나라 이름은 서버가 완성해 준다 — 시간대 문자열에서 화면이 유추하면
        // 그 표를 화면마다 하나씩 들고 있게 된다.
        country: who.country,
        /*
          지금 자리에 있는지. 자리를 비운 사람에게 보낸 말은 **그 사람의 Bordo
          가 먼저 받는다** — 답이 늦는 것과, 사람이 아닌 대리인이 답하는 것은
          받는 쪽이 알아야 하는 다른 사실이다.
        */
        presence: who.presence ?? 'ACTIVE',
        agent_name: agentName(who.name),
        is_me: who.id === ME.id,
        is_agent: false,
      }
    }),
    team_id: owner ? owner.id : null,
    team_name: owner ? owner.name : '',
    project_id: project ? project.id : null,
    project_name: project ? project.name : '',
    // 서버가 완성해 주는 문자열. 화면이 팀·프로젝트 이름을 직접 이어 붙이면
    // 규칙이 두 군데로 갈린다.
    path_label: owner ? (project ? `${owner.name} - ${project.name}` : owner.name) : '',
    avatar_urls: avatars,
    last_message: toLastMessage(list),
    unread_count: unread,
    has_important: list.some((m) => m.is_important),
    /*
      알림을 꺼 둔 방인지. 서버가 `RoomSummarySerializer` 에서 주는 칸이다.

      **하나는 처음부터 꺼진 채로 둔다**(`muted: true`). 전부 켜져 있으면
      「이미 꺼진 방을 열었을 때 단추가 `알림 켜기` 로 뜨는가」 를 눌러 볼
      상황이 없다 — 화면의 한쪽 갈래가 한 번도 안 그려진다.
    */
    muted: Boolean(muted),
  }
}

const ALL = [
  // 대리인 방은 팀에도 프로젝트에도 안 매달린다. 나와 내 대리인 둘뿐이다.
  buildRoom({
    id: ROOM_IDS.agent,
    type: 'AI',
    title: agentName(ME.name),
    team: null,
    members: ['유수인'],
    unread: 0,
  }),
  buildRoom({
    id: ROOM_IDS.lounge,
    type: 'PROJECT',
    title: '결정 모드 라운지',
    project: PROJECTS.bordo,
    members: ['임수연', '최비성', '유수인', '서재민', '강다은'],
    unread: 5,
  }),
  buildRoom({
    id: ROOM_IDS.design,
    type: 'PROJECT',
    title: '디자인 시스템 정리',
    project: PROJECTS.bordo,
    members: ['유수인', '임수연', '최비성'],
    unread: 2,
    // 알림을 꺼 둔 채로 미읽음이 남아 있는 방. **끈 것과 다 읽은 것은 다른
    // 상태**인데, 둘이 같이 있는 경우가 하나도 없으면 그 구별이 화면에서
    // 한 번도 안 밟힌다.
    muted: true,
  }),
  buildRoom({
    id: ROOM_IDS.rehearsal,
    type: 'PROJECT',
    title: '데모 리허설',
    project: PROJECTS.demo,
    members: ['서재민', '임수연', '최비성', '유수인'],
    unread: 2,
  }),
  buildRoom({
    id: ROOM_IDS.slides,
    type: 'PROJECT',
    title: '발표 자료',
    project: PROJECTS.demo,
    members: ['유수인', '임수연', '서재민'],
    unread: 1,
  }),
  // 만들어만 두고 아직 말이 없는 방. `아직 나눈 이야기가 없습니다` 를 그리는
  // 자리가 실제로 어떻게 보이는지 확인해야 한다.
  buildRoom({
    id: ROOM_IDS.academy,
    type: 'PROJECT',
    title: '부스 배치',
    project: PROJECTS.academy,
    members: ['강다은', '유수인'],
    unread: 0,
  }),
  buildRoom({
    id: ROOM_IDS.academySubmit,
    type: 'PROJECT',
    title: '제출물 점검',
    project: PROJECTS.academy,
    members: ['강다은', '유수인', '임수연', '서재민'],
    unread: 3,
  }),
  buildRoom({
    id: ROOM_IDS.team,
    type: 'TEAM',
    title: TEAM.name,
    team: TEAM,
    members: ['서재민', '최비성', '임수연', '유수인', '강다은'],
    unread: 3,
  }),
  buildRoom({
    id: ROOM_IDS.suyeon,
    type: 'DIRECT',
    title: '임수연',
    members: ['임수연'],
    unread: 7,
  }),
  buildRoom({
    id: ROOM_IDS.biseongAgent,
    type: 'PEER_AGENT',
    title: agentName('최비성'),
    members: ['최비성'],
    unread: 4,
  }),
  buildRoom({
    id: ROOM_IDS.biseong,
    type: 'DIRECT',
    title: '최비성',
    members: ['최비성'],
    unread: 1,
  }),
  buildRoom({
    id: ROOM_IDS.daeun,
    type: 'DIRECT',
    title: '강다은',
    members: ['강다은'],
    unread: 0,
  }),
  buildRoom({
    id: ROOM_IDS.jaemin,
    type: 'DIRECT',
    title: '서재민',
    members: ['서재민'],
    unread: 0,
  }),
]

const byId = Object.fromEntries(ALL.map((room) => [room.id, room]))

/** 방 id → 방 하나. `GET /chat/rooms/{id}`. */
export const roomDetails = byId

/**
 * 방 목록. `GET /chat/rooms`.
 *
 * 최근에 말이 오간 순서로 준다. 빈 방은 뒤로 밀린다.
 */
export const chatRooms = {
  count: ALL.length,
  results: [...ALL].sort((a, b) => {
    const left = a.last_message?.sent_at ?? ''
    const right = b.last_message?.sent_at ?? ''
    return right.localeCompare(left)
  }),
}

/**
 * `GET /chat/away-handled` — 자리를 비운 사이 내 Bordo 가 대신 나눈 대화.
 *
 * ## 왜 「중요 채팅」 자리를 이것이 가져갔나
 *
 * 그 자리는 **내가 미리 별을 찍어 둔 것**만 모였다. 자리를 비우기 전에 무엇이
 * 중요해질지 알 수 있으면 애초에 자리를 안 비웠을 것이다. 이 서비스가 파는
 * 것은 "없는 동안에도 대화가 이어진다" 인데, 그 이어진 대화를 한 자리에서
 * 보는 곳이 화면에 없었다 — 방을 하나씩 열어 봐야 알 수 있었다.
 *
 * 방마다 **대리인이 대신 답한 횟수**와 마지막 응답을 같이 준다. 화면이 방
 * 메시지를 전부 받아 세게 두면, 목록 하나 그리려고 방 수만큼 요청이 나간다.
 */
export const awayHandled = (() => {
  const rows = ALL
    .map((room) => {
      const handled = (roomMessages[room.id]?.results ?? [])
        .filter((m) => m.answered_while_away && m.sender.id === AGENT_IDS[ME.name])
      if (handled.length === 0) {
        return null
      }
      const last = handled[handled.length - 1]
      return {
        room_id: room.id,
        title: room.title,
        path_label: room.path_label,
        avatar_urls: room.avatar_urls,
        // 상대가 누구였는지. 1:1 이면 한 사람, 단체방이면 물어본 사람들이다.
        handled_count: handled.length,
        last_reply: {
          id: last.id,
          preview: last.body.length > 60 ? `${last.body.slice(0, 60)}…` : last.body,
          sent_at: last.sent_at,
        },
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.last_reply.sent_at.localeCompare(a.last_reply.sent_at))

  return { count: rows.length, results: rows }
})()

// ─────────────────────────────────────────── 사이드바
/*
  미읽음 합계는 **상위 노드에 미리 들어 있어야 한다.** 사이드바가 접혀 있어도
  뱃지를 그려야 해서, 클라이언트가 트리를 순회해 더하지 않는다.

  팀 합계에는 팀 단체방(`group_chat_room_id`)의 미읽음도 들어간다. 그 방은
  트리 안에 방 객체로 없어서, 클라이언트가 뺄셈으로 알아낼 수 없는 값이다.
*/
const bordoRooms = [byId[ROOM_IDS.lounge], byId[ROOM_IDS.design]]
const demoRooms = [byId[ROOM_IDS.rehearsal], byId[ROOM_IDS.slides]]
const academyRooms = [byId[ROOM_IDS.academy], byId[ROOM_IDS.academySubmit]]
const directRooms = [
  byId[ROOM_IDS.suyeon],
  byId[ROOM_IDS.biseongAgent],
  byId[ROOM_IDS.biseong],
  byId[ROOM_IDS.daeun],
  byId[ROOM_IDS.jaemin],
]

function unreadOf(rooms) {
  return rooms.reduce((total, room) => total + room.unread_count, 0)
}

function markedIn(rooms) {
  return rooms.some((room) => room.has_important)
}

const bordoUnread = unreadOf(bordoRooms)
const demoUnread = unreadOf(demoRooms)
const academyUnread = unreadOf(academyRooms)
const teamGroupUnread = byId[ROOM_IDS.team].unread_count

/**
 * `GET /chat/sidebar`.
 *
 * ## 팀이 둘이다
 *
 * 학술제는 해커톤 팀이 하는 일이 아니다. 사람이 겹칠 뿐 심사도 일정도 다른
 * 곳에서 굴러가는데, 목에서는 학술제 프로젝트가 해커톤 팀 밑에 매달려 있어서
 * **채팅 목록만 보면 한 팀이 두 가지를 하는 것처럼** 읽혔다.
 *
 * 팀을 가르면서 해커톤 팀에는 프로젝트를 하나 더 둔다. 팀 아래 프로젝트가
 * 하나뿐이면 팀 칸과 프로젝트 칸이 겹쳐 한 줄로 읽혀서, 어느 칸이 무엇을
 * 감싸는지 화면에서 확인할 방법이 없다.
 */
export const chatSidebar = {
  my_agent_room: byId[ROOM_IDS.agent],
  // 상단 `중요 채팅`. 중요 메시지가 남아 있는 방만 올라온다.
  important_rooms: ALL.filter((room) => room.has_important),
  teams: [
    {
      team_id: TEAM.id,
      team_name: TEAM.name,
      group_chat_room_id: ROOM_IDS.team,
      unread_count: bordoUnread + demoUnread + teamGroupUnread,
      has_important: markedIn([...bordoRooms, ...demoRooms, byId[ROOM_IDS.team]]),
      projects: [
        {
          project_id: PROJECTS.bordo.id,
          project_name: PROJECTS.bordo.name,
          group_chat_room_id: ROOM_IDS.lounge,
          unread_count: bordoUnread,
          has_important: markedIn(bordoRooms),
          rooms: bordoRooms,
        },
        {
          project_id: PROJECTS.demo.id,
          project_name: PROJECTS.demo.name,
          group_chat_room_id: ROOM_IDS.rehearsal,
          unread_count: demoUnread,
          has_important: markedIn(demoRooms),
          rooms: demoRooms,
        },
      ],
    },
    {
      team_id: TEAM_ACADEMY.id,
      team_name: TEAM_ACADEMY.name,
      // 이 팀에는 단체방이 아직 없다. 서버는 첫 조회 때 만들어 주지만,
      // 안 만들어진 상태도 화면이 견뎌야 한다.
      group_chat_room_id: null,
      unread_count: academyUnread,
      has_important: markedIn(academyRooms),
      projects: [
        {
          project_id: PROJECTS.academy.id,
          project_name: PROJECTS.academy.name,
          group_chat_room_id: ROOM_IDS.academySubmit,
          unread_count: academyUnread,
          has_important: markedIn(academyRooms),
          rooms: academyRooms,
        },
      ],
    },
  ],
  direct_rooms: directRooms,
  total_unread:
    bordoUnread
    + demoUnread
    + academyUnread
    + teamGroupUnread
    + unreadOf(directRooms)
    + byId[ROOM_IDS.agent].unread_count,
}

// ─────────────────────────────────────────── 중요 채팅
/*
  확인(`important/confirm`)한 메시지는 **여기서만 빠진다.** 방 안에서는 중요
  표시가 그대로 남아 있는 것이 정상이다 — 둘을 같이 지우면 "확인" 과 "중요
  해제" 가 구별되지 않는다. 그래서 확인된 메시지를 한 건 남겨 두었다.
*/
const importantMessages = Object.values(roomMessages)
  .flatMap((response) => response.results)
  .filter((m) => m.is_important && !m.important_confirmed_at)
  .sort((a, b) => b.sent_at.localeCompare(a.sent_at))

/** `GET /chat/important`. */
export const chatImportant = {
  count: importantMessages.length,
  results: importantMessages.map((message) => ({ message, room: byId[message.room_id] })),
}

// ─────────────────────────────────────────── 새 채팅 후보
/**
 * `GET /chat/candidates`.
 *
 * `has_agent` 가 false 인 사람을 하나 섞어 둔다. `동료의 AI 대리인` 방은 대리인이
 * 있는 사람에게만 걸 수 있어서, 전원이 true 면 걸러내는 화면이 한 번도 안 밟힌다.
 */
function candidateMembers(names) {
  return PEOPLE
    .filter((who) => who.id !== ME.id && (!names || names.includes(who.name)))
    .map((who) => ({
      user_id: who.id,
      name: who.name,
      avatar_url: who.avatar_url,
      has_agent: who.name !== '강다은',
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
}

export const chatCandidates = {
  teams: [
    {
      team_id: TEAM.id,
      team_name: TEAM.name,
      members: candidateMembers(null),
    },
    /*
      두 팀에 같은 사람이 겹친다. 실제로도 그렇고, **겹칠 때 목록이 어떻게
      보이는지**는 팀이 하나면 확인할 수 없다.
    */
    {
      team_id: TEAM_ACADEMY.id,
      team_name: TEAM_ACADEMY.name,
      members: candidateMembers(['강다은', '임수연', '서재민']),
    },
  ],
}

// ─────────────────────────────────────────── 달력
/**
 * 방 id → 대화가 있던 날짜. `GET /chat/rooms/{id}/active-dates`.
 *
 * **날짜를 손으로 적지 않고 메시지에서 뽑는다.** 어긋나면 달력에서 파란 날을
 * 눌렀는데 빈 날이 나온다.
 *
 * `month` 는 이번 달로 두지만 `active_dates` 에는 지난달 날짜까지 담는다.
 * 가상 데이터는 달마다 다른 응답을 만들지 못하는데(방 id 로만 찾는다), 달력은
 * `active_dates` 를 집합으로 훑어 칠하므로 이렇게 두면 이전 달로 넘겨도 그 달에
 * 대화한 날이 제대로 켜진다.
 */
export const activeDates = Object.fromEntries(
  Object.entries(roomMessages).map(([roomId, response]) => {
    const dates = [...new Set(response.results.map((m) => localDate(m.sent_at)))].sort()
    const thisMonth = localMonth(new Date().toISOString())
    return [
      roomId,
      {
        month: thisMonth,
        active_dates: dates,
        has_prev_month: dates.some((date) => date.slice(0, 7) < thisMonth),
        has_next_month: false,
      },
    ]
  }),
)

// ─────────────────────────────────────────── 날짜별 요약
/*
  `status` 를 따로 두는 이유가 있다. **`요약 준비 중` 과 `요약할 게 없음` 은
  다르다.** 둘 다 빈 화면으로 두면 사용자는 기능이 고장 난 줄 안다. 그래서
  만들어진 날(`READY`)과 아직 안 만들어진 날(`PENDING`)을 섞어 둔다. 표에 없는
  날짜는 가상 데이터 라우터가 빈 요약으로 답한다.
*/
function countOn(roomId, iso) {
  const day = localDate(iso)
  return roomMessages[roomId].results.filter((m) => localDate(m.sent_at) === day).length
}

function summary(roomId, iso, { oneLine, todos = [], schedules = [], status = 'READY' }) {
  return [
    `${roomId}|${localDate(iso)}`,
    {
      date: localDate(iso),
      one_line: oneLine,
      my_todos: todos,
      schedules,
      generated_at: status === 'READY' ? iso : null,
      message_count: countOn(roomId, iso),
      status,
    },
  ]
}

/** `방id|날짜` → 그 날 요약. `GET /chat/rooms/{id}/daily-summary?date=`. */
export const dailySummaries = Object.fromEntries([
  summary(loungeRoom, daysAgo(3, 23, 0), {
    oneLine: '회의 안건 세 건을 나누고, 응답 필드 이름을 title · path_label · sender 로 정리하기로 했습니다.',
    todos: ['바뀐 필드 이름에 맞춰 시안 주석 고치기'],
    schedules: [{ at: daysAgo(3, 15, 0), title: '정기 회의', kind: 'MEETING' }],
  }),
  summary(loungeRoom, daysAgo(1, 23, 0), {
    oneLine: '어제 회의 결과 4건이 공유됐고 그중 3건이 확정됐습니다. 로그인 오류 문구는 다음 회의로 넘어갔습니다.',
    todos: [
      '프로필 이미지 원형 적용한 시안 다시 올리기',
      '우측 패널 최소 너비 정하기 (1280 이하에서 잘림)',
    ],
    schedules: [
      { at: daysAgo(1, 15, 0), title: '정기 회의', kind: 'MEETING' },
      { at: todayAt(16, 0), title: '데모 리허설', kind: 'MEETING' },
    ],
  }),
  /*
    아직 안 만들어진 요약. 대화는 있는데 요약이 없는 상태다.

    날짜를 `todayAt()` 으로 잡지 않고 **마지막 메시지에서 가져온다.** 새벽에
    열면 최근 대화가 어제로 넘어가는데, 그때 오늘 날짜로 키를 잡아 두면 아무도
    못 여는 요약이 되고 정작 대화가 있는 날은 요약이 비어 보인다.
  */
  summary(loungeRoom, loungeMessages[loungeMessages.length - 1].sent_at, {
    oneLine: '',
    status: 'PENDING',
  }),
  summary(teamRoom, daysAgo(3, 23, 0), {
    oneLine: '중간 점검 지적 두 가지 — 대리인이 대신 결정하는 것처럼 보인다, 화면에 차별점이 안 드러난다.',
    todos: ['유보 상태를 보여주는 카드 시안 만들기'],
    schedules: [{ at: daysAgo(3, 14, 0), title: '중간 점검', kind: 'MEETING' }],
  }),
  summary(suyeonRoom, daysAgo(1, 23, 0), {
    oneLine: '임수연 님이 회의에서 나온 디자인 결정 4건을 정리해 보냈습니다. 3 · 4번은 제가 정해야 합니다.',
    todos: ['우측 패널 최소 너비 확정', '유보 카드 시안 그리기'],
  }),
  summary(designRoom, daysAgo(4, 23, 0), {
    oneLine: '토큰 문서의 한글 이름과 코드 변수명이 달라서, 문서에 변수명을 같이 적기로 했습니다.',
    // 할 일이 없는 날. 요약은 있는데 목록만 비는 모양을 한 번 만들어 둔다.
    todos: [],
  }),
  summary(agentRoom, daysAgo(1, 23, 0), {
    oneLine: '대리인이 어제 회의 결정 3건을 정리했고, 색 토큰 이름 건은 근거가 갈려 유보했습니다.',
    todos: ['임수연 님께 색 토큰 발언 의도 확인'],
  }),
])
