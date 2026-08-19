import { useCallback, useEffect, useRef, useState } from 'react'

import { navigate } from '../../app/navigation.js'
import { api } from '../../lib/api.js'
import { useResource } from '../../lib/useResource.js'

export const LIVE_MEETING_RESPONSE_SECONDS = 10

/**
 * 지금 이 순간 진행 중인 회의 하나.
 *
 * `delegation` 이 있는 것만 본다 — 대리인을 보낼 수 있는 회의(내가 참석자인
 * 회의)에서만 "참여할까, 대리인을 보낼까" 를 물을 수 있다. 초대만 받은 회의
 * (`delegation: null`)는 이 팝업의 질문 자체가 성립하지 않는다.
 */
function findLiveMeeting(home, now) {
  const schedule = home?.today_schedule ?? []
  return schedule.find((item) => {
    if (!item.meeting_id || !item.at || !item.ends_at || !item.delegation) {
      return false
    }
    const start = new Date(item.at).getTime()
    const end = new Date(item.ends_at).getTime()
    return now >= start && now <= end
  }) ?? null
}

/**
 * 지금 진행 중인 회의 팝업(시안 `666:4920` · `666:5231`) 상태 전부.
 *
 * 아이콘을 그리는 자리(전역 레일이든 홈 사이드바든)와 팝업을 그리는 자리가
 * 갈릴 수 있어 훅으로 뽑았다 — 상태·타이머·요청은 한 곳에서만 돈다.
 *
 * `HomePage` 와 같은 캐시 키(`home`)를 쓴다. `today_schedule` 은 이미
 * `/home` 에 있으므로 새 주소를 만들지 않는다.
 *
 * 30초마다 `now` 를 다시 재서, 회의가 끝나면 아이콘도 스스로 돌아온다 —
 * 새로고침해야만 없어지면 회의가 끝난 뒤에도 한참 눌리게 된다.
 */
export function useLiveMeeting() {
  const { data: home } = useResource(
    (signal) => api.get('/home', undefined, { signal }), [], { cacheKey: 'home' })

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const liveMeeting = findLiveMeeting(home, now)

  const [promptOpen, setPromptOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(LIVE_MEETING_RESPONSE_SECONDS)
  const [responding, setResponding] = useState(false)
  // `respondDecline` 을 안정된 함수로 두려고(카운트다운 effect 의 의존성이라)
  // 판정은 상태가 아니라 ref 로 한다.
  const respondingRef = useRef(false)

  const openPrompt = () => {
    setSecondsLeft(LIVE_MEETING_RESPONSE_SECONDS)
    setPromptOpen(true)
  }

  /**
   * 대리인에게 맡긴다.
   *
   * 10초 동안 응답이 없을 때와 `불참하기` 를 누를 때가 같은 일이다 — 둘 다
   * "이 회의는 내가 아니라 Bordo 가 간다" 는 결정이다. 이미 손봐 둔 자료
   * 범위·사전 지시(`liveMeeting.delegation`)가 있으면 그대로 쓴다. 없으면
   * 빈 값으로 켠다 — 대리인은 보내되 범위는 나중에 개인 설정에서 정할 수 있다.
   */
  const respondDecline = useCallback(async () => {
    if (!liveMeeting || respondingRef.current) {
      return
    }
    respondingRef.current = true
    setResponding(true)
    try {
      await api.post(`/meetings/${liveMeeting.meeting_id}/delegate`, {
        enabled: true,
        sources: liveMeeting.delegation?.sources ?? [],
        prompt: liveMeeting.delegation?.prompt ?? '',
      })
    } catch {
      // 팝업의 목적은 "지금 어떻게 할지" 를 정하는 것이지 이 요청의 성패를
      // 다루는 것이 아니다. 실패해도 닫는다 — 대리인 설정은 개인 설정에서
      // 다시 손볼 수 있다.
    } finally {
      respondingRef.current = false
      setResponding(false)
      setPromptOpen(false)
    }
  }, [liveMeeting])

  const respondJoin = () => {
    if (liveMeeting?.action?.url) {
      window.open(liveMeeting.action.url, '_blank', 'noopener')
    } else if (liveMeeting) {
      navigate(`/flow-board?meeting=${liveMeeting.meeting_id}`)
    }
    setPromptOpen(false)
  }

  /*
    매초 줄이고, 0 에 닿으면 `불참하기` 와 같은 일을 한다.

    타이머 콜백 안에서만 `setState` 를 부른다 — effect 본문에서 곧장 부르면
    "effect 안에서 동기적으로 상태를 바꾼다" 는 린트 규칙에 걸린다
    (`useResource.js` 의 같은 사연 참고).
  */
  useEffect(() => {
    if (!promptOpen) {
      return undefined
    }

    let remaining = LIVE_MEETING_RESPONSE_SECONDS
    const id = window.setInterval(() => {
      remaining -= 1
      setSecondsLeft(Math.max(0, remaining))
      if (remaining <= 0) {
        window.clearInterval(id)
        respondDecline()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [promptOpen, respondDecline])

  return {
    liveMeeting,
    promptOpen,
    secondsLeft,
    responding,
    openPrompt,
    respondDecline,
    respondJoin,
  }
}
