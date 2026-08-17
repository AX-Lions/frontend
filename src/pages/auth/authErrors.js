/**
 * 서버 오류를 폼이 쓸 모양으로 옮긴다.
 *
 * 백엔드는 두 가지 모양으로 실패를 돌려준다. 같은 `details` 인데 안이 다르다.
 *
 *     VALIDATION_ERROR        details = { email: ["올바른 형식이 아닙니다."] }
 *     AUTH_EMAIL_DUPLICATED   details = { email: "susu@bordo.dev" }
 *
 * 앞은 **필드별 안내 문구**이고, 뒤는 **그 값이 무엇이었는지**다. 뒤엣것을
 * 그대로 필드 밑에 찍으면 이메일 칸 아래에 자기 이메일이 다시 뜬다.
 * 그래서 문자열 배열만 필드 오류로 본다.
 */

export function fieldErrors(error) {
  const details = error?.details
  if (!details || typeof details !== 'object') {
    return {}
  }

  const out = {}
  Object.entries(details).forEach(([field, value]) => {
    if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      out[field] = value.join(' ')
    }
  })
  return out
}

/**
 * 화면 위쪽에 띄울 한 줄.
 *
 * 문구를 여기서 새로 만들지 않는다. `message` 는 규약상 **사용자에게 그대로
 * 보여줄 한국어**이고, 화면이 자기 문구를 따로 만들면 같은 상황에 두 가지
 * 안내가 생긴다.
 *
 * 필드별로 이미 보여 준 오류는 위에 또 띄우지 않는다 — 같은 말이 두 번 보인다.
 */
export function bannerMessage(error, shownFields) {
  if (!error) {
    return ''
  }
  if (Object.keys(shownFields || {}).length > 0) {
    return ''
  }
  return error.message || '요청에 실패했습니다.'
}
