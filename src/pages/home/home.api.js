import { api } from '../../lib/api.js'

/**
 * 홈 화면이 부르는 것.
 *
 * ## 한 번에 받는다
 *
 * `GET /home` 하나가 인사·최근 회의·오늘 일정·최근 회의 요약·프로젝트 진행·
 * 사이드바를 **모두** 돌려준다. 쪼개서 부르지 않는다 — 여섯 번 부르면 화면이
 * 조각조각 채워지고, 그중 하나가 늦으면 레이아웃이 흔들린다.
 */

export function fetchHome(signal) {
  return api.get('/home', undefined, { signal })
}

/**
 * 홈 카드의 별.
 *
 * **회의 즐겨찾기와 프로젝트 즐겨찾기는 다른 것이다.** 목 데이터에서는 둘이
 * 섞여 있었지만 서버에서는 대상이 갈린다(`Favorite.Target`).
 */
export function setMeetingFavorite(meetingId, on) {
  const path = `/meetings/${meetingId}/favorite`
  return on ? api.put(path) : api.delete(path)
}

/**
 * 불참 등록 / 해제.
 *
 * 토글인데 POST 인 이유는 서버 쪽 사정이다 — 켜는 시점에 대리인 설정 스냅샷을
 * 남기고 참석 상태까지 함께 바꾼다.
 *
 * `sources` 는 **이 회의에서 대리인이 근거로 쓸 자료 종류**다. 빈 배열은
 * "아무것도 쓰지 않는다" 는 뜻이고 제한 없음이 아니다.
 *
 * `prompt` 는 **반드시 함께 보낸다.** 서버가 키의 유무를 가리지 않고
 * `prompt` 를 빈 문자열로 덮어쓰기 때문에, 빼면 이미 저장돼 있던 사전 지시가
 * 저장 한 번에 지워진다.
 */
export function setDelegation(meetingId, { enabled, sources, prompt }) {
  return api.post(`/meetings/${meetingId}/delegate`, { enabled, sources, prompt })
}
