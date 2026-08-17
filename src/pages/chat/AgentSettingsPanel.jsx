import { useEffect, useState } from 'react'

import {
  createPrompt,
  deletePrompt,
  fetchAgentSettings,
  fetchPrompts,
  patchAgentSettings,
} from './chat.data.js'
import { useResource } from '../../lib/useResource.js'

const settingItems = [
  {
    id: 'feasibility',
    title: '구현 가능성 판단',
    description: '구현 가능 여부를 Bordo가 대신 판단하고 답합니다.',
    enabled: true,
  },
  {
    id: 'schedule',
    title: '일정 수정 여부 판단',
    description: '일정 수정 여부를 Bordo가 대신 판단하고 수정합니다.',
    enabled: true,
  },
  {
    id: 'meeting-question',
    title: '회의 중간 질문',
    description: '회의 중간에 Bordo가 질문할 수 있습니다.',
    enabled: false,
  },
  {
    id: 'work-open',
    title: '작업 공개',
    description: '개인이 진행한 작업을 타 팀원에게 공개합니다.',
    enabled: false,
  },
  {
    id: 'plan-open',
    title: '계획 공개',
    description: '개인이 세운 계획을 타 팀원에게 공개합니다.',
    enabled: true,
  },
  {
    id: 'thought-open',
    title: '생각 공개',
    description: '개인의 생각을 타 팀원에게 공개합니다.',
    enabled: false,
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
 * 화면의 스위치 ↔ 서버의 설정 키.
 *
 * **화면은 6칸인데 서버는 4개다.** `작업 공개` · `계획 공개` · `생각 공개` 셋이
 * `disclose_work_plan_thought` 하나에 걸려 있어 **따로 끌 수 없다.**
 *
 * 셋을 각각 화면에서만 기억하게 두면, 끄고 새로고침했을 때 다시 켜져 있다.
 * 저장되지 않는 스위치는 저장된 척하는 스위치보다 낫다 — 그래서 같은 키에 묶어
 * 함께 움직이게 뒀다. 사용자는 셋이 하나라는 것을 눈으로 본다.
 *
 * 쪼갤지 합칠지는 디자인 확인이 필요해 이슈로 남겼다(frontend #11).
 */
const SETTING_KEY = {
  feasibility: 'mention_feasibility',
  schedule: 'allow_schedule_change',
  'meeting-question': 'allow_midmeeting_question',
  'work-open': 'disclose_work_plan_thought',
  'plan-open': 'disclose_work_plan_thought',
  'thought-open': 'disclose_work_plan_thought',
}

export function AgentSettingsPanel() {
  const { data: serverSettings, setData: setServerSettings } =
    useResource((signal) => fetchAgentSettings(signal))
  const promptsResource = useResource((signal) => fetchPrompts(signal))

  const settings = settingItems.map((item) => ({
    ...item,
    enabled: serverSettings ? Boolean(serverSettings[SETTING_KEY[item.id]]) : item.enabled,
  }))
  const prompts = (promptsResource.data?.results ?? []).map((p) => ({ id: p.id, text: p.body }))

  const [selectedPromptId, setSelectedPromptId] = useState(1)
  const [openPromptMenuId, setOpenPromptMenuId] = useState(null)
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
      setOpenPromptMenuId(null)
      showNotice('success')
    } catch (err) {
      // 입력한 것을 지우지 않는다. 지우면 다시 쓸 수밖에 없다.
      showNotice('error', err?.message)
    }
  }

  const removePrompt = async (promptId) => {
    setOpenPromptMenuId(null)
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
          <div className="settings-list">
            {settings.map((item) => (
              <div className="settings-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.description}</p>
                </div>
                <SettingSwitch
                  disabled={pendingKeys.includes(SETTING_KEY[item.id])}
                  enabled={item.enabled}
                  onToggle={() => toggleSetting(item.id)}
                />
              </div>
            ))}
          </div>
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
            {prompts.map((prompt, index) => (
              <article
                className={[
                  'prompt-card',
                  index > 0 ? 'tall' : '',
                  selectedPromptId === prompt.id ? 'selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={prompt.id}
                onClick={() => {
                  setSelectedPromptId(prompt.id)
                  setOpenPromptMenuId(null)
                }}
              >
                <p>{prompt.text}</p>
                <button
                  className={openPromptMenuId === prompt.id ? 'active' : ''}
                  type="button"
                  aria-label="시스템 프롬프트 메뉴"
                  aria-expanded={openPromptMenuId === prompt.id}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSelectedPromptId(prompt.id)
                    setOpenPromptMenuId((currentId) => (currentId === prompt.id ? null : prompt.id))
                  }}
                >
                  ⋮
                </button>
                {openPromptMenuId === prompt.id ? (
                  <div className="prompt-menu" onClick={(event) => event.stopPropagation()}>
                    <button type="button" onClick={() => removePrompt(prompt.id)}>
                      삭제
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
