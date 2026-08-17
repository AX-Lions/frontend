/**
 * 조회 결과를 화면 밖에 담아 둔다.
 *
 * ## 왜 필요한가
 *
 * 화면을 옮길 때마다 컴포넌트가 죽고 상태가 사라져서, **홈 → 채팅 → 홈** 이면
 * `/home` 을 두 번 읽는다. 서버가 40ms 에 답해도 사용자에게는 화면이 빈 채로
 * 한 번 더 깜빡이는 것으로 보인다. 첫 그림은 20ms 안에 나오는데 **기다리는 것은
 * 전부 데이터다.**
 *
 * ## stale-while-revalidate
 *
 * 담아 둔 것이 있으면 **먼저 그리고**, 뒤에서 다시 읽어 조용히 갈아 끼운다.
 * 빈 화면 → 스피너 → 내용 대신 이전 내용 → 새 내용이 된다.
 *
 * 낡은 것을 보여 주는 위험보다 빈 화면이 더 나쁘다고 봤다. 이 서비스가 묻는
 * 질문이 "내가 없는 동안 무슨 일이 있었지" 인데, 그 답이 매번 빈 화면에서
 * 시작하면 화면이 느린 것이 아니라 **기록이 없는 것처럼 읽힌다.**
 *
 * 다만 오래된 것은 안 쓴다(`MAX_AGE`). 어제 것을 오늘 그대로 보여 주면 그건
 * 캐시가 아니라 거짓말이다.
 *
 * ## 같은 요청을 겹쳐 보내지 않는다
 *
 * 사이드바와 본문이 같은 `/home` 을 부르면 두 번 나간다. 진행 중인 약속을
 * 나눠 쓰면 한 번으로 끝난다 — **한 화면에서 같은 것을 두 번 묻지 않는다.**
 *
 * ## 라이브러리를 안 쓴 이유
 *
 * react-query 를 넣으면 이 파일보다 훨씬 많은 것이 따라온다(무효화 정책,
 * devtools, 구독 모델). 지금 필요한 것은 **담기 · 겹침 막기 · 지우기** 셋뿐이고,
 * 그 셋은 여기 다 있다. 서버 상태가 복잡해지면 그때 갈아 끼운다 — 화면은
 * `useResource` 만 보므로 이 파일만 바뀐다.
 */

//: 담아 둔 값을 쓸 수 있는 시간. 넘으면 없는 것으로 친다.
const MAX_AGE = 30_000

const store = new Map()
const inflight = new Map()

/** 담아 둔 값. 없거나 오래됐으면 `undefined`. */
export function readCache(key) {
  if (!key) {
    return undefined
  }
  const hit = store.get(key)
  if (!hit) {
    return undefined
  }
  if (Date.now() - hit.at > MAX_AGE) {
    store.delete(key)
    return undefined
  }
  return hit.data
}

export function writeCache(key, data) {
  if (key) {
    store.set(key, { data, at: Date.now() })
  }
}

/**
 * 같은 키로 진행 중인 요청이 있으면 그것을 나눠 쓴다.
 *
 * **`signal` 을 공유 요청에 넘기지 않는다.** 넘기면 먼저 떠난 화면이 취소할 때
 * 아직 기다리는 쪽까지 같이 끊긴다. 취소는 각 화면이 `alive` 로 자기 것만
 * 막는다(`useResource`).
 */
export function dedupe(key, run) {
  if (!key) {
    return run()
  }
  const running = inflight.get(key)
  if (running) {
    return running
  }
  const promise = run()
    .then((data) => {
      writeCache(key, data)
      return data
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, promise)
  return promise
}

/**
 * 담아 둔 것을 버린다.
 *
 * 무언가를 바꾼 뒤에 부른다. 인자가 없으면 전부 — 로그아웃 때 쓴다.
 * 남겨 두면 **다음 사람 화면에 이전 사람의 회의 제목이 비쳐 보인다.**
 */
export function invalidate(prefix) {
  if (prefix === undefined) {
    store.clear()
    inflight.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key)
    }
  }
}

/**
 * 미리 읽어 둔다.
 *
 * 링크에 마우스를 올렸을 때처럼 **누르기 전에** 부른다. 결과는 캐시에만 담고
 * 아무에게도 알리지 않는다 — 실패해도 조용히 넘어간다. 미리 읽기가 실패했다고
 * 화면에 오류를 띄우면 사용자는 자기가 하지도 않은 일의 실패를 본다.
 */
export function prefetch(key, run) {
  if (!key || store.has(key) || inflight.has(key)) {
    return
  }
  dedupe(key, run).catch(() => {})
}
