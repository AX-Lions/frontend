import { api } from '../../lib/api.js'

/**
 * 내 요청함.
 *
 * 회의마다 흩어져 있는 `답변 필요`(AI 브리핑) · `확인 필요` · `승인 필요`
 * (정책 승인)를 날짜별로 모아 돌려준다. 아직 백엔드에 없는 주소라 실서버
 * 모드에서는 404 로 답한다 — 가상 데이터 모드에서 먼저 형태를 확정한다
 * (`CLAUDE.md` 의 "화면이 계약을 주도한다").
 */
export function fetchInbox(signal) {
  return api.get('/me/inbox', undefined, { signal })
}
