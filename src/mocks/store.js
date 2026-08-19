/**
 * 이번 방문 동안 바뀐 것.
 *
 * ## 흉내만 내면 안 되는 이유
 *
 * 처음에는 쓰기를 **흉내만** 냈다 — 보낸 것을 그대로 돌려주고 데이터는 안
 * 고쳤다. 화면이 낙관적으로 먼저 그리니 눌리는 느낌은 났다.
 *
 * 그게 틀렸다. 화면들은 보낸 뒤 **다시 읽는다.** 대리인 대화는 3초마다 목록을
 * 통째로 갈아 끼우고, 홈은 저장 뒤 `/home` 을 다시 읽는다. 그러면 방금 보낸
 * 말이 3초 뒤에 조용히 사라지고, 저장한 설정이 되돌아간다. **오류도 안내도
 * 없어서 사용자는 자기 말이 안 갔는지 화면이 고장 났는지 구별하지 못한다.**
 *
 * 이 저장소에서 계속 나오는 실패 모양이다 — 요청은 나가고 응답도 오는데
 * 받는 쪽이 자기 것으로 세지 않는 것.
 *
 * ## 메모리에만 둔다
 *
 * 새로고침하면 처음으로 돌아간다. `localStorage` 에 쌓으면 가짜가 진짜처럼
 * 눌러앉아, 나중에 "왜 이 데이터가 계속 보이지" 를 디버깅하게 된다.
 * **가짜는 오래 붙잡지 않는다.**
 */

/** 대화 id · 방 id → 이번에 보낸 메시지들. */
const appended = new Map()

/** 부분 갱신을 덮어쓰는 자리. `agent-settings` 처럼 통째로 다시 읽는 것들. */
const patched = new Map()

export function appendTo(key, message) {
  if (!appended.has(key)) {
    appended.set(key, [])
  }
  appended.get(key).push(message)
  return message
}

/** 미리 구운 목록 뒤에 이번에 보낸 것을 잇는다. */
export function withAppended(key, results) {
  const extra = appended.get(key)
  return extra && extra.length ? [...results, ...extra] : results
}

export function patch(key, values) {
  patched.set(key, { ...(patched.get(key) ?? {}), ...values })
  return patched.get(key)
}

export function patchedOf(key) {
  return patched.get(key) ?? null
}

export function resetStore() {
  appended.clear()
  patched.clear()
}
