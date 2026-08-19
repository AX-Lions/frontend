import { useState } from 'react'

import {
  confirmSignupEmailCode, login, sendSignupEmailCode, signup, verifyInviteCode,
} from '../../lib/api.js'
import { navigate } from '../../app/navigation.js'
import { bannerMessage, fieldErrors } from './authErrors.js'
import './auth.css'

/**
 * 회원가입 화면(시안 `707:6492` · `707:6561` · `707:6609`).
 *
 * ## 이메일 인증 · 팀 초대 코드는 아직 백엔드에 없다
 *
 * `POST /auth/signup` 은 지금 이름·이메일·비밀번호만 받고, 인증 절차도
 * 초대 코드도 모른다(팀 참여는 가입 뒤 `POST /teams/join` 으로 따로 한다).
 * 시안은 이 셋을 가입 화면 안에서 끝내는 것을 전제로 하므로, 여기서 먼저
 * 형태를 정한다(`CLAUDE.md` 의 "화면이 계약을 주도한다") — `lib/api.js` 의
 * `sendSignupEmailCode` · `confirmSignupEmailCode` · `verifyInviteCode` 가
 * 그 새 주소들이다. 백엔드가 받으면 그 순간부터 실제로 동작한다.
 *
 * 초대 코드는 **선택**이다. 지금도 팀 참여가 가입과 분리돼 있어서(가입만
 * 하고 나중에 코드로 들어가는 사람이 있다), 여기서 필수로 막으면 그 길이
 * 없어진다.
 */

export function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const [emailStatus, setEmailStatus] = useState('idle') // idle · sent · verified
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeError, setEmailCodeError] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)

  const [inviteCode, setInviteCode] = useState('')
  const [inviteStatus, setInviteStatus] = useState('idle') // idle · verified
  const [inviteError, setInviteError] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [signedUpOnly, setSignedUpOnly] = useState(false)

  const fields = fieldErrors(error)
  const banner = bannerMessage(error, fields)

  const passwordMismatch = Boolean(form.passwordConfirm) && form.passwordConfirm !== form.password
  const ready = Boolean(form.name) && emailStatus === 'verified'
    && form.password.length >= 8 && form.passwordConfirm === form.password

  function set(key) {
    return (event) => {
      const value = event.target.value
      setForm((prev) => ({ ...prev, [key]: value }))
      // 이메일을 바꾸면 이미 받은 인증은 그 주소에 대한 것이 아니게 된다.
      if (key === 'email') {
        setEmailStatus('idle')
        setEmailCode('')
        setEmailCodeError('')
      }
    }
  }

  async function requestEmailCode() {
    if (emailBusy || !form.email) {
      return
    }
    setEmailBusy(true)
    setEmailCodeError('')
    try {
      await sendSignupEmailCode(form.email.trim())
      setEmailStatus('sent')
    } catch (err) {
      setEmailCodeError(err?.message || '인증번호를 보내지 못했습니다.')
    } finally {
      setEmailBusy(false)
    }
  }

  async function confirmEmailCode() {
    if (emailBusy || !emailCode) {
      return
    }
    setEmailBusy(true)
    setEmailCodeError('')
    try {
      await confirmSignupEmailCode(form.email.trim(), emailCode.trim())
      setEmailStatus('verified')
    } catch (err) {
      setEmailCodeError(err?.message || '인증번호가 올바르지 않습니다.')
    } finally {
      setEmailBusy(false)
    }
  }

  async function checkInviteCode() {
    if (inviteBusy || !inviteCode) {
      return
    }
    setInviteBusy(true)
    setInviteError('')
    try {
      await verifyInviteCode(inviteCode.trim())
      setInviteStatus('verified')
    } catch (err) {
      setInviteError(err?.message || '유효하지 않은 초대 코드입니다.')
    } finally {
      setInviteBusy(false)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (busy || !ready) {
      return
    }

    setBusy(true)
    setError(null)

    const email = form.email.trim()
    try {
      await signup({
        email,
        password: form.password,
        name: form.name.trim(),
        // 코드를 확인해 뒀을 때만 싣는다. 확인 안 된 문자열을 보내면 서버가
        // (붙는 날) 그 값으로 팀에 넣으려다 실패한다.
        ...(inviteStatus === 'verified' ? { invite_code: inviteCode.trim() } : {}),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
      })
    } catch (err) {
      setError(err)
      setBusy(false)
      return
    }

    try {
      await login(email, form.password)
    } catch (err) {
      // 계정은 만들어졌다. 다시 가입하라고 안내하면 이메일 중복으로 막힌다.
      setSignedUpOnly(true)
      setError(err)
      setBusy(false)
      return
    }

    window.location.assign('/')
  }

  if (signedUpOnly) {
    return (
      <div className="auth-page">
        <img className="auth-logo" src="/BordoLogo.svg" alt="Bordo" />
        <div className="auth-card">
          <div className="auth-panel">
            <h2>가입은 됐습니다</h2>
            <p className="auth-hint">
              계정은 만들어졌는데 자동 로그인에서 막혔습니다.
              {error?.message ? ` ${error.message}` : ''}
              {' '}로그인 화면에서 방금 만든 계정으로 들어가십시오.
            </p>
            <button
              className="auth-submit"
              type="button"
              data-ready="true"
              onClick={() => navigate('/login')}
            >
              로그인하러 가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <img className="auth-logo" src="/BordoLogo.svg" alt="Bordo" />

      <div className="auth-card">
        <div>
          <h1>{'Bordo와 함께\n빈틈 없는 협업을 시작해보세요.'}</h1>
        </div>

        <div className="auth-panel">
          <h2>회원가입</h2>

          {banner ? <p className="auth-banner" role="alert">{banner}</p> : null}

          <form className="auth-form" onSubmit={submit} noValidate>
            <div
              className="auth-field"
              data-invalid={Boolean(fields.name)}
              data-valid={Boolean(form.name) && !fields.name}
            >
              <div className="auth-field-head">
                <label htmlFor="signup-name">이름</label>
                {fields.name ? <p className="auth-error">* {fields.name}</p> : null}
              </div>
              <div className="auth-input-box">
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  placeholder="이름을 입력해주세요."
                  value={form.name}
                  disabled={busy}
                  onChange={set('name')}
                />
              </div>
              {/* 회의 플로우에서 대리인이 `{이름}의 Bordo` 로 불립니다. */}
              <p className="auth-hint">회의 화면과 대리인 이름에 그대로 쓰입니다.</p>
            </div>

            <div
              className="auth-field"
              data-invalid={Boolean(fields.email)}
              data-valid={emailStatus === 'verified' && !fields.email}
            >
              <div className="auth-field-head">
                <label htmlFor="signup-email">이메일</label>
                {fields.email ? <p className="auth-error">* {fields.email}</p> : null}
              </div>
              <div className="auth-input-row">
                <div className="auth-input-box">
                  <input
                    id="signup-email"
                    type="email"
                    autoComplete="username"
                    placeholder="이메일을 입력해주세요."
                    value={form.email}
                    disabled={busy || emailStatus === 'verified'}
                    onChange={set('email')}
                  />
                </div>
                <button
                  className="auth-verify"
                  type="button"
                  disabled={busy || emailBusy || !form.email || emailStatus === 'verified'}
                  onClick={requestEmailCode}
                >
                  {emailStatus === 'verified' ? '인증완료' : emailBusy ? '보내는 중…' : '인증하기'}
                </button>
              </div>

              {emailStatus === 'sent' ? (
                <div className="auth-input-row">
                  <div className="auth-input-box">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="인증번호 6자리"
                      value={emailCode}
                      disabled={busy || emailBusy}
                      onChange={(e) => setEmailCode(e.target.value)}
                    />
                  </div>
                  <button
                    className="auth-verify"
                    type="button"
                    disabled={busy || emailBusy || !emailCode}
                    onClick={confirmEmailCode}
                  >
                    확인
                  </button>
                </div>
              ) : null}
              {emailCodeError ? <p className="auth-error">* {emailCodeError}</p> : null}
            </div>

            <div
              className="auth-field"
              data-invalid={Boolean(fields.password)}
              data-valid={form.password.length >= 8 && !fields.password}
            >
              <div className="auth-field-head">
                <label htmlFor="signup-password">비밀번호</label>
                {fields.password ? <p className="auth-error">* {fields.password}</p> : null}
              </div>
              <div className="auth-input-box">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="비밀번호를 입력해주세요."
                  value={form.password}
                  disabled={busy}
                  onChange={set('password')}
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
              <p className="auth-hint">8자 이상</p>
            </div>

            <div
              className="auth-field"
              data-invalid={passwordMismatch}
              data-valid={Boolean(form.passwordConfirm) && !passwordMismatch}
            >
              <div className="auth-field-head">
                <label htmlFor="signup-password-confirm">비밀번호 확인</label>
                {passwordMismatch ? <p className="auth-error">* 비밀번호가 일치하지 않습니다.</p> : null}
              </div>
              <div className="auth-input-box">
                <input
                  id="signup-password-confirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="비밀번호를 한 번 더 입력해주세요."
                  value={form.passwordConfirm}
                  disabled={busy}
                  onChange={set('passwordConfirm')}
                />
                <button
                  className="auth-eye"
                  type="button"
                  aria-label={showPasswordConfirm ? '비밀번호 숨기기' : '비밀번호 보기'}
                  onClick={() => setShowPasswordConfirm((v) => !v)}
                >
                  <img src={showPasswordConfirm ? '/icons/Eye.svg' : '/icons/EyeOff.svg'} alt="" />
                </button>
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-field-head">
                <label htmlFor="signup-invite">팀 초대 코드 입력</label>
              </div>
              <div className="auth-input-row">
                <div className="auth-input-box">
                  <input
                    id="signup-invite"
                    type="text"
                    placeholder="팀 초대 코드를 입력해주세요."
                    value={inviteCode}
                    disabled={busy || inviteStatus === 'verified'}
                    onChange={(e) => { setInviteCode(e.target.value); setInviteStatus('idle') }}
                  />
                </div>
                <button
                  className="auth-verify"
                  type="button"
                  disabled={busy || inviteBusy || !inviteCode || inviteStatus === 'verified'}
                  onClick={checkInviteCode}
                >
                  {inviteStatus === 'verified' ? '확인완료' : inviteBusy ? '확인 중…' : '확인하기'}
                </button>
              </div>
              {inviteError ? <p className="auth-error">* {inviteError}</p> : null}
              <p className="auth-hint">없으면 비워 두어도 됩니다. 가입 뒤에도 넣을 수 있습니다.</p>
            </div>

            <button className="auth-submit" type="submit" data-ready={ready} disabled={busy || !ready}>
              {busy ? '만드는 중…' : '가입하고 시작하기'}
            </button>
          </form>

          <p className="auth-switch">
            이미 계정이 있으신가요?{' '}
            <button type="button" onClick={() => navigate('/login')}>로그인</button>
          </p>
        </div>
      </div>
    </div>
  )
}
