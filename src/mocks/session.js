import { ME, PEOPLE } from './data/people.js'

/**
 * 가상 데이터에서 **누구로 보고 있는가**.
 *
 * ## 왜 사람을 고르게 하는가
 *
 * 이 서비스가 묻는 질문이 "내가 없는 동안 무슨 일이 있었지" 다. 그 답은
 * **보는 사람마다 다르다.** 같은 회의라도 참석한 사람에게는 브리핑이 없고,
 * 대리인을 보낸 사람에게는 대리인이 무엇을 답했는지가 뜬다.
 *
 * 한 사람 관점만 만들어 두면 화면의 절반을 확인할 수 없다. 특히
 * **아무 회의도 안 빠진 사람**(브리핑 0건)은 빈 상태가 정상인데, 그 정상을
 * 볼 방법이 없으면 화면이 그것을 오류로 그리는지 알 수가 없다.
 *
 * ## 세계는 하나다
 *
 * 사람마다 다른 세계를 만들지 않는다. 팀 · 프로젝트 · 회의 · 오간 말은
 * 그대로이고 **보는 눈만 바뀐다.** 그래야 계정을 갈아 가며 봤을 때 같은
 * 회의가 사람마다 어떻게 다르게 보이는지가 드러난다.
 */

const KEY = 'bordo.mock.viewer'

export function currentViewer() {
  let email = null
  try {
    email = window.localStorage.getItem(KEY)
  } catch {
    email = null
  }
  return PEOPLE.find((p) => p.email === email) ?? ME
}

export function setViewer(email) {
  try {
    if (email) {
      window.localStorage.setItem(KEY, email)
    } else {
      window.localStorage.removeItem(KEY)
    }
  } catch {
    // 저장이 막힌 브라우저에서는 기본 사람으로 본다.
  }
}
