import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import './TooltipLayer.css'

/**
 * 아이콘 위에 얹었을 때 뜨는 안내 말풍선.
 *
 * ## 왜 컴포넌트로 감싸지 않았나
 *
 * `<Tooltip>` 으로 아이콘마다 감싸면 화면 수십 곳을 다 고쳐야 하고, 한 곳이라도
 * 빠지면 **어떤 아이콘은 안내가 뜨고 어떤 것은 안 뜬다.** 그림만 있는 단추가
 * 뜻을 안 알려 주는 것이 원래 문제였는데, 절반만 고치면 사용자는 규칙이 없다고
 * 느낀다.
 *
 * 그래서 문서 전체에 한 번 귀를 열어 두고, 아이콘 쪽은 `data-tip="홈"` 한 줄만
 * 붙인다. 새 아이콘을 만들 때도 그 한 줄이면 된다.
 *
 * ## 왜 `title` 이 아닌가
 *
 * 브라우저 기본 말풍선은 **1초쯤 기다려야 뜨고**, 모양을 바꿀 수 없으며,
 * 키보드로 옮겨 다닐 때는 아예 안 뜬다. 그래서 `title` 은 걷어내고 이쪽으로
 * 옮긴다 — 둘을 같이 두면 검은 말풍선 위에 회색 기본 말풍선이 겹쳐 뜬다.
 *
 * ## 자리
 *
 * `position: fixed` 로 문서 맨 위층에 그린다. 아이콘 옆에 붙여 놓으면 사이드바
 * 처럼 `overflow: hidden` 인 상자 안에서 **말풍선이 잘린다** — 실제로 이 앱의
 * 사이드바가 전부 그렇다.
 */

/** 얹고 이만큼 지나야 뜬다. 지나가다 스친 아이콘까지 말풍선이 따라 뜨면 성가시다. */
const OPEN_DELAY = 320

/** 아이콘과 말풍선 사이. */
const GAP = 8

/** 화면 가장자리와 말풍선 사이에 남길 틈. */
const EDGE = 8

export function TooltipLayer() {
  const [tip, setTip] = useState(null)
  const bubbleRef = useRef(null)

  /*
    화면 밖으로 나간 말풍선을 안으로 민다.

    가로 가운데를 아이콘에 맞추는데(`translateX(-50%)`), 화면 맨 왼쪽 아이콘
    에서는 그 절반이 화면 밖으로 나가 **글자가 잘린다.** 폭은 글자가 정하므로
    그릴 때까지 알 수 없다 — 그려 놓고 한 번 재서 민다.
  */
  useLayoutEffect(() => {
    const bubble = bubbleRef.current
    if (!bubble || !tip) {
      return
    }
    const half = bubble.offsetWidth / 2
    const min = EDGE + half
    const max = window.innerWidth - EDGE - half
    const x = Math.min(Math.max(tip.x, min), Math.max(min, max))
    bubble.style.left = `${x}px`
  }, [tip])

  useEffect(() => {
    let timer = null
    let target = null

    const clear = () => {
      window.clearTimeout(timer)
      timer = null
      target = null
      setTip(null)
    }

    /** 말풍선을 아이콘 아래 가운데에 놓되, 화면 밖으로 나가면 안으로 민다. */
    const place = (element, label) => {
      const box = element.getBoundingClientRect()
      setTip({
        label,
        // 자리는 아래에서 `transform` 으로 가운데를 맞춘다. 여기서 폭을 재려면
        // 말풍선을 먼저 그려야 해서 한 프레임 늦게 뜬다.
        x: box.left + box.width / 2,
        y: box.bottom + GAP,
      })
    }

    const open = (event) => {
      const element = event.target instanceof Element
        ? event.target.closest('[data-tip]')
        : null
      if (!element || element === target) {
        return
      }
      const label = element.getAttribute('data-tip')
      if (!label) {
        return
      }

      window.clearTimeout(timer)
      target = element
      // 키보드로 옮겨 왔을 때는 기다리지 않는다 — 일부러 그 자리에 간 것이다.
      const delay = event.type === 'focusin' ? 0 : OPEN_DELAY
      timer = window.setTimeout(() => place(element, label), delay)
    }

    const close = (event) => {
      const element = event.target instanceof Element
        ? event.target.closest('[data-tip]')
        : null
      if (element && element === target) {
        clear()
      }
    }

    document.addEventListener('pointerover', open)
    document.addEventListener('pointerout', close)
    document.addEventListener('focusin', open)
    document.addEventListener('focusout', close)
    // 누르면 닫는다. 눌러서 화면이 바뀌었는데 말풍선만 남아 떠 있으면
    // 무엇을 가리키는지 알 수 없다. 스크롤도 같은 이유다.
    document.addEventListener('pointerdown', clear)
    window.addEventListener('scroll', clear, true)
    window.addEventListener('blur', clear)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerover', open)
      document.removeEventListener('pointerout', close)
      document.removeEventListener('focusin', open)
      document.removeEventListener('focusout', close)
      document.removeEventListener('pointerdown', clear)
      window.removeEventListener('scroll', clear, true)
      window.removeEventListener('blur', clear)
    }
  }, [])

  if (!tip) {
    return null
  }

  return (
    <div
      className="tooltip-bubble"
      ref={bubbleRef}
      style={{ left: tip.x, top: tip.y }}
      role="presentation"
    >
      {tip.label}
    </div>
  )
}
