import { useState } from 'react'

import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'
import { LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { useResource } from '../../lib/useResource.js'
import { logout } from '../../lib/api.js'
import {
  TONES,
  fetchAgentSettings,
  fetchMe,
  patchAgentSettings,
  patchMe,
} from './account.data.js'
import './account.css'

/**
 * 개인 설정.
 *
 * 이름 · 대리인 말투 · 기본 대리인 설정, 그리고 **로그아웃**.
 *
 * ## 왜 여기에 로그아웃이 있는가
 *
 * 로그아웃할 자리가 어디에도 없었다. 나가려면 개발자 도구로 토큰을 지워야 했다.
 * 계정에 관한 것이 모이는 자리가 여기이므로 함께 둔다.
 *
 * ## 자동 저장하지 않는 것과 하는 것
 *
 *     이름    직접 저장 버튼
 *     말투    고르는 즉시
 *     스위치  누르는 즉시
 *
 * 이름은 **치는 도중의 값이 계속 저장되면 안 된다.** `서` `서재` `서재민` 이
 * 전부 저장되고, 그 사이에 회의가 열리면 대리인이 `서의 Bordo` 로 불린다.
 * 고르는 것은 중간 상태가 없으므로 바로 보낸다.
 */

const SETTING_ROWS = [
  {
    key: 'mention_feasibility',
    title: '구현 가능성 판단',
    description: '구현 가능 여부를 대리인이 대신 판단하고 답합니다.',
  },
  {
    key: 'allow_schedule_change',
    title: '일정 수정 여부 판단',
    description: '일정 변경을 대리인이 제안할 수 있습니다. 확정은 언제나 본인이 합니다.',
  },
  {
    key: 'allow_midmeeting_question',
    title: '회의 중간 질문',
    description: '근거가 모자라면 대리인이 회의 중에 되물을 수 있습니다.',
  },
  {
    key: 'disclose_work_plan_thought',
    title: '작업 · 계획 · 생각 공개',
    description: '내 기록을 팀에게 공개합니다. 끄면 대리인이 이 내용을 밖으로 전하지 않습니다.',
  },
]

function Switch({ checked, disabled, onChange, label }) {
  return (
    <button
      className={checked ? 'account-switch on' : 'account-switch'}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <span className="account-switch-knob" />
    </button>
  )
}

export function AccountPage() {
  const me = useResource((signal) => fetchMe(signal))
  const agent = useResource((signal) => fetchAgentSettings(signal))

  const [draftName, setDraftName] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState([])

  const loading = (me.loading && !me.data) || (agent.loading && !agent.data)
  const failure = (me.error && !me.data) || (agent.error && !agent.data)

  // `null` 이면 아직 안 고쳤다는 뜻이라 서버 값을 보여 준다. 빈 문자열로 두면
  // 이름을 지운 상태와 구별할 수 없다.
  const name = draftName ?? me.data?.name ?? ''
  const nameChanged = draftName !== null && draftName.trim() !== (me.data?.name ?? '')

  const say = (type, message) => setNotice({ type, message })

  const lock = (key, run) => async () => {
    if (busy.includes(key)) {
      return
    }
    setBusy((c) => [...c, key])
    try {
      await run()
    } finally {
      setBusy((c) => c.filter((k) => k !== key))
    }
  }

  const saveName = lock('name', async () => {
    const next = name.trim()
    if (!next) {
      say('error', '이름을 비울 수 없습니다.')
      return
    }
    try {
      const saved = await patchMe({ name: next })
      me.setData(saved)
      setDraftName(null)
      say('success', '이름을 바꿨습니다.')
    } catch (err) {
      say('error', err?.message || '이름을 바꾸지 못했습니다.')
    }
  })

  const pickTone = (tone) => lock('tone', async () => {
    const before = agent.data?.tone
    if (tone === before) {
      return
    }
    // 먼저 칠하고 보낸다. 고른 것이 바로 안 바뀌면 안 눌린 줄 안다.
    agent.setData((c) => ({ ...(c ?? {}), tone }))
    try {
      agent.setData(await patchAgentSettings({ tone }))
      say('success', '말투를 바꿨습니다.')
    } catch (err) {
      agent.setData((c) => ({ ...(c ?? {}), tone: before }))
      say('error', err?.message || '말투를 바꾸지 못했습니다.')
    }
  })()

  const toggle = (key) => lock(key, async () => {
    const next = !agent.data?.[key]
    agent.setData((c) => ({ ...(c ?? {}), [key]: next }))
    try {
      agent.setData(await patchAgentSettings({ [key]: next }))
    } catch (err) {
      agent.setData((c) => ({ ...(c ?? {}), [key]: !next }))
      say('error', err?.message || '설정을 바꾸지 못했습니다.')
    }
  })()

  const signOut = async () => {
    await logout()
    // 통째로 다시 읽는다. 화면마다 들고 있던 데이터를 남겨 두면 로그인
    // 화면 뒤로 **이전 사람의 회의 제목이 비쳐 보인다.**
    window.location.assign('/')
  }

  if (loading) {
    return (
      <div className="account-page">
        <GlobalSidebar active="account" />
        <Loading label="설정을 불러오는 중입니다…" />
      </div>
    )
  }

  if (failure) {
    return (
      <div className="account-page">
        <GlobalSidebar active="account" />
        <LoadError
          error={me.error ?? agent.error}
          onRetry={() => { me.reload(); agent.reload() }}
        />
      </div>
    )
  }

  return (
    <div className="account-page">
      <GlobalSidebar active="account" />

      <main className="account-main">
        <header className="account-header">
          <h1>개인 설정</h1>
          <p>{me.data?.email}</p>
        </header>

        {notice ? (
          <p
            className={notice.type === 'success' ? 'account-notice' : 'account-notice error'}
            role="status"
            aria-live="polite"
          >
            {notice.message}
          </p>
        ) : null}

        <section className="account-section">
          <h2>이름</h2>
          {/* 회의 플로우에서 대리인이 `{이름}의 Bordo` 로 불립니다. */}
          <p className="account-hint">회의 화면과 대리인 이름에 그대로 쓰입니다.</p>
          <form
            className="account-name-row"
            onSubmit={(event) => { event.preventDefault(); saveName() }}
          >
            <input
              aria-label="이름"
              value={name}
              disabled={busy.includes('name')}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <button type="submit" disabled={!nameChanged || busy.includes('name')}>
              저장
            </button>
          </form>
        </section>

        <section className="account-section">
          <h2>대리인 말투</h2>
          <p className="account-hint">
            회의에서 대리인이 본인 대신 말합니다. 평소 쓰는 투와 너무 다르면
            본인이 말한 것으로 읽히지 않습니다.
          </p>
          <div className="account-tones" role="radiogroup" aria-label="대리인 말투">
            {TONES.map((tone) => {
              const picked = agent.data?.tone === tone.value

              return (
                <button
                  className={picked ? 'account-tone picked' : 'account-tone'}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  key={tone.value}
                  disabled={busy.includes('tone')}
                  onClick={() => pickTone(tone.value)}
                >
                  <strong>{tone.label}</strong>
                  {/* 라벨만으로는 뭐가 다른지 모른다. 같은 말을 세 투로 보여 준다. */}
                  <span>“{tone.example}”</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="account-section">
          <h2>기본 대리인 설정</h2>
          <p className="account-hint">
            대리인이 회의에서 어디까지 할지 정합니다. 만들어진 태스크·일정은
            언제나 승인 대기로 남고 확정은 본인이 합니다.
          </p>
          <div className="account-settings">
            {SETTING_ROWS.map((row) => (
              <div className="account-setting-row" key={row.key}>
                <div>
                  <strong>{row.title}</strong>
                  <span>{row.description}</span>
                </div>
                <Switch
                  checked={Boolean(agent.data?.[row.key])}
                  disabled={busy.includes(row.key)}
                  label={row.title}
                  onChange={() => toggle(row.key)}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="account-section account-danger">
          <button className="account-signout" type="button" onClick={signOut}>
            로그아웃
          </button>
        </section>
      </main>
    </div>
  )
}
