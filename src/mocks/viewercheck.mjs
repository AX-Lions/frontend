/*
  계정별 관점이 회의 데이터와 어긋나지 않는지 본다.

      node src/mocks/viewercheck.mjs

  ## 왜 필요한가

  브리핑은 **빠진 회의에만** 생긴다. 사람별 파일에 그것을 손으로 적는데,
  회의의 참석 상태는 `meetings.js` 에 따로 있다. 두 곳이 어긋나면

    · 참석한 회의에 브리핑이 뜬다 — 없었던 일을 "당신이 없는 동안" 이라고 말한다
    · 빠진 회의에 브리핑이 없다 — 이 서비스의 핵심 화면이 그 사람에게만 비어 있다

  둘 다 화면에서는 그냥 "브리핑이 있다/없다" 로만 보여서, 데이터가 틀린 것인지
  화면이 틀린 것인지 구별할 수가 없다.

  대리인 방 id 가 겹치는 것도 본다. 겹치면 계정을 바꿔도 남의 대화가 열린다.
*/
import { meetings } from './data/meetings.js'
import { PEOPLE } from './data/people.js'
import { VIEWERS } from './data/viewers.js'

const MISSED = new Set(['ABSENT', 'DELEGATED'])
const HELD = new Set(['ENDED', 'ACTIVE'])
const bad = []
const ok = (cond, msg) => { if (!cond) bad.push(msg) }

const rooms = new Map()

for (const who of PEOPLE) {
  const v = VIEWERS[who.email]
  if (!v) {
    bad.push(`${who.name}: 관점 데이터가 없다`)
    continue
  }

  // 대리인 방이 사람마다 달라야 한다
  ok(Boolean(v.agentRoomId), `${who.name}: 대리인 방 id 가 없다`)
  if (v.agentRoomId) {
    const already = rooms.get(v.agentRoomId)
    ok(!already, `${who.name} 과 ${already} 의 대리인 방 id 가 같다 — 남의 대화가 열린다`)
    rooms.set(v.agentRoomId, who.name)
  }

  // 빠진 회의 ↔ 브리핑
  // **진행 중인 회의도 센다.** 자리를 비운 사람이 지금까지 무슨 이야기가
  // 오갔는지 보는 것이 이 화면의 쓸모다 — 회의가 끝나야만 볼 수 있으면 늦다.
  const missedIds = Object.entries(meetings)
    .filter(([, m]) => HELD.has(m.status) && (m.participants ?? []).some(
      (p) => p.user_id === who.id && MISSED.has(p.attendance)))
    .map(([id]) => id)

  const written = Object.keys(v.briefings ?? {})
  for (const id of written) {
    ok(missedIds.includes(id),
      `${who.name}: 참석한(또는 아직 안 열린) 회의 "${meetings[id]?.title ?? id}" 에 브리핑이 있다`)
  }
  for (const id of missedIds) {
    ok(written.includes(id),
      `${who.name}: 빠진 회의 "${meetings[id]?.title}" 의 브리핑이 없다`)
  }

  // 대화 ↔ 메시지
  for (const c of v.conversations ?? []) {
    ok(v.conversationMessages?.[c.id], `${who.name}: 대화 "${c.title}" 의 메시지가 없다`)
  }
}

console.log('== 사람별 ==')
for (const who of PEOPLE) {
  const v = VIEWERS[who.email] ?? {}
  const missed = Object.entries(meetings).filter(([, m]) => HELD.has(m.status)
    && (m.participants ?? []).some((p) => p.user_id === who.id && MISSED.has(p.attendance))).length
  console.log(`  ${who.name}  빠진 회의 ${missed} · 브리핑 ${Object.keys(v.briefings ?? {}).length}`
    + ` · 평소지시 ${(v.prompts ?? []).length} · 대화 ${(v.conversations ?? []).length}`)
}
console.log(`\n== 어긋남 ${bad.length} 건 ==`)
bad.forEach((b) => console.log('  ·', b))
