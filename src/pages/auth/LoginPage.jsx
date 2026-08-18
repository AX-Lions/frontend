import { useState } from 'react'

import { login } from '../../lib/api.js'
import { navigate } from '../../app/navigation.js'
import { isMockMode, setMockMode } from '../../mocks/enabled.js'
import { bannerMessage, fieldErrors } from './authErrors.js'
import './auth.css'

/**
 * 임시 로그인 화면.
 *
 * 디자인 시안이 없어 최소 모양으로 만들어 둔다. 지금 이게 없으면 **토큰을 넣을
 * 방법이 없어 인증이 필요한 API 를 하나도 못 부른다.** 화면 연결 작업이 전부
 * 여기서 막힌다.
 *
 * 시안이 나오면 갈아 끼운다. 토큰을 다루는 쪽(`lib/auth.js`)과 섞지 않았으므로
 * 이 파일만 바꾸면 된다.
 */

const DEMO_ACCOUNTS = [
  { email: 'susu@bordo.dev', name: '유수인', role: '기획·디자인 · 팀 OWNER · 회의 불참자' },
  { email: 'backend01@bordo.dev', name: '최비성', role: '백엔드' },
  { email: 'front01@bordo.dev', name: '임수연', role: '프론트엔드' },
  { email: 'jaemin@bordo.dev', name: '서재민', role: 'PM · 백엔드' },
]
const DEMO_PASSWORD = 'Bordo!2026'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [mock, setMock] = useState(isMockMode)

  const fields = fieldErrors(error)
  const banner = bannerMessage(error, fields)

  async function submit(event) {
    event.preventDefault()
    if (busy) {
      return
    }

    setBusy(true)
    setError(null)
    try {
      // 가상 데이터 모드에서는 확인할 상대가 없다. 빈 값으로 부른다 —
      // 입력칸을 감춰 뒀으므로 남은 값이 있어도 쓰지 않는다.
      await login(mock ? '' : email.trim(), mock ? '' : password)
      // 통째로 다시 읽는다. 화면들이 아직 목 데이터를 보고 있어 상태를 이어받을
      // 자리가 없고, 새로 그리는 편이 토큰이 반영된 상태를 확실히 만든다.
      window.location.assign('/')
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  function fillDemo(account) {
    setEmail(account.email)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Bordo 로그인</h1>
        <p className="auth-lead">
          내가 없는 동안 무슨 일이 있었는지 확인하려면 먼저 로그인하십시오.
        </p>

        {banner ? <p className="auth-banner" role="alert">{banner}</p> : null}

        {/*
          서버 없이 화면을 보는 길.

          백엔드가 안 떠 있거나, 내 계정에 아직 팀·프로젝트가 없거나, 시드를
          다시 올리는 중이면 **화면이 통째로 비어 보인다.** 그 상태로는 UI 를
          다듬을 수도 남에게 보여 줄 수도 없다.

          켜면 이메일·비밀번호 칸을 감춘다. **확인할 상대가 없는데 비밀번호를
          받는 척하면 안 된다** — 아무거나 넣어도 통과하는 칸은 사용자에게
          거짓말이다.
        */}
        <label className="auth-mock">
          <input
            type="checkbox"
            checked={mock}
            disabled={busy}
            onChange={(event) => {
              const on = event.target.checked
              setMock(on)
              setMockMode(on)
              setError(null)
            }}
          />
          <span>
            <strong>가상 백엔드 데이터 사용</strong>
            <em>서버 없이 채워진 화면을 봅니다. 저장은 남지 않습니다.</em>
          </span>
        </label>

        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field" data-invalid={Boolean(fields.email)} hidden={mock}>
            <label htmlFor="login-email">이메일</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby={fields.email ? 'login-email-error' : undefined}
            />
            {fields.email ? (
              <p className="auth-error" id="login-email-error">{fields.email}</p>
            ) : null}
          </div>

          <div className="auth-field" data-invalid={Boolean(fields.password)} hidden={mock}>
            <label htmlFor="login-password">비밀번호</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={fields.password ? 'login-password-error' : undefined}
            />
            {fields.password ? (
              <p className="auth-error" id="login-password-error">{fields.password}</p>
            ) : null}
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={busy || (!mock && (!email || !password))}
          >
            {busy ? '들어가는 중…' : mock ? '가상 데이터로 둘러보기' : '로그인'}
          </button>
        </form>

        <p className="auth-switch" hidden={mock}>
          계정이 없으십니까?{' '}
          <button type="button" onClick={() => navigate('/signup')}>회원가입</button>
        </p>

        {/*
          시연·개발용입니다. 계정을 외워 두지 않아도 화면을 볼 수 있어야 합니다.
          실서비스 화면이 되면 이 블록은 지웁니다.
        */}
        <div className="auth-demo" hidden={mock}>
          <h2>데모 계정</h2>
          <div className="auth-demo-list">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={busy}
                onClick={() => fillDemo(account)}
              >
                <strong>{account.name}</strong> · {account.role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
