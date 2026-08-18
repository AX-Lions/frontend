import { useCallback, useSyncExternalStore } from 'react'

/**
 * 경로 이동.
 *
 * 라우터 라이브러리를 아직 안 쓴다. `AppRouter` 가 `window.location.pathname` 을
 * 직접 보고 있어서, 그 방식을 그대로 두되 **주소를 바꾸면 화면이 따라오도록**
 * 하는 최소한만 여기 둔다.
 *
 * ## 왜 라이브러리를 안 넣나
 *
 * 지금 화면이 다섯 개고 중첩 라우트도 파라미터도 없다. 넣으면 임수연님이
 * 돌아왔을 때 구조가 바뀌어 있는 셈이 된다. 경로가 늘어나 이 파일이 버거워지면
 * 그때 논의해서 넣는다.
 *
 * ## popstate 만으로는 부족하다
 *
 * `history.pushState` 는 `popstate` 를 **쏘지 않는다.** 우리가 코드로 이동한
 * 경우 아무 일도 안 일어나므로 직접 알린다.
 *
 * ## 링크는 `AppLink` 를 쓴다
 *
 * `<a href>` 를 그냥 두면 브라우저가 문서를 통째로 다시 받는다. 그 클릭을
 * 가로채는 규칙이 여기 있고(`navigateFromClick`), 그것을 씌운 링크가
 * `./AppLink.jsx` 다. JSX 라 파일을 갈랐을 뿐 짝이다.
 *
 * ## 경로와 주소는 다른 값이다
 *
 * `currentPath()` 는 **경로만** 돌려준다. 화면을 고르는 데는 그것으로 충분하고
 * `AppRouter` 가 그 값으로 분기하므로 의미를 바꾸지 않는다. 다만 `?meeting=A`
 * 와 `?meeting=B` 는 경로가 같아서, 경로만 보면 **회의를 옮긴 이동이 아무 일도
 * 없었던 것으로 읽힌다.** 같은 경로 안에서 무엇이 달라졌는지 알아야 하는 쪽은
 * `currentLocation()` 을 본다.
 */

const CHANGED = 'bordo:navigate'

/** 지금 주소 전체 — 경로에 쿼리와 해시까지. 같은 경로 안의 이동은 이것으로 갈린다. */
export function currentLocation() {
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}

export function navigate(path, { replace = false } = {}) {
  /*
    경로가 아니라 **주소 전체**로 비교한다.

    경로만 보면 두 가지가 어긋난다. `/chat?x=1` 에서 `/chat` 으로 가려는 것은
    쿼리를 지우려는 이동인데 경로가 같다는 이유로 통째로 삼켜졌고, 반대로 지금과
    똑같은 주소로 가는 링크는 경로에 쿼리가 붙어 있다는 이유로 **히스토리에 같은
    항목을 하나 더 쌓아 뒤로 가기를 한 번 헛돌게** 했다.
  */
  if (currentLocation() === path) {
    return
  }

  if (replace) {
    window.history.replaceState({}, '', path)
  } else {
    window.history.pushState({}, '', path)
  }
  window.dispatchEvent(new Event(CHANGED))
}

/**
 * 주소가 바뀔 때마다 다시 그리도록 구독한다.
 *
 * 콜백에 **주소 전체**(`currentLocation()`)를 넘긴다. `popstate` 는 쿼리만 다른
 * 항목으로 돌아갈 때도 오는데, 받는 쪽이 경로만 읽으면 값이 같아서 그 알림이
 * 그대로 사라진다 — 주소 표시줄은 `?meeting=A` 인데 화면은 회의 B 그대로인
 * 상태가 그렇게 생긴다. **무엇이 달라졌는지 판단할 재료를 알림에 실어 둔다.**
 *
 * 알림은 거르지 않는다. 여기서 "지난번과 같은 주소" 를 기억해 걸러 내면 구독자가
 * 여럿일 때 늦게 들어온 쪽이 첫 알림을 통째로 놓친다.
 */
export function subscribeToPath(onChange) {
  const notify = () => onChange(currentLocation())

  window.addEventListener('popstate', notify)
  window.addEventListener(CHANGED, notify)
  return () => {
    window.removeEventListener('popstate', notify)
    window.removeEventListener(CHANGED, notify)
  }
}

/** 화면을 고르는 값. **쿼리는 빼고 경로만** 돌려준다 — 쿼리까지 필요하면 `currentLocation()`. */
export function currentPath() {
  return window.location.pathname
}

/**
 * 주소의 쿼리 한 칸을 **지켜본다.**
 *
 * 화면들이 `window.location.search` 를 첫 렌더에서 한 번만 읽고 있었다. 그래서
 * 뒤로 가기로 `?meeting=A` 에 돌아와도 화면은 회의 B 그대로였고, `?room=5` 가
 * 붙은 채팅에서 `채팅` 링크를 눌러 쿼리를 지워도 방이 그대로 열려 있었다.
 * **주소는 이렇게 말하는데 화면은 저렇게 보이는** 상태다.
 *
 * 경로가 아니라 쿼리만 바뀌는 이동은 `AppRouter` 가 잡지 않는다 — 그쪽은
 * 화면을 고르는 일만 하고, 화면이 같으면 할 일이 없는 것이 맞다. 그러니
 * 쿼리는 **그것을 쓰는 화면이 직접 본다.**
 *
 * `history.replaceState` 로 주소만 조용히 고친 경우는 알림이 없어 여기 값이 안
 * 바뀐다. 그건 의도한 것이다 — 그 자리는 화면이 **이미 알고 있는 것**을 주소에
 * 적어 두는 것이라, 되읽으면 방금 한 일을 한 번 더 하게 된다.
 */
export function useSearchParam(name) {
  /*
    주소는 React 밖에 있는 값이라 `useSyncExternalStore` 로 읽는다.

    `useState` + `useEffect` 로 베끼면 두 가지가 어긋난다. 렌더에서 한 번 읽고
    effect 에서 구독하므로 **그 사이의 이동을 놓치고**, 그것을 메우려고 effect
    안에서 곧바로 상태를 고치면 렌더가 한 번 더 돈다(React 19 린트가 막는다).
    이 훅은 그 둘을 React 가 알아서 맞춰 준다.
  */
  const getSnapshot = useCallback(
    () => new URLSearchParams(window.location.search).get(name) || null,
    [name],
  )

  return useSyncExternalStore(subscribeToPath, getSnapshot)
}

/**
 * 새 탭·새 창으로 열려는 클릭인지.
 *
 * Ctrl·Cmd 는 새 탭, Shift 는 새 창, Alt 는 내려받기, 가운데 버튼은 새 탭이다.
 * 이건 브라우저가 링크에 대해 보장하는 동작이라 **우리가 가로채면 안 된다.**
 * 가로채면 "새 탭으로 열기" 가 조용히 같은 탭 이동으로 바뀐다.
 *
 * `button` 은 `click` 에만 있고 `keydown` 으로 링크를 여는 경우에는 없다.
 * 없을 때를 0(주 버튼)으로 보지 않고 따로 걸러야, 키보드로 엔터를 친 사람이
 * "가운데 버튼" 취급을 받지 않는다.
 */
export function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || (event.button !== undefined && event.button !== 0)
}

/**
 * 앱 안으로 가는 링크의 **평범한 클릭만** 가로챈다.
 *
 * 이미 누군가 `preventDefault()` 했으면 손대지 않는다. 화면이 자기 사정으로
 * 이동을 막는 경우가 있다 — 채팅의 설정 화면처럼 주소는 그대로 두고 패널만
 * 닫아야 하는 자리다.
 */
export function navigateFromClick(event, href) {
  if (event.defaultPrevented || isModifiedClick(event)) {
    return
  }

  event.preventDefault()
  navigate(href)
}
