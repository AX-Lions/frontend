/*
  가상 데이터가 서로 어긋나지 않는지 본다.

      node src/mocks/crosscheck.mjs

  ## 왜 필요한가

  파일이 도메인별로 갈려 있어서 **한쪽만 고치면 조용히 어긋난다.** 화살표는
  엣지 5개를 가리키는데 상세는 4개만 있거나, 홈 카드가 없는 회의를 가리키거나,
  안건이 그 판에 없는 화살표를 가리키는 식이다. 전부 화면에서는 "눌러도 아무
  일이 없다" 로만 보여서, 가짜 데이터 문제인지 화면 버그인지 구별이 안 된다.

  실제로 처음 만들었을 때 이런 어긋남이 8건 있었다.
*/
import { home } from './data/home.js'
import {
  briefings, meetingIndexes, meetings, summaryTables, workIndexes,
} from './data/meetings.js'
import {
  flowEdges, meetingFlows, meetingTimelines, projectFlows, projectTimelines,
} from './data/flow.js'
import { preps } from './data/prep.js'
import { activeDates, chatSidebar, roomDetails, roomMessages } from './data/chat.js'
import { agentConversations, conversationMessages } from './data/agent.js'
import { PEOPLE } from './data/people.js'

/** 화면과 같은 방식으로 날짜를 자른다 (`data/chat.js` 의 것과 같다). */
function localDate(iso) {
  const at = new Date(iso)
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
    + `-${String(at.getDate()).padStart(2, '0')}`
}

const bad = []
const ok = (cond, msg) => { if (!cond) bad.push(msg) }

// 1. 홈이 가리키는 회의가 회의 표에 있는가
for (const m of home.recent_meetings ?? []) {
  ok(meetings[m.meeting_id], `홈 최근회의 "${m.title}" 의 회의 상세가 없다`)
}
for (const s of home.today_schedule ?? []) {
  if (s.meeting_id) ok(meetings[s.meeting_id], `오늘 일정 "${s.title}" 의 회의 상세가 없다`)
}
const rs = home.recent_meeting_summary
if (rs?.meeting_id) ok(meetings[rs.meeting_id], '최근 회의 요약이 가리키는 회의가 없다')

// 2. 회의마다 딸린 것이 다 있는가
// **아직 안 열린 회의는 판이 없는 것이 맞다.** 오간 말이 없으니 그릴 것도 없고,
// 화면은 그때 `이 회의에서 오간 내용이 없습니다` 를 그린다. 그 상태도 봐야 하는
// 화면이라 억지로 채우지 않는다.
const HELD = new Set(['ENDED', 'ACTIVE'])
for (const id of Object.keys(meetings)) {
  const { title, status } = meetings[id]
  if (!HELD.has(status)) continue
  ok(meetingFlows[id], `회의 "${title}" 의 플로우가 없다`)
  ok(summaryTables[id], `회의 "${title}" 의 요약표가 없다`)
  ok(meetingIndexes[id], `회의 "${title}" 의 인덱스가 없다`)
}

// 3. 화살표가 가리키는 엣지 상세가 있는가 — 없으면 뱃지를 눌러도 빈 패널
let edgeTotal = 0
let edgeMissing = 0
const allFlows = [...Object.entries(meetingFlows), ...Object.entries(projectFlows)]
for (const [scope, flow] of allFlows) {
  for (const a of flow.arrows ?? []) {
    for (const c of a.counts ?? []) {
      const list = c.edge_ids ?? []
      for (const e of list) {
        edgeTotal += 1
        if (!flowEdges[e]) {
          edgeMissing += 1
          if (edgeMissing <= 6) bad.push(`엣지 상세 없음: ${e} (${scope.slice(0, 8)} / ${c.label})`)
        }
      }
      ok(c.count === list.length,
        `${scope.slice(0, 8)} ${a.direction_label} ${c.label}: count=${c.count} 인데 edge_ids=${list.length}`)
    }
  }
}

// 4. 노드의 user_id 가 실존 인물인가
const ids = new Set(PEOPLE.map((p) => p.id))
for (const [scope, flow] of allFlows) {
  for (const n of flow.nodes ?? []) {
    if (n.user_id) ok(ids.has(n.user_id), `${scope.slice(0, 8)} 노드 "${n.name}" 의 user_id 가 people 에 없다`)
  }
}

// 5-0. **회의 안건이 가리키는 화살표가 그 회의 판에 실제로 있는가.**
// 어긋나면 안건을 눌러도 강조될 것이 없어 목록이 장식처럼 보인다.
for (const [mid, idx] of Object.entries(meetingIndexes)) {
  const onBoard = new Set(
    (meetingFlows[mid]?.arrows ?? []).flatMap((a) => (a.counts ?? []).flatMap((c) => c.edge_ids ?? [])),
  )
  for (const r of idx.results ?? []) {
    for (const e of r.related_edge_ids ?? []) {
      ok(onBoard.has(e), `안건 "${r.label}" 이 가리키는 ${e} 가 그 회의 판에 없다`)
    }
  }
}

// 5. 작업 인덱스가 가리키는 엣지
for (const idx of Object.values(workIndexes)) {
  for (const r of idx.results ?? []) {
    for (const e of r.related_edge_ids ?? []) {
      ok(flowEdges[e], `작업 인덱스 "${r.title ?? r.label}" 의 엣지 ${e} 가 없다`)
    }
  }
}

// 6. 채팅방 상세·메시지
const rooms = []
const walk = (n) => {
  if (Array.isArray(n)) { n.forEach(walk); return }
  if (n && typeof n === 'object') {
    if (n.id && n.type) rooms.push(n)
    Object.values(n).forEach(walk)
  }
}
walk(chatSidebar)
const uniq = [...new Map(rooms.map((r) => [r.id, r])).values()]
for (const r of uniq) {
  ok(roomDetails[r.id], `방 "${r.title}" 상세가 없다`)
  ok(roomMessages[r.id], `방 "${r.title}" 메시지가 없다`)
}
ok(chatSidebar.my_agent_room?.id === home.shortcuts?.agent_room_id,
  `대리인 방 id 불일치: 사이드바=${chatSidebar.my_agent_room?.id} 홈=${home.shortcuts?.agent_room_id}`)

// 7. 활동일에 실제 메시지가 있는가 — 어긋나면 구분선을 눌러도 빈 날
for (const [rid, ad] of Object.entries(activeDates)) {
  const msgs = roomMessages[rid]?.results ?? []
  /*
    **로컬 날짜로 자른다.** 화면이 그렇게 자르기 때문이다.

    `slice(0, 10)` 은 UTC 날짜다. 한국에서 새벽 0~9시에 이 검사를 돌리면
    데이터는 `08-19` 로 묶어 뒀는데 검사는 `08-18` 로 읽어, 멀쩡한 데이터가
    어긋난 것으로 나온다. 실제로 새벽 1시에 돌렸다가 3건이 잡혔다.
  */
  const days = new Set(msgs.map((m) => localDate(m.sent_at)))
  for (const d of ad.active_dates ?? []) {
    ok(days.has(d), `방 ${rid.slice(0, 8)} 의 활동일 ${d} 에 메시지가 없다`)
  }
}

// 8. 대화 → 메시지
for (const c of agentConversations.results ?? []) {
  ok(conversationMessages[c.id], `대화 "${c.title}" 의 메시지가 없다`)
}

/*
  9. 준비 화면.

  **필드 이름이 서버와 어긋나면 여기서 잡는다.** 이 화면은 실서버 계약
  (`apps/meetings/prep.py`)을 그대로 흉내 내는 것이 목적이라, 가상 데이터에서만
  그려지고 실서버에서 빈 칸이 나오면 이 모드로 확인하는 의미가 없다.

  화면이 실제로 읽는 것만 본다 — 안 읽는 필드를 검사하면 계약이 바뀔 때마다
  화면과 무관한 곳에서 빨간불이 켜진다.
*/
const POINT_KEYS = ['id', 'order', 'label', 'title', 'options', 'rationale',
  'evidence', 'status', 'status_label', 'stance']
const SETUP_KEYS = ['mode', 'settings', 'standing_settings', 'standing_prompts',
  'extra_note', 'sources']

for (const [mid, prep] of Object.entries(preps)) {
  const tag = `준비화면 ${mid.slice(0, 8)}`
  ok(meetings[mid], `${tag} 이 가리키는 회의 상세가 없다`)

  // 헤더 문자열은 서버가 완성해 준다. 비어 있으면 화면 윗줄이 통째로 빈다.
  ok(prep.header?.when, `${tag} 에 회의 시각(when)이 없다`)
  ok(prep.header?.team_name, `${tag} 에 팀 이름이 없다`)
  ok(prep.header?.badge, `${tag} 에 뱃지 문구가 없다`)

  ok(prep.debate?.notice, `${tag} 에 논쟁점 안내 문구가 없다`)
  const points = prep.debate?.points ?? []
  ok(prep.debate?.count === points.length, `${tag} 의 논쟁점 개수가 목록과 다르다`)
  ok(prep.debate?.answered_count === points.filter((x) => x.stance).length,
    `${tag} 의 답변완료 개수가 실제 입장 수와 다르다`)

  points.forEach((point, i) => {
    for (const key of POINT_KEYS) {
      ok(point[key] !== undefined, `${tag} 논쟁점 ${i + 1} 에 ${key} 가 없다`)
    }
    ok(point.label === `논쟁점 ${String(point.order).padStart(2, '0')}`,
      `${tag} 논쟁점 ${i + 1} 의 라벨이 순번과 어긋난다`)
    ok(point.status === (point.stance ? 'ANSWERED' : 'NEEDED'),
      `${tag} 논쟁점 ${i + 1} 의 상태가 입장 유무와 어긋난다`)

    // 갈래·근거 카드의 필드 이름. 화면이 이 이름으로 읽는다.
    for (const option of point.options ?? []) {
      ok(option.key && option.title,
        `${tag} 논쟁점 ${i + 1} 의 갈래에 key/title 이 없다`)
    }
    for (const e of point.evidence ?? []) {
      ok(e.title && e.who && e.body,
        `${tag} 논쟁점 ${i + 1} 의 근거에 title/who/body 가 없다`)
      ok(!e.at || !Number.isNaN(new Date(e.at).getTime()),
        `${tag} 논쟁점 ${i + 1} 의 근거 시각을 읽을 수 없다`)
    }

    // 고른 갈래가 목록에 있어야 한다. 없으면 화면이 고른 것을 표시할 수 없다.
    const chosen = point.stance?.option_key
    if (chosen) {
      ok((point.options ?? []).some((o) => o.key === chosen),
        `${tag} 논쟁점 ${i + 1} 의 입장이 없는 갈래(${chosen})를 가리킨다`)
    }
  })

  for (const key of SETUP_KEYS) {
    ok(prep.agent_setup?.[key] !== undefined, `${tag} 활동 설정에 ${key} 가 없다`)
  }
  // 자료 범위는 `null`(고른 적 없음)과 `[]`(전부 끔)가 다른 뜻이다.
  const sources = prep.agent_setup?.sources
  ok(sources === null || Array.isArray(sources),
    `${tag} 의 자료 범위가 배열도 null 도 아니다`)
}

/*
  10. 시간순 인덱스.

  좌측 목록이면서 **재생 대본**이다. 재생 버튼은 판의 화살표를 전부 지우고 이
  목록 순서대로 하나씩 되살리므로, 목록과 판이 어긋나면 화면에서는 "재생했는데
  화살표 하나가 끝까지 안 나온다" 로만 보인다. 목록이 빠뜨린 것인지 재생이 중간에
  멈춘 것인지 구별할 방법이 없다.

  seq 와 정렬까지 보는 이유도 같다. 번호가 건너뛰거나 시각이 뒤집혀 있으면 좌측
  숫자는 멀쩡한데 되살아나는 순서만 이상해져서, 회의를 처음 보는 사람은 그것을
  "실제로 그런 순서로 오갔다" 로 읽는다.
*/
const allTimelines = { ...meetingTimelines, ...projectTimelines }
let timelineTotal = 0

for (const [scope, flow] of allFlows) {
  const tag = scope.slice(0, 8)
  const timeline = allTimelines[scope]
  if (!timeline) {
    bad.push(`판은 있는데 시간순 인덱스가 없다: ${tag}`)
    continue
  }

  const rows = timeline.results ?? []
  timelineTotal += rows.length
  ok(timeline.count === rows.length,
    `${tag} 시간순 인덱스: count=${timeline.count} 인데 목록은 ${rows.length}`)

  // 판의 화살표가 실제로 나르고 있는 엣지 전부.
  const onBoard = new Set(
    (flow.arrows ?? []).flatMap((a) => (a.counts ?? []).flatMap((c) => c.edge_ids ?? [])),
  )
  const listed = new Set(rows.map((r) => r.edge_id))

  rows.forEach((row, i) => {
    ok(row.seq === i + 1, `${tag} 시간순 ${i + 1}번째 줄의 seq 가 ${row.seq} 다 — 순번이 건너뛴다`)
    ok(flowEdges[row.edge_id], `${tag} 시간순 "${row.title}" 의 엣지 상세 ${row.edge_id} 가 없다`)
    // 5-0 과 같은 취지다. 판에 없는 엣지를 가리키면 눌러도 강조될 것이 없다.
    ok(onBoard.has(row.edge_id),
      `${tag} 시간순 "${row.title}" 이 가리키는 ${row.edge_id} 가 그 판에 없다`)
    for (const e of row.related_edge_ids ?? []) {
      ok(onBoard.has(e), `${tag} 시간순 "${row.title}" 의 강조 대상 ${e} 가 그 판에 없다`)
    }
    if (i > 0) {
      ok(Date.parse(rows[i - 1].occurred_at) <= Date.parse(row.occurred_at),
        `${tag} 시간순 ${i + 1}번째 줄이 앞줄보다 이르다 — 재생 순서가 뒤집힌다`)
    }
  })

  // 판에 있는데 목록에 없는 화살표. **재생해도 영영 안 나타난다.**
  for (const e of onBoard) {
    ok(listed.has(e), `${tag} 판의 ${e} 가 시간순 인덱스에 없다 — 재생해도 안 나타난다`)
  }
}

const msgCount = Object.values(roomMessages).reduce((s, r) => s + (r.results?.length ?? 0), 0)
console.log('== 규모 ==')
console.log(`  최근회의 ${(home.recent_meetings ?? []).length} · 오늘일정 ${(home.today_schedule ?? []).length} · 회의상세 ${Object.keys(meetings).length}`)
console.log(`  플로우 ${allFlows.length} · 엣지상세 ${Object.keys(flowEdges).length} (화살표가 참조 ${edgeTotal})`)
console.log(`  시간순 인덱스 ${Object.keys(allTimelines).length} · 줄 ${timelineTotal}`)
console.log(`  브리핑 ${Object.keys(briefings).length} · 채팅방 ${uniq.length} · 메시지 ${msgCount}`)
console.log(`  대리인 대화 ${(agentConversations.results ?? []).length}`)
const pointCount = Object.values(preps)
  .reduce((s, one) => s + (one.debate?.points?.length ?? 0), 0)
console.log(`  준비화면 ${Object.keys(preps).length} · 논쟁점 ${pointCount}`)
console.log(`\n== 어긋남 ${bad.length} 건 ==`)
bad.slice(0, 25).forEach((b) => console.log('  ·', b))
if (bad.length > 25) console.log(`  ... 외 ${bad.length - 25} 건`)
