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
