import { api } from '../../lib/api.js'

/**
 * 개인 설정 화면이 부르는 것.
 *
 * ## 두 곳에 나뉘어 있다
 *
 *     이름       PATCH /users/me            사람에 붙은 값
 *     말투·정책  PATCH /me/agent/settings   대리인에 붙은 값
 *
 * 한 화면에서 고치지만 **저장 위치가 다르다.** 대리인 설정은 바뀔 때마다
 * `active_version` 이 올라가고, 그 버전이 "대리인이 그때 그 기준으로 판정했다" 를
 * 가리킨다. 이름은 그런 이력을 갖지 않는다.
 */

export function fetchMe(signal) {
  return api.get('/auth/me', undefined, { signal })
}

export function patchMe(patch) {
  return api.patch('/users/me', patch)
}

export function fetchAgentSettings(signal) {
  return api.get('/me/agent/settings', undefined, { signal })
}

/**
 * 대리인 설정 저장.
 *
 * GET 은 설정을 그대로 주는데 PATCH 는 `{settings, previous_version, changed}` 로
 * 감싸서 준다. 여기서 벗겨 **부르는 쪽이 한 가지 모양만 보게** 한다.
 * (계약이 갈린 자리라 백엔드 이슈로 올려 뒀다 — AX-Lions/backend#73)
 */
export async function patchAgentSettings(patch) {
  const saved = await api.patch('/me/agent/settings', patch)
  return saved?.settings ?? saved
}

/** 화면에 뿌릴 말투 목록. `value` 는 서버의 `AgentTone` 값과 같아야 한다. */
export const TONES = [
  {
    value: 'FORMAL',
    label: '정중하게',
    example: '해당 일정은 8월 18일까지로 잡혀 있습니다.',
  },
  {
    value: 'FRIENDLY',
    label: '친근하게',
    example: '그 일정은 8월 18일까지예요.',
  },
  {
    value: 'CONCISE',
    label: '간결하게',
    example: '마감 8/18. 근거는 디자인 시안 문서.',
  },
]
