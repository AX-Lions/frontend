/**
 * 토큰 보관과 갱신.
 *
 * 백엔드는 `/api/v1` 전부에 JWT 를 요구한다. 이 파일이 그 토큰을 들고 있는
 * 유일한 곳이다.
 *
 * ## localStorage 를 쓰는 이유
 *
 * httpOnly 쿠키가 더 안전하지만, 그러려면 백엔드가 쿠키를 세팅하고 CSRF 를
 * 다뤄야 한다. 지금 백엔드는 `Authorization: Bearer` 만 받는다.
 * 계약을 바꾸는 것은 별도 논의가 필요하므로 여기서는 헤더 방식을 따른다.
 *
 * ## 화면을 만들지 않는다
 *
 * 로그인 폼은 이 파일의 일이 아니다. 여기는 **토큰을 어떻게 다루는가**만 담고,
 * 화면은 `pages/auth` 가 담당한다. 둘을 섞으면 화면을 바꿀 때마다 인증
 * 로직을 건드리게 된다.
 */

const ACCESS = 'bordo.access_token'
const REFRESH = 'bordo.refresh_token'

/** 토큰이 바뀔 때 알려줄 쪽들. 로그아웃되면 화면이 스스로 반응해야 한다. */
const listeners = new Set()

function emit() {
  listeners.forEach((fn) => fn(getAccessToken()))
}

export function onAuthChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH)
}

export function isSignedIn() {
  return Boolean(getAccessToken())
}

/** 로그인·회원가입 응답을 그대로 넣으면 된다. */
export function setTokens(body) {
  if (!body?.access_token) {
    throw new Error('access_token 이 없는 응답입니다.')
  }

  localStorage.setItem(ACCESS, body.access_token)
  if (body.refresh_token) {
    localStorage.setItem(REFRESH, body.refresh_token)
  }
  emit()
}

export function clearTokens() {
  localStorage.removeItem(ACCESS)
  localStorage.removeItem(REFRESH)
  emit()
}
