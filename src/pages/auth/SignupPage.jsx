import { useState } from 'react'

import { login, signup } from '../../lib/api.js'
import { navigate } from '../../app/navigation.js'
import { bannerMessage, fieldErrors } from './authErrors.js'
import './auth.css'

/**
 * 임시 회원가입 화면.
 *
 * ## 가입만으로는 로그인되지 않는다
 *
 * `POST /auth/signup` 은 **토큰을 주지 않는다.** 201 로 사용자 정보만 돌려준다.
 * 가입해 두고 로그인 화면으로 되돌려 보내면 방금 친 것을 또 치게 되므로,
 * 여기서 바로 로그인까지 이어 붙인다.
 *
 * 가입은 됐는데 로그인이 실패하는 경우를 따로 다루는 이유가 있다. 그때
 * "가입에 실패했습니다" 라고 하면 사용자는 다시 가입을 시도하고, 이미 있는
 * 계정이라 이메일 중복으로 막힌다. **무엇이 됐고 무엇이 안 됐는지**를 말해야
 * 다음 행동을 정할 수 있다.
 */

const ROLES = [
  { value: '', label: '선택 안 함' },
  { value: 'planning', label: '기획' },
  { value: 'design', label: '디자인' },
  { value: 'frontend', label: '프론트엔드' },
  { value: 'backend', label: '백엔드' },
]

export function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', project_role: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [signedUpOnly, setSignedUpOnly] = useState(false)

  const fields = fieldErrors(error)
  const banner = bannerMessage(error, fields)

  function set(key) {
    return (event) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }))
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) {
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
        project_role: form.project_role,
        // 브라우저 시간대를 그대로 보낸다. 이 서비스는 **시간대가 다른 팀**을
        // 전제로 하고, 참여자별 현지 시각을 서버가 계산해 내려준다.
        // 기본값(Asia/Seoul)으로 두면 해외 팀원의 시각이 전부 어긋난다.
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
        <div className="auth-card">
          <h1>가입은 됐습니다</h1>
          <p className="auth-lead">
            계정은 만들어졌는데 자동 로그인에서 막혔습니다.
            {error?.message ? ` ${error.message}` : ''}
            {' '}로그인 화면에서 방금 만든 계정으로 들어가십시오.
          </p>
          <button className="auth-submit" type="button" onClick={() => navigate('/login')}>
            로그인하러 가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Bordo 회원가입</h1>
        <p className="auth-lead">
          가입하면 바로 로그인됩니다. 팀 참여는 초대 코드로 따로 합니다.
        </p>

        {banner ? <p className="auth-banner" role="alert">{banner}</p> : null}

        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field" data-invalid={Boolean(fields.name)}>
            <label htmlFor="signup-name">이름</label>
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              value={form.name}
              disabled={busy}
              onChange={set('name')}
            />
            {/* 회의 플로우에서 대리인이 `{이름}의 Bordo` 로 불립니다. */}
            <p className="auth-hint">회의 화면과 대리인 이름에 그대로 쓰입니다.</p>
            {fields.name ? <p className="auth-error">{fields.name}</p> : null}
          </div>

          <div className="auth-field" data-invalid={Boolean(fields.email)}>
            <label htmlFor="signup-email">이메일</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="username"
              value={form.email}
              disabled={busy}
              onChange={set('email')}
            />
            {fields.email ? <p className="auth-error">{fields.email}</p> : null}
          </div>

          <div className="auth-field" data-invalid={Boolean(fields.password)}>
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              disabled={busy}
              onChange={set('password')}
            />
            <p className="auth-hint">8자 이상</p>
            {fields.password ? <p className="auth-error">{fields.password}</p> : null}
          </div>

          <div className="auth-field" data-invalid={Boolean(fields.project_role)}>
            <label htmlFor="signup-role">역할</label>
            <select
              id="signup-role"
              value={form.project_role}
              disabled={busy}
              onChange={set('project_role')}
            >
              {ROLES.map((role) => (
                <option key={role.value || 'none'} value={role.value}>{role.label}</option>
              ))}
            </select>
            {fields.project_role ? <p className="auth-error">{fields.project_role}</p> : null}
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={busy || !form.name || !form.email || form.password.length < 8}
          >
            {busy ? '만드는 중…' : '가입하고 시작하기'}
          </button>
        </form>

        <p className="auth-switch">
          이미 계정이 있으십니까?{' '}
          <button type="button" onClick={() => navigate('/login')}>로그인</button>
        </p>
      </div>
    </div>
  )
}
