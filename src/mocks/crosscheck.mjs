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
import { flowEdges, meetingFlows, projectFlows } from './data/flow.js'
import { activeDates, chatSidebar, roomDetails, roomMessages } from './data/chat.js'
import { agentConversations, conversationMessages } from './data/agent.js'
import { PEOPLE } from './data/people.js'

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
  const days = new Set(msgs.map((m) => (m.sent_at ?? '').slice(0, 10)))
  for (const d of ad.active_dates ?? []) {
    ok(days.has(d), `방 ${rid.slice(0, 8)} 의 활동일 ${d} 에 메시지가 없다`)
  }
}

// 8. 대화 → 메시지
for (const c of agentConversations.results ?? []) {
  ok(conversationMessages[c.id], `대화 "${c.title}" 의 메시지가 없다`)
}

const msgCount = Object.values(roomMessages).reduce((s, r) => s + (r.results?.length ?? 0), 0)
console.log('== 규모 ==')
console.log(`  최근회의 ${(home.recent_meetings ?? []).length} · 오늘일정 ${(home.today_schedule ?? []).length} · 회의상세 ${Object.keys(meetings).length}`)
console.log(`  플로우 ${allFlows.length} · 엣지상세 ${Object.keys(flowEdges).length} (화살표가 참조 ${edgeTotal})`)
console.log(`  브리핑 ${Object.keys(briefings).length} · 채팅방 ${uniq.length} · 메시지 ${msgCount}`)
console.log(`  대리인 대화 ${(agentConversations.results ?? []).length}`)
console.log(`\n== 어긋남 ${bad.length} 건 ==`)
bad.slice(0, 25).forEach((b) => console.log('  ·', b))
if (bad.length > 25) console.log(`  ... 외 ${bad.length - 25} 건`)
