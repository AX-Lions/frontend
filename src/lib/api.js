/**
 * 백엔드 호출.
 *
 * ## 상대경로를 쓴다
 *
 * 배포에서 nginx 가 프론트와 `/api` 를 **같은 출처**로 서빙한다. 그래서
 * `fetch('/api/v1/home')` 이면 되고 CORS 설정이 필요 없다. 절대 URL 을 박으면
 * 대회 측 서버로 옮길 때 전부 고쳐야 한다.
 *
 * ## 오류는 HTTP 상태가 아니라 `error.code` 로 가른다
 *
 * 저장소 3곳 공통 규약이다. 백엔드는 실패를 이 모양으로 돌려준다.
 *
 *     { "success": false, "request_id": "...",
 *       "error": { "code": "TEAM_ACCESS_DENIED", "message": "...",
 *                  "details": {...}, "retryable": false } }
 *
 * `message` 는 **사용자에게 그대로 보여줄 한국어**다. 화면에서 문구를 다시
 * 만들지 말고 이걸 쓴다. 같은 상황에 두 가지 안내가 생기면 안 된다.
 *
 * ## 401 을 만나면 한 번만 갱신한다
 *
 * 화면 여러 곳이 동시에 요청하면 401 도 동시에 온다. 각자 갱신하면 refresh
 * 토큰이 여러 번 소모되고, 먼저 끝난 쪽이 발급한 토큰을 나중 쪽이 덮어써
 * **방금 받은 토큰이 무효가 된다.** 그래서 갱신은 하나로 묶고 나머지는
 * 그 결과를 기다린다.
 */

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './auth.js'
import { isMockMode } from '../mocks/enabled.js'

const BASE = '/api/v1'

/** 갱신이 진행 중이면 그 약속을 공유한다. 동시에 여러 번 갱신하지 않기 위해서다. */
let refreshing = null

export class ApiError extends Error {
  constructor({ code, message, details, retryable, status, requestId }) {
    super(message || '요청에 실패했습니다.')
    this.name = 'ApiError'
    this.code = code || 'UNKNOWN'
    this.details = details || {}
    this.retryable = Boolean(retryable)
    this.status = status
    this.requestId = requestId
  }
}

/** 네트워크가 끊긴 경우. 서버가 준 오류와 구분해야 안내 문구가 달라진다. */
export class NetworkError extends Error {
  constructor(cause) {
    super('서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    this.name = 'NetworkError'
    this.code = 'NETWORK'
    this.retryable = true
    this.cause = cause
  }
}

async function toError(response) {
  let body = null
  try {
    body = await response.json()
  } catch {
    // JSON 이 아닌 오류 응답(502 HTML 등)도 있다. 그때는 상태로만 말한다.
  }

  const error = body?.error || {}
  return new ApiError({
    code: error.code,
    message: error.message,
    details: error.details,
    retryable: error.retryable,
    status: response.status,
    requestId: body?.request_id,
  })
}

async function refreshTokens() {
  const token = getRefreshToken()
  if (!token) {
    clearTokens()
    return false
  }

  try {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }),
    })

    if (!response.ok) {
      // 갱신이 거절되면 되돌릴 방법이 없다. 조용히 두면 사용자는 화면이
      // 비어 있는 이유를 모르므로 지우고 로그인으로 보낸다.
      clearTokens()
      return false
    }

    setTokens(await response.json())
    return true
  } catch {
    // 네트워크 문제로 갱신에 실패한 것은 토큰이 죽은 것과 다르다.
    // 지우지 않는다 — 연결이 돌아오면 그대로 쓸 수 있다.
    return false
  }
}

function ensureRefreshed() {
  if (!refreshing) {
    refreshing = refreshTokens().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

async function send(path, { method = 'GET', body, params, signal, auth = true } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value)
    }
  })

  const headers = {}
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const token = auth ? getAccessToken() : null
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  try {
    return await fetch(url, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    // 사용자가 화면을 떠나 취소된 것은 오류가 아니다.
    if (cause?.name === 'AbortError') {
      throw cause
    }
    throw new NetworkError(cause)
  }
}

export async function request(path, options = {}) {
  /*
    가상 데이터 모드면 여기서 끝난다.

    **한 곳에서만 가른다.** 화면마다 조회 함수를 바꾸면 바꾼 곳만 가짜가 되고
    안 바꾼 곳은 진짜를 불러, 서버가 없을 때 화면 절반만 뜨는 상태가 된다.
    모든 호출이 이 함수를 지나가므로 여기가 유일한 갈림길이다.

    `login` · `signup` 도 이 함수를 쓰므로 로그인까지 서버 없이 된다.

    ## `serveMock` 은 그때 가서 받는다

    `mocks/index.js` 가 가상 데이터 전부(`data/**`)를 정적으로 끌어온다.
    이 파일 위에서 그것을 정적으로 `import` 하면, 스위치가 꺼져 있는 사용자도
    그 바이트를 전부 받는다(측정값 +38KB gzip, AX-Lions/frontend#22). `isMockMode`
    는 `localStorage` 하나만 보는 가벼운 함수라 `mocks/enabled.js` 에서 따로
    가져온다 — 진짜 무거운 것은 스위치를 켠 사람만 받도록 스위치를 켰을 때만
    부른다.
  */
  if (isMockMode()) {
    const { serveMock } = await import('../mocks/index.js')
    return serveMock(path, options)
  }

  let response = await send(path, options)

  // 만료된 토큰은 한 번만 갱신하고 그 요청을 다시 보낸다.
  // `_retried` 로 막지 않으면 갱신된 토큰마저 401 일 때 무한히 돈다.
  if (response.status === 401 && options.auth !== false && !options._retried) {
    const ok = await ensureRefreshed()
    if (ok) {
      response = await send(path, { ...options, _retried: true })
    }

    // 갱신했는데도 401 이면 그 토큰으로는 아무것도 못 한다.
    //
    // `/auth/refresh` 는 서명만 본다. 계정이 지워졌거나 비활성화된 뒤에도
    // **새 액세스 토큰이 멀쩡히 발급되고**, 그걸로 다시 부르면 또 401 이다.
    // 여기서 지우지 않으면 화면은 "유효하지 않은 토큰입니다" 를 띄운 채로 멈추고,
    // 사용자는 로그인 화면으로 돌아갈 방법이 없다 — 새로고침해도 같은 화면이다.
    //
    // 지우면 `onAuthChange` 가 돌아 화면이 스스로 로그인으로 간다.
    //
    // **`ok` 일 때만이다.** 갱신이 실패했을 때의 처분은 이미 `refreshTokens` 가
    // 정했다 — 서버가 거절했으면 거기서 지웠고, 네트워크 때문이면 일부러
    // 남겨 뒀다. 여기서 `response.status` 만 보고 다시 지우면 그 결정을
    // 뒤집는다. 지하철에서 잠깐 끊긴 것만으로 **멀쩡한 refresh 토큰까지 날아가
    // 로그인 화면으로 튕긴다.**
    if (ok && response.status === 401) {
      clearTokens()
    }
  }

  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    throw await toError(response)
  }

  // 본문이 없는 200 도 있다.
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  get: (path, params, options) => request(path, { ...options, params }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}

// ─────────────────────────────────────────── 인증
//
// 화면이 토큰을 직접 다루지 않도록 여기서 저장까지 끝낸다.

export async function login(email, password) {
  const body = await request('/auth/login', {
    method: 'POST', auth: false, body: { email, password },
  })
  setTokens(body)
  return body
}

export async function signup(payload) {
  const body = await request('/auth/signup', {
    method: 'POST', auth: false, body: payload,
  })
  // 백엔드가 가입 직후 토큰을 주면 바로 로그인 상태가 된다.
  if (body?.access_token) {
    setTokens(body)
  }
  return body
}

/*
  이메일 인증 · 팀 초대 코드 확인(회원가입, 시안 `707:6492`).

  **아직 백엔드에 없는 주소다.** 지금 가입은 이메일·비밀번호·이름만 받고
  인증 절차가 없고, 초대 코드는 가입 뒤 `POST /teams/join` 으로만 받는다
  (`home.api.js` 의 `joinTeam`). 시안은 가입 화면 안에서 이메일을 인증하고
  초대 코드까지 확인하는 것을 전제로 하므로, 화면이 계약을 먼저 정한다
  (`CLAUDE.md`) — 백엔드가 이 셋을 받으면 그 순간부터 실제로 동작한다.
  그 전까지는 가상 데이터 모드에서만 확인할 수 있다.
*/
export function sendSignupEmailCode(email) {
  return request('/auth/signup/email-code', { method: 'POST', auth: false, body: { email } })
}

export function confirmSignupEmailCode(email, code) {
  return request('/auth/signup/email-code/confirm', {
    method: 'POST', auth: false, body: { email, code },
  })
}

export function verifyInviteCode(code) {
  return request('/auth/signup/invite-code/verify', {
    method: 'POST', auth: false, body: { code },
  })
}

export async function logout() {
  try {
    await request('/auth/logout', {
      method: 'POST', body: { refresh_token: getRefreshToken() },
    })
  } catch {
    // 서버가 거절해도 이 브라우저에서는 로그아웃돼야 한다.
  } finally {
    clearTokens()
  }
}

export function me() {
  return request('/auth/me')
}
