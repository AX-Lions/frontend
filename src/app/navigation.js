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
