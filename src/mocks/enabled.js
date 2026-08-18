/**
 * 가상 데이터 모드 스위치.
 *
 * ## 왜 두는가
 *
 * 백엔드가 안 떠 있거나, 내 계정에 아직 팀·프로젝트가 없거나, 시드를 다시
 * 올리는 중이면 **화면이 통째로 비어 보인다.** 그 상태에서는 UI 를 다듬을 수도
 * 없고 남에게 보여 줄 수도 없다. 서버 없이도 화면이 채워진 상태로 돌게 한다.
 *
 * ## 감추지 않는다
 *
 * 켜져 있으면 화면 위에 **띠를 하나 띄운다.** 진짜와 구별되지 않는 가짜가
 * 제일 위험하다 — 시연 중에 가짜인 줄 모르고 보여 주거나, 가짜 데이터를 보고
 * 없는 버그를 잡게 된다. 이 프로젝트가 "근거가 부족하면 유보한다" 를 원칙으로
 * 두는 것과 같은 이유다.
 *
 * ## `localStorage` 에 두는 이유
 *
 * 새로고침해도 유지돼야 하고(로그인 화면에서 켜고 홈으로 넘어간다), 탭마다
 * 따로 켜고 끌 일은 없다. 빌드 플래그(`import.meta.env`)로 두면 껐다 켜는 데
 * 재시작이 필요해서 쓰기가 번거롭다.
 */

const KEY = 'bordo.mock'
const CHANGED = 'bordo:mock-changed'

export function isMockMode() {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    // 사생활 보호 모드처럼 `localStorage` 자체가 막힌 브라우저가 있다.
    // 그때는 꺼진 것으로 본다 — 켤 방법이 없는 것이 켜진 채 갇히는 것보다 낫다.
    return false
  }
}

export function setMockMode(on) {
  try {
    if (on) {
      window.localStorage.setItem(KEY, '1')
    } else {
      window.localStorage.removeItem(KEY)
    }
  } catch {
    return
  }
  window.dispatchEvent(new Event(CHANGED))
}

export function onMockChange(fn) {
  const handler = () => fn(isMockMode())
  window.addEventListener(CHANGED, handler)
  return () => window.removeEventListener(CHANGED, handler)
}
