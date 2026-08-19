import { useEffect, useState } from 'react'

import {
  createPrompt,
  deletePrompt,
  fetchAgentSettings,
  fetchPrompts,
  patchAgentSettings,
  updatePrompt,
} from './chat.data.js'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

/**
 * 화면에 그릴 스위치와 그 설명.
 *
 * **켜짐/꺼짐 기본값을 여기 두지 않는다.** 예전에는 항목마다 `enabled` 가 박혀
 * 있어서, 서버 값을 못 읽었을 때 그 값이 그대로 그려졌다. 사용자는 자기가
 * 그렇게 설정해 둔 줄 알지만 실제 서버 값은 정반대일 수 있다 — **화면이 남의
 * 설정을 지어내는 것**이다.
 *
 * 지금은 서버 값이 없으면 스위치를 아예 안 그린다.
 */
const settingItems = [
  {
    id: 'feasibility',
    title: '구현 가능성 판단',
    description: '구현 가능 여부를 Bordo가 대신 판단하고 답합니다.',
  },
  {
    id: 'schedule',
    title: '일정 수정 여부 판단',
    description: '일정 수정 여부를 Bordo가 대신 판단하고 수정합니다.',
  },
  {
    id: 'meeting-question',
    title: '회의 중간 질문',
    description: '회의 중간에 Bordo가 질문할 수 있습니다.',
  },
  {
    id: 'work-open',
    title: '작업 공개',
    description: '개인이 진행한 작업을 타 팀원에게 공개합니다.',
  },
  {
    id: 'plan-open',
    title: '계획 공개',
    description: '개인이 세운 계획을 타 팀원에게 공개합니다.',
  },
  {
    id: 'thought-open',
    title: '생각 공개',
    description: '개인의 생각을 타 팀원에게 공개합니다.',
  },
]

function SettingSwitch({ enabled, disabled = false, onToggle }) {
  return (
    <button className={enabled ? "settings-switch on" : "settings-switch"} type="button" aria-pressed={enabled} disabled={disabled} onClick={onToggle}>
      <span className="settings-switch-knob" />
      <span className="settings-switch-label">{enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}

/**
 * 화면의 스위치 ↔ 서버의 설정 키. **여섯씩 1:1 이다.**
 *
 * 전에는 공개 셋이 `disclose_work_plan_thought` 하나에 걸려 있어, 하나를 끄면
 * 나머지 둘이 같이 꺼졌다. 화면은 셋을 따로 정할 수 있다고 말해 놓고 그러지
 * 못했다 — **사용자는 껐다고 생각한 것이 계속 나갔다.**
 *
 * 서버가 셋으로 갈렸다(backend #88). 옛 한 칸은 지난 실행의 스냅샷을 읽기 위한
 * 호환용으로만 남아 있고, 지금 판정에 쓰이는 것은 낱개 셋이다.
 *
 * ## 왜 합치지 않고 나누는가
 *
 * 회의별로 「작업만 켜고 계획은 끄기」 가 실제로 저장된다(준비 화면의 자료 범위).
 * 화면을 한 칸으로 합치면 그 상태를 **표현할 수 없다.**
 *
 * 옛 한 칸은 「하나라도 켜져 있으면 참」 이라 섞인 상태에서 ON 으로 보이는데,
 * 그것을 껐다 켜면 셋을 전부 ON 으로 되돌린다. 꺼 뒀던 계획 공개가 조용히
 * 켜지는 셈이라, 고치려던 문제와 같은 종류가 방향만 바뀌어 남는다.
 */
const SETTING_KEY = {
  feasibility: 'mention_feasibility',
  schedule: 'allow_schedule_change',
  'meeting-question': 'allow_midmeeting_question',
  'work-open': 'disclose_work',
  'plan-open': 'disclose_plan',
  'thought-open': 'disclose_thought',
}

function PromptCard({ prompt, selected, onSelect, onSave, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(prompt.body)

  if (editing) {
    return (
      <form
        className="prompt-card editing"
        onSubmit={(event) => {
          event.preventDefault()
          const body = draft.trim()
          if (!body) {
            return
          }
          onSave(prompt.id, body)
          setEditing(false)
        }}
      >
        <textarea
          aria-label="시스템 프롬프트 수정"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="prompt-card-actions">
          <button type="submit" disabled={!draft.trim()}>저장</button>
          <button type="button" onClick={() => { setDraft(prompt.body); setEditing(false) }}>취소</button>
        </div>
      </form>
    )
  }

  return (
    <article
      className={selected ? 'prompt-card selected' : 'prompt-card'}
      onClick={() => { onSelect(prompt.id); setMenuOpen(false) }}
    >
      <p>{prompt.body}</p>
      <button
        className={menuOpen ? 'active' : ''}
        type="button"
        aria-label="시스템 프롬프트 메뉴"
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(prompt.id)
          setMenuOpen((open) => !open)
        }}
      >
        ⋮
      </button>
      {menuOpen ? (
        <div className="prompt-menu" onClick={(event) => event.stopPropagation()}>
          {/* 서버에 `PATCH /me/agent/prompts/{id}` 가 있는데 화면에 고칠 길이
              없었다. 한 글자 고치려고 지우고 다시 쓰면 순서가 바뀐다. */}
          <button type="button" onClick={() => { setDraft(prompt.body); setEditing(true); setMenuOpen(false) }}>
            수정
          </button>
          <button type="button" onClick={() => { setMenuOpen(false); onRemove(prompt.id) }}>
            삭제
          </button>
        </div>
      ) : null}
    </article>
  )
}

export function AgentSettingsPanel({ onBack }) {
  const settingsResource = useResource((signal) => fetchAgentSettings(signal), [], { cacheKey: 'agent-settings' })
  const promptsResource = useResource((signal) => fetchPrompts(signal), [], { cacheKey: 'agent-prompts' })
  const { data: serverSettings, setData: setServerSettings } = settingsResource

  const prompts = promptsResource.data?.results ?? []

  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [promptText, setPromptText] = useState('')
  const [notice, setNotice] = useState(null)
  const [pendingKeys, setPendingKeys] = useState([])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timerId = window.setTimeout(() => setNotice(null), 1800)

    return () => window.clearTimeout(timerId)
  }, [notice])

  const showNotice = (type, message) => {
    setNotice({
      type,
      // 서버가 사유를 줬으면 그것을 그대로 쓴다. 화면이 문구를 새로 만들면
      // 같은 상황에 두 가지 안내가 생긴다.
      message: message ?? (type === 'success'
        ? '성공적으로 수정되었습니다.'
        : '오류가 발생했습니다. 다시 시도해주세요.'),
    })
  }

  const toggleSetting = async (settingId) => {
    const key = SETTING_KEY[settingId]

    // 보내는 중인 키는 다시 받지 않는다.
    //
    // 빠르게 두 번 누르면 PATCH 두 개가 순서 없이 오간다. 늦게 도착한 쪽이
    // 서버의 마지막 값이 되는데 화면은 두 번째 클릭 기준으로 그려져 있어,
    // **서버와 화면이 어긋난 채 새로고침 전까지 남는다.**
    if (pendingKeys.includes(key)) {
      return
    }

    const next = !serverSettings?.[key]
    setPendingKeys((c) => [...c, key])

    // 먼저 칠하고 보낸다. 스위치는 누른 즉시 움직여야 눌린 줄 안다.
    setServerSettings((current) => ({ ...(current ?? {}), [key]: next }))
    try {
      const saved = await patchAgentSettings({ [key]: next })
      // 서버가 돌려준 값으로 덮는다. `active_version` 이 함께 올라간다.
      //
      // **GET 과 PATCH 의 응답 모양이 다르다.** GET 은 설정을 그대로 주는데
      // PATCH 는 `{settings, previous_version, changed}` 로 감싸서 준다.
      // 감싼 것을 그대로 담으면 모든 키가 `undefined` 가 되어 **스위치 여섯 개가
      // 전부 OFF 로 보인다** — 서버 값은 멀쩡한데 화면만 거짓말을 한다.
      setServerSettings(saved?.settings ?? saved)
      showNotice('success')
    } catch (err) {
      setServerSettings((current) => ({ ...(current ?? {}), [key]: !next }))
      showNotice('error', err?.message)
    } finally {
      setPendingKeys((c) => c.filter((k) => k !== key))
    }
  }

  const addPrompt = async (event) => {
    event.preventDefault()
    const trimmedPrompt = promptText.trim()

    if (!trimmedPrompt) {
      showNotice('error', '내용을 입력하십시오.')
      return
    }

    try {
      const created = await createPrompt(trimmedPrompt)
      promptsResource.setData((current) => ({
        ...(current ?? {}),
        results: [created, ...(current?.results ?? [])],
      }))
      setPromptText('')
      setSelectedPromptId(created.id)
      showNotice('success')
    } catch (err) {
      // 입력한 것을 지우지 않는다. 지우면 다시 쓸 수밖에 없다.
      showNotice('error', err?.message)
    }
  }

  const savePrompt = async (promptId, body) => {
    try {
      const saved = await updatePrompt(promptId, body)
      promptsResource.setData((current) => ({
        ...(current ?? {}),
        results: (current?.results ?? []).map((p) => (p.id === promptId ? saved : p)),
      }))
      showNotice('success')
    } catch (err) {
      showNotice('error', err?.message)
    }
  }

  const removePrompt = async (promptId) => {
    try {
      await deletePrompt(promptId)
      promptsResource.setData((current) => ({
        ...(current ?? {}),
        results: (current?.results ?? []).filter((p) => p.id !== promptId),
      }))
      setSelectedPromptId((currentId) => (currentId === promptId ? null : currentId))
      showNotice('success')
    } catch (err) {
      showNotice('error', err?.message)
    }
  }

  return (
    <aside className="settings-panel" aria-label="Bordo 설정">
      <header className="settings-header">
        {/*
          **나가는 길을 제목 옆에 둔다** (시안 `586:7774`).

          이 화면은 채팅을 통째로 덮는데 나가는 길이 왼쪽 레일의 `채팅` 아이콘
          하나뿐이었다. 설정에 들어온 사람이 그 아이콘을 「돌아가기」로 읽을
          이유가 없고, 아이콘 줄은 화면이 좁아지면 접히기까지 한다.
        */}
        {onBack ? (
          <button
            className="settings-back"
            type="button"
            aria-label="채팅으로 돌아가기"
            data-tip="채팅으로 돌아가기"
            onClick={onBack}
          >
            ←
          </button>
        ) : null}
        <h1>Bordo 설정</h1>
      </header>

      {notice ? (
        <div className="settings-alert-wrap" role="status" aria-live="polite">
          <p className={notice.type === 'success' ? 'settings-alert success' : 'settings-alert error'}>
            {notice.message}
          </p>
        </div>
      ) : null}

      <div className="settings-scroll">
        <section className="settings-section">
          <h2>세부 설정</h2>
          {/*
            서버 값을 모르는 동안에는 스위치를 그리지 않는다.

            예전에는 목 기본값(`구현 가능성 판단` ON 등)이 그려졌다. 사용자는
            자기 설정을 보고 있다고 믿는데 서버 값은 정반대일 수 있고, 그러면
            **끄려고 누른 스위치가 오히려 켜진다.**
          */}
          {settingsResource.loading && !serverSettings ? (
            <Loading label="대리인 설정을 불러오는 중입니다…" />
          ) : settingsResource.error && !serverSettings ? (
            <LoadError error={settingsResource.error} onRetry={settingsResource.reload} />
          ) : (
            <div className="settings-list">
              {settingItems.map((item) => (
                <div className="settings-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <SettingSwitch
                    disabled={pendingKeys.includes(SETTING_KEY[item.id])}
                    enabled={Boolean(serverSettings?.[SETTING_KEY[item.id]])}
                    onToggle={() => toggleSetting(item.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="settings-section prompt-section">
          <h2>시스템 프롬프트</h2>
          <form className={promptText.trim() ? 'prompt-input-card has-value' : 'prompt-input-card'} onSubmit={addPrompt}>
            <textarea
              aria-label="시스템 프롬프트 입력"
              placeholder="원하시는 설정을 입력해주세요."
              value={promptText}
              onChange={(event) => setPromptText(event.target.value)}
            />
            <button type="submit" aria-label="시스템 프롬프트 추가">
              ↳
            </button>
          </form>
          <div className="prompt-card-list">
            {promptsResource.loading && !promptsResource.data ? (
              <Loading label="프롬프트를 불러오는 중입니다…" />
            ) : promptsResource.error && !promptsResource.data ? (
              <LoadError error={promptsResource.error} onRetry={promptsResource.reload} />
            ) : prompts.length === 0 ? (
              <Empty>아직 넣어 둔 지시가 없습니다.</Empty>
            ) : prompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                selected={selectedPromptId === prompt.id}
                onRemove={removePrompt}
                onSave={savePrompt}
                onSelect={setSelectedPromptId}
              />
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
