import { useSyncExternalStore } from 'react'

/**
 * 화면에 걸린 시계를 1 분마다 같이 움직이는 자리.
 *
 * ## 왜 `setInterval(…, 60_000)` 이면 안 되나
 *
 * 채팅방 머리의 `참여자 그곳 시각` 이 그렇게 돌고 있었다. 세 가지가 틀렸다.
 *
 * ### 1. 분이 바뀌는 순간과 어긋난다
 *
 * 방을 17:00:59 에 열면 첫 갱신이 17:01:59 다. 그동안 화면은 `17:00` 인데
 * 실제로는 17:01 이라, **가장 크게 틀리는 순간이 방금 연 직후**다. 최대
 * 59 초를 틀린 시각으로 보게 되고, 이 숫자를 보고 "지금 말을 걸어도 되나" 를
 * 판단하므로 그 59 초가 그냥 오차가 아니다.
 *
 * 그래서 **다음 분 경계까지만** 기다렸다가, 그 뒤로 1 분씩 간다.
 *
 * ### 2. 탭이 뒤로 가면 멈춘다
 *
 * 브라우저는 안 보이는 탭의 타이머를 늦추고(1 분 이상), 노트북을 덮으면
 * 아예 안 돈다. 다시 돌아왔을 때 화면에는 **자리를 뜨기 전 시각**이 그대로
 * 있다 — 시계가 멈춘 줄도 모르고 읽게 되는 것이 제일 나쁘다.
 *
 * `visibilitychange` · `focus` 에서 곧바로 한 번 맞추고 다시 건다.
 *
 * ### 3. 시계마다 타이머가 하나씩 생긴다
 *
 * 지금은 채팅방 하나뿐이지만 목록·회의 카드에도 같은 시각이 붙을 자리다.
 * 각자 타이머를 돌리면 **같은 분인데 화면마다 다른 초에 바뀌어**, 한 화면
 * 안의 두 시계가 잠깐 다른 분을 가리킨다. 구독자가 몇이든 타이머는 하나다.
 *
 * ## 서버 시각이 아니다
 *
 * 브라우저 시계를 쓴다. 이 값으로 하는 일이 "저 사람 지금 몇 시지" 라 **보는
 * 사람의 지금**이 기준이고, 서버에 물어봐야 하는 값이 아니다(참여자 시간대는
 * 서버가 준다). 사용자 시계가 몇 분 틀어져 있으면 그만큼 틀리지만, 그 오차를
 * 없애자고 1 분마다 서버를 부르는 것은 값에 비해 비용이 크다.
 */

/** 지금이 속한 분의 시작(에포크 ms). 스냅샷은 **숫자**여야 한다 — 아래 참고. */
function currentMinute() {
  return Math.floor(Date.now() / 60_000) * 60_000
}

let minute = currentMinute()
let timer = null
const listeners = new Set()

function emit() {
  const next = currentMinute()
  if (next === minute) {
    return
  }
  minute = next
  listeners.forEach((fn) => fn())
}

/** 다음 분 경계까지만 기다린다. 경계를 지나쳤을 때를 대비해 250ms 얹는다. */
function schedule() {
  window.clearTimeout(timer)
  const wait = 60_000 - (Date.now() % 60_000) + 250
  timer = window.setTimeout(() => {
    emit()
    schedule()
  }, wait)
}

/*
  탭이 다시 보이거나 창이 돌아왔을 때.

  늦춰졌거나 잠들어 있던 타이머는 믿을 수 없다. 그 자리에서 한 번 맞추고
  경계도 다시 잡는다.
*/
function resync() {
  if (document.visibilityState === 'hidden') {
    return
  }
  emit()
  schedule()
}

function subscribe(fn) {
  listeners.add(fn)
  if (listeners.size === 1) {
    schedule()
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('focus', resync)
  }

  return () => {
    listeners.delete(fn)
    // 아무도 안 보면 타이머도 끈다. 화면에 없는 시계를 위해 1 분마다 깨어날
    // 이유가 없다.
    if (listeners.size === 0) {
      window.clearTimeout(timer)
      timer = null
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('focus', resync)
    }
  }
}

/**
 * 1 분마다 바뀌는 값.
 *
 * **숫자**를 돌려준다. `new Date()` 를 돌려주면 매 렌더 새 객체라 React 가
 * "바뀌었다" 로 보고 무한히 다시 그린다 — `useSyncExternalStore` 의 스냅샷은
 * 값이 같으면 **같은 것**이어야 한다.
 *
 *     const minute = useMinuteTick()
 *     zoneTime(member.timezone, new Date(minute))
 */
export function useMinuteTick() {
  return useSyncExternalStore(subscribe, () => minute, () => minute)
}
