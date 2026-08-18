import { api } from '../../lib/api.js'

/**
 * 회의 대리 참석 준비 화면이 부르는 것.
 *
 * ## 세 곳에 나뉘어 있다
 *
 *     회의 정보     GET  /meetings/{id}          제목 · 시각 · 프로젝트
 *     평소 설정     GET  /me/agent/settings      대리인에 붙은 값 (전역)
 *     저장해 둔 지시 GET  /me/agent/prompts       재사용하는 시스템 프롬프트
 *     이 회의 등록   POST /meetings/{id}/delegate 불참 등록 · 자료 범위 · 사전 지시
 *
 * **평소 설정은 전역이고 대리 등록은 회의별이다.** 이 화면의 `이번에만 다르게
 * 사용` 이 성립하는 이유가 그것이다 — 회의별 값만 바꾸고 전역은 건드리지 않는다.
 * 여기서 전역을 고치면 이 회의 하나 때문에 다음 회의들의 기준까지 바뀐다.
 */

/** 화면을 주소로 바로 열었을 때(홈을 거치지 않았을 때) 회의 정보를 얻는 길. */
export function fetchMeeting(meetingId, signal) {
  return api.get(`/meetings/${meetingId}`, undefined, { signal })
}

/** 저장해 둔 시스템 프롬프트. 화면의 `시스템 프롬프트` 칸에 쌓인다. */
export function fetchAgentPrompts(signal) {
  return api.get('/me/agent/prompts', undefined, { signal })
}

/** 새 지시를 저장해 둔다. 다음 회의에서도 다시 고를 수 있다. */
export function createAgentPrompt(body) {
  return api.post('/me/agent/prompts', { body })
}

/**
 * 이 회의에 대리인을 세운다.
 *
 * ## `behavior` 는 아직 서버가 안 읽는다
 *
 * 화면의 세부 설정 여섯 줄 중 **셋은 회의별로 저장할 곳이 없다.**
 *
 *     작업 공개 · 계획 공개 · 생각 공개   → `sources` 로 저장된다 (있음)
 *     구현 가능성 판단 · 일정 수정 여부 판단 · 회의 중간 질문
 *                                        → `/me/agent/settings` 의 **전역** 값뿐
 *
 * 그런데 이 화면이 하는 말은 `이번 회의에서 Bordo가 어떻게 행동할지` 다. 전역을
 * 고쳐 버리면 `일회성으로 적용합니다` 가 거짓말이 된다. 그래서 회의별 값으로
 * 함께 보내되, **서버는 모르는 키를 조용히 버린다**(`delegate` 는 `enabled` ·
 * `prompt` · `sources` 만 읽는다). 지금은 아무 일도 일어나지 않고, 백엔드가
 * 필드를 받는 순간 화면을 안 고쳐도 동작한다.
 *
 * **백엔드에 이슈로 올려야 한다.** 그때까지 이 셋은 화면에서 고를 수는 있지만
 * 회의에는 전역 설정이 적용된다 — 화면이 그렇게 안내한다.
 */
export function saveDelegation(meetingId, { enabled, sources, prompt, behavior }) {
  return api.post(`/meetings/${meetingId}/delegate`, {
    enabled, sources, prompt, behavior,
  })
}
