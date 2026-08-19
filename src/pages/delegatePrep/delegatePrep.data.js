import { api } from '../../lib/api.js'

/**
 * 회의 대리 참석 준비 화면이 부르는 것.
 *
 * ## 한 번에 받는다
 *
 *     GET  /meetings/{id}/prep            헤더 · 논쟁점 · 내 입장 · 활동 설정
 *     PUT  /meetings/{id}/agent-setup     이번 회의 활동 설정 (보낸 것만 바뀜)
 *     PUT  /debate-points/{id}/stance     논쟁점에 대한 내 입장
 *     POST /meetings/{id}/absence         불참 등록
 *     DELETE /meetings/{id}/absence       대리 참석 취소
 *
 * 네 번 나눠 부르지 않는 이유는 서버 주석에 적혀 있다 — 그 사이 불참을
 * 취소하면 **헤더는 `참석 예정` 인데 아래는 대리인 설정을 그리고 있는** 상태가
 * 나온다.
 *
 * ## 화면 문자열을 만들지 않는다
 *
 * `논쟁점 01` · `8월 18일 14:00 - 15:00` · `답변필요` · 뱃지 문구를 전부 서버가
 * 완성해서 내려준다. 클라이언트가 조립하면 두 가지가 깨진다.
 *
 *   - 시각을 브라우저 시간대로 찍으면 **시간대가 다른 팀원이 같은 회의를 다른
 *     시각으로 본다.** 그게 이 서비스의 전제다
 *   - `논쟁점 {n}` 을 두 자리로 맞추는 일을 화면이 하면 열 번째에서 갈린다
 *
 * ## `delegate` 를 쓰지 않는다
 *
 * `POST /meetings/{id}/delegate` 는 **전량 교체** 계약이다. `prompt` 키가 없으면
 * 빈 문자열로 덮어써서, 자료 범위만 고치려고 눌러도 적어 둔 사전 지시가 지워진다
 * (백엔드 이슈 #75). 이 화면은 `적용하기` 가 셋이라 한 버튼이 다른 버튼의 입력을
 * 지우면 안 되므로, **보낸 것만 바꾸는** `agent-setup` 을 쓴다.
 */

/** 준비 화면 한 벌. 헤더·논쟁점·설정이 한 응답에 다 온다. */
export function fetchPrep(meetingId, signal) {
  return api.get(`/meetings/${meetingId}/prep`, undefined, { signal })
}

/**
 * 이번 회의 활동 설정.
 *
 * `mode` 로 무엇을 하려는지 밝힌다.
 *
 *     STANDING   덮어쓴 것을 전부 지우고 평소 설정으로 돌아간다
 *     ONCE       이번 회의에만 적용한다
 *     (없음)     보낸 키만 바꾼다 — 추가 설정만 저장할 때
 */
export function saveAgentSetup(meetingId, payload) {
  return api.put(`/meetings/${meetingId}/agent-setup`, payload)
}

/**
 * 논쟁점에 대한 나의 입장.
 *
 * **사람마다 하나다.** 같은 쟁점에 내 입장이 둘이면 대리인이 어느 쪽으로 말할지
 * 정할 수 없다. 두 번 보내면 갱신이고, 응답으로 그 논쟁점 한 줄이 통째로 온다.
 */
export function saveStance(pointId, { body, optionKey }) {
  return api.put(`/debate-points/${pointId}/stance`, {
    body,
    option_key: optionKey || '',
  })
}

/** 적어 둔 입장 지우기. */
export function removeStance(pointId) {
  return api.delete(`/debate-points/${pointId}/stance`)
}

/** 불참 등록 — 이 회의를 대리인에게 맡긴다. */
export function registerAbsence(meetingId) {
  return api.post(`/meetings/${meetingId}/absence`, {})
}

/** 대리 참석 취소 — 내가 직접 들어간다. */
export function cancelAbsence(meetingId) {
  return api.delete(`/meetings/${meetingId}/absence`)
}
