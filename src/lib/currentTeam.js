/**
 * 지금 보고 있는 팀.
 *
 * ## 서버에는 없는 개념이다
 *
 * `GET /teams` 는 내가 속한 팀을 전부 돌려줄 뿐 "지금 어느 팀을 보고
 * 있는지" 는 모른다 — 그건 화면이 정하는 것이다(브라우저 탭마다 다를 수도
 * 있는 값을 서버 세션에 두면 다른 탭에서 팀을 바꿨을 때 서로 덮어쓴다).
 * 그래서 여기, `localStorage` 에 둔다 — `mocks/enabled.js` 와 같은 이유로
 * 새로고침해도 유지돼야 하고 탭마다 따로 켤 일은 없다.
 *
 * ## 안 고른 상태를 구별한다
 *
 * `null` 은 "아직 고른 적 없음" — 이때 홈은 **모든 팀의 프로젝트를 다 보여준다.**
 * 팀을 하나 고르면 그 팀 것만 남는다. 그래서 처음 켠 사람은 지금까지와
 * 똑같이 보이다가, `팀 전환하기` 를 한 번 쓰고 나서야 걸러진다.
 */

const KEY = 'bordo.currentTeam'
const CHANGED = 'bordo:team-changed'

export function getCurrentTeamId() {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setCurrentTeamId(id) {
  try {
    if (id) {
      window.localStorage.setItem(KEY, id)
    } else {
      window.localStorage.removeItem(KEY)
    }
  } catch {
    return
  }
  window.dispatchEvent(new Event(CHANGED))
}

export function onCurrentTeamChange(fn) {
  const handler = () => fn(getCurrentTeamId())
  window.addEventListener(CHANGED, handler)
  return () => window.removeEventListener(CHANGED, handler)
}
