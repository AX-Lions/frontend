import { useState } from 'react'

import { login } from '../../lib/api.js'
import { navigate } from '../../app/navigation.js'
import { isMockMode, setMockMode } from '../../mocks/enabled.js'
import { setViewer } from '../../mocks/session.js'
import { bannerMessage, fieldErrors } from './authErrors.js'
import './auth.css'

/**
 * 로그인 화면(시안 `707:6391` · `707:6439` · `707:6467`).
 *
 * 칸 테두리·제출 버튼 색은 **서버가 오류를 준 적이 있는지·지금 값이 있는지**로
 * 정한다. 시안은 이메일 형식 자체를 프론트가 미리 따지는 것처럼 보이지만,
 * 이 저장소는 검증을 서버 응답(`error.details`)에 맡기는 쪽이라(`authErrors.js`)
 * 여기서 정규식을 새로 만들지 않는다 — 같은 이메일이 두 군데서 다른 기준으로
 * 걸리는 것을 피한다.
 */

const DEMO_ACCOUNTS = [
  { email: 'susu@bordo.dev', name: '유수인', role: '기획·디자인 · 회의 셋에 없었음' },
  { email: 'backend01@bordo.dev', name: '최비성', role: '백엔드 · 전부 참석(브리핑 없음)' },
  { email: 'front01@bordo.dev', name: '임수연', role: '프론트엔드 · 대리인 없이 한 번 빠짐' },
  { email: 'jaemin@bordo.dev', name: '서재민', role: 'PM · 확인할 변경이 많음' },
  { email: 'daeun@bordo.dev', name: '강다은', role: 'Discord · 시차로 대리인을 보냄' },
]
const DEMO_PASSWORD = 'Bordo!2026'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [mock, setMock] = useState(isMockMode)

  const fields = fieldErrors(error)
  const banner = bannerMessage(error, fields)
  const ready = !mock && Boolean(email) && Boolean(password)

  async function submit(event) {
    event.preventDefault()
    if (busy) {
      return
    }

    setBusy(true)
    setError(null)
    try {
      if (mock) {
        // 사람을 안 고르고 그냥 들어오면 기본 사람으로 본다.
        setViewer(null)
      }
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

  /** 가상 모드에서 그 사람으로 바로 들어간다. */
  async function enterAs(account) {
    if (busy) {
      return
    }
    setViewer(account.email)
    setBusy(true)
    setError(null)
    try {
      await login('', '')
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
      <img className="auth-logo" src="/BordoLogo.svg" alt="Bordo" />

      <div className="auth-card">
        <div>
          <h1>만나서 반가워요!</h1>
          <p className="auth-lead">Bordo에서 팀과의 협업을 이어가세요.</p>
        </div>

        <div className="auth-panel">
          <h2>로그인하기</h2>

          {banner ? <p className="auth-banner" role="alert">{banner}</p> : null}

          <form className="auth-form" onSubmit={submit} noValidate>
            {!mock ? (
              <>
                <div
                  className="auth-field"
                  data-invalid={Boolean(fields.email)}
                  data-valid={Boolean(email) && !fields.email}
                >
                  <div className="auth-field-head">
                    <label htmlFor="login-email">이메일</label>
                    {fields.email ? (
                      <p className="auth-error" id="login-email-error">* {fields.email}</p>
                    ) : null}
                  </div>
                  <div className="auth-input-box">
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      placeholder="이메일을 입력해주세요."
                      value={email}
                      disabled={busy}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-describedby={fields.email ? 'login-email-error' : undefined}
                    />
                  </div>
                </div>

                <div
                  className="auth-field"
                  data-invalid={Boolean(fields.password)}
                  data-valid={Boolean(password) && !fields.password}
                >
                  <div className="auth-field-head">
                    <label htmlFor="login-password">비밀번호</label>
                    {fields.password ? (
                      <p className="auth-error" id="login-password-error">* {fields.password}</p>
                    ) : null}
                  </div>
                  <div className="auth-input-box">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="비밀번호를 입력해주세요."
                      value={password}
                      disabled={busy}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-describedby={fields.password ? 'login-password-error' : undefined}
                    />
                    <button
                      className="auth-eye"
                      type="button"
                      aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      <img src={showPassword ? '/icons/Eye.svg' : '/icons/EyeOff.svg'} alt="" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="auth-hint">
                가상 데이터 모드입니다. 아래에서 볼 사람을 고르면 바로 들어갑니다.
              </p>
            )}

            <button
              className="auth-submit"
              type="submit"
              data-ready={mock || ready}
              disabled={busy || (!mock && !ready)}
            >
              {busy ? '들어가는 중…' : mock ? '가상 데이터로 둘러보기' : '로그인'}
            </button>
          </form>

          {!mock ? (
            <p className="auth-switch">
              계정이 없으신가요?{' '}
              <button type="button" onClick={() => navigate('/signup')}>회원가입</button>
            </p>
          ) : null}
        </div>

        {/*
          시연·개발용입니다. 계정을 외워 두지 않아도 화면을 볼 수 있어야 합니다.
          실서비스 화면이 되면 이 블록은 지웁니다.
        */}
        <div className="auth-dev">
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

          {/*
            가상 모드에서도 계정을 고르게 한다.

            **"내가 없는 동안 무슨 일이 있었지" 의 답은 보는 사람마다 다르다.**
            같은 회의라도 참석한 사람에게는 브리핑이 없고, 대리인을 보낸 사람에게는
            대리인이 무엇을 답하고 무엇을 유보했는지가 뜬다. 한 사람 관점만 볼 수
            있으면 화면의 절반을 확인할 수 없다.

            진짜 로그인일 때는 칸을 채워 주기만 하고(비밀번호는 본인이 확인한다),
            가상 모드에서는 **그 사람으로 바로 들어간다** — 확인할 상대가 없다.
          */}
          <div className="auth-demo">
            <h2>{mock ? '누구로 볼까요' : '데모 계정'}</h2>
            {mock ? (
              <p className="auth-demo-hint">
                고른 사람의 눈으로 보입니다. 회의·기록은 같고 무엇이 내 몫인지가 달라집니다.
              </p>
            ) : null}
            <div className="auth-demo-list">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  disabled={busy}
                  onClick={() => (mock ? enterAs(account) : fillDemo(account))}
                >
                  <strong>{account.name}</strong> · {account.role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
