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
 */

const CHANGED = 'bordo:navigate'

export function navigate(path, { replace = false } = {}) {
  if (window.location.pathname === path) {
    return
  }

  if (replace) {
    window.history.replaceState({}, '', path)
  } else {
    window.history.pushState({}, '', path)
  }
  window.dispatchEvent(new Event(CHANGED))
}

/** 주소가 바뀔 때마다 다시 그리도록 구독한다. */
export function subscribeToPath(onChange) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}

export function currentPath() {
  return window.location.pathname
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
