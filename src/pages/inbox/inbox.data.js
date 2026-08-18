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

// ─────────────────────────────────────────── 승인 필요 상세 내용 팝업
//
// `승인 필요` 줄이 여는 팝업(시안 `701:5558`)이 쓴다. 요청함과 달리 이
// 셋은 실제로 붙어 있는 주소다(`apps/tasks/views.py`) — Bordo 가 만든
// 태스크는 사람이 승인·반려하기 전까지 `PENDING_APPROVAL` 로 남는다
// (설계 1원칙: 사람 최종 승인).

export function fetchTask(taskId, signal) {
  return api.get(`/tasks/${taskId}`, undefined, { signal })
}

export function approveTask(taskId) {
  return api.post(`/tasks/${taskId}/approve`)
}

/** `reason` 은 필수다 — 반려 사유는 다음 회의 보고서 생성 시 컨텍스트로 쓰인다. */
export function rejectTask(taskId, reason) {
  return api.post(`/tasks/${taskId}/reject`, { reason })
}
