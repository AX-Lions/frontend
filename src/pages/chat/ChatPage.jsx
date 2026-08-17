import { useEffect, useMemo, useState } from 'react'
import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'

import './chat.css'
import { icons } from './chat.icons.js'
import {
  createPrompt,
  deletePrompt,
  fetchAgentSettings,
  fetchImportant,
  fetchMessages,
  fetchPrompts,
  fetchSidebar,
  markRead,
  patchAgentSettings,
  sendMessage,
  toPreview,
  toTeamRows,
} from './chat.data.js'
import { formatTime, withDayDividers } from './chat.format.js'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

function IconButton({ children, label, active = false, onClick }) {
  return (
    <button
      className={active ? 'chat-icon-button active' : 'chat-icon-button'}
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function Icon({ src, alt = '', className = 'ui-icon' }) {
  return <img className={className} src={src} alt={alt} />
}

function RequestIcon({ muted = false, small = false }) {
  return (
    <Icon
      className={small ? 'request-icon small' : 'request-icon'}
      src={muted ? icons.requestSmall : icons.request}
    />
  )
}

function BordoAvatar({ small = false }) {
  return (
    <span className={small ? 'bordo-avatar small' : 'bordo-avatar'} aria-hidden="true">
      <Icon className="bordo-avatar-icon" src={icons.profile} />
    </span>
  )
}

function AvatarStack() {
  return (
    <span className="avatar-stack" aria-hidden="true">
      <img src="/flowchart/profile-1.jpeg" alt="" />
      <img src="/flowchart/profile-2.jpeg" alt="" />
      <img src="/flowchart/profile-3.jpeg" alt="" />
      <BordoAvatar small />
    </span>
  )
}

function ChatPreview({ chat, selected, onSelect }) {
  return (
    <button className={selected ? 'chat-preview selected' : 'chat-preview'} type="button" onClick={onSelect}>
      <div className="chat-preview-left">
        {chat.bordo ? (
          <BordoAvatar />
        ) : chat.stacked || !chat.avatar ? (
          // 아바타를 아직 안 올린 사람이 많다. `src` 가 비면 브라우저가 깨진
          // 이미지 아이콘을 그리므로, 없으면 겹친 원으로 대신한다.
          <AvatarStack />
        ) : (
          <img className="chat-avatar" src={chat.avatar} alt="" />
        )}
        <div className="chat-preview-copy">
          <div className="chat-preview-title">
            <strong>{chat.name}</strong>
            {chat.context ? <span>{chat.context}</span> : null}
            {chat.marked ? <RequestIcon small /> : null}
            {chat.mutedRequest ? <RequestIcon muted small /> : null}
          </div>
          <p>{chat.message}</p>
        </div>
      </div>
      <div className="chat-preview-meta">
        <time>{formatTime(chat.sentAt)}</time>
        {chat.unread ? <span>{chat.unread}</span> : null}
      </div>
    </button>
  )
}

function TeamHeader({ name, marked, nested = false, open = true, onToggle }) {
  return (
    <button
      className={nested ? 'team-chat-header nested' : 'team-chat-header'}
      type="button"
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="team-name">
        <strong>{name}</strong>
        {marked ? <RequestIcon small /> : null}
      </span>
      <span className="team-actions">
        <span className="team-shortcut">모두 채팅 바로가기</span>
        <Icon className={open ? 'ui-icon chevron open' : 'ui-icon chevron'} src={icons.expandDown} />
      </span>
    </button>
  )
}

/**
 * 접힘 상태를 id 로 기억한다.
 *
 * 팀·프로젝트가 몇 개인지 서버가 정하므로 `useState` 를 항목마다 둘 수 없다.
 * **처음에는 모두 펼친다** — 채팅 목록에서 접혀 있는 것은 없는 것과 같아서,
 * 사용자가 방을 못 찾는다.
 */
function useCollapsed() {
  const [closed, setClosed] = useState([])
  return {
    isOpen: (id) => !closed.includes(id),
    toggle: (id) => setClosed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])),
  }
}

function ChatListPanel({ sidebar, importantRooms, selectedChatId, onSelectChat, onOpenSettings }) {
  const [promptVisible, setPromptVisible] = useState(true)
  const [tool, setTool] = useState('')
  const [importantOpen, setImportantOpen] = useState(true)
  const groups = useCollapsed()

  const primaryChat = sidebar?.my_agent_room
  const teams = toTeamRows(sidebar)

  const toggleTool = (nextTool) => {
    setTool((current) => (current === nextTool ? '' : nextTool))
  }

  return (
    <aside className="chat-list-panel" aria-label="채팅 목록">
      <header className="chat-list-header">
        <h1>채팅</h1>
        <div className="chat-list-tools">
          <IconButton label="검색" active={tool === 'search'} onClick={() => toggleTool('search')}>
            <Icon src={icons.search} />
          </IconButton>
          <IconButton label="채팅 생성" active={tool === 'create'} onClick={() => toggleTool('create')}>
            <Icon src={icons.add} />
          </IconButton>
          <IconButton
            label="AI 대리인 설정"
            active={tool === 'ai'}
            onClick={() => {
              toggleTool('ai')
              onOpenSettings()
            }}
          >
            <Icon src={icons.ai} />
          </IconButton>
          <IconButton
            label="채팅 설정"
            active={tool === 'settings'}
            onClick={() => {
              toggleTool('settings')
              onOpenSettings()
            }}
          >
            <Icon src={icons.setting} />
          </IconButton>
        </div>
      </header>

      {promptVisible ? (
        <div className="chat-tip">
          <p>
            당신의 Bordo를 입맛에 맞게
            <br />
            조정해보세요!
          </p>
          <button type="button" aria-label="닫기" onClick={() => setPromptVisible(false)}>
            ×
          </button>
        </div>
      ) : null}

      <div className="chat-list-scroll">
        {primaryChat ? (
          <button
            className={selectedChatId === primaryChat.id ? 'my-bordo-card selected' : 'my-bordo-card'}
            type="button"
            onClick={() => onSelectChat(primaryChat.id)}
          >
            <div>
              <h2>
                <Icon className="ai-title-icon" src={icons.aiIcon} />
                {primaryChat.title}
              </h2>
              <p>{primaryChat.last_message
                ? primaryChat.last_message.preview
                : '아직 나눈 이야기가 없습니다.'}</p>
            </div>
            <time>{formatTime(primaryChat.last_message?.sent_at)}</time>
          </button>
        ) : null}

        <section className="chat-list-section">
          <button
            className="section-heading interactive"
            type="button"
            aria-expanded={importantOpen}
            onClick={() => setImportantOpen((open) => !open)}
          >
            <h2>
              중요 채팅 <RequestIcon small />
            </h2>
            <Icon className={importantOpen ? 'ui-icon chevron open' : 'ui-icon chevron'} src={icons.expandDown} />
          </button>
          {importantOpen && importantRooms.length === 0 ? (
            <p className="chat-list-empty">중요 표시된 채팅이 없습니다.</p>
          ) : null}
          {importantOpen
            ? importantRooms.map((chat) => (
                <ChatPreview
                  chat={chat}
                  key={chat.id}
                  selected={selectedChatId === chat.id}
                  onSelect={() => onSelectChat(chat.id)}
                />
              ))
            : null}
        </section>

        {/*
          서버가 `팀 → 프로젝트 → 방` 3층으로 준다. 목에서는 이 층이 고정된
          이름으로 박혀 있었다(`AX Lions` · `멋사 아이디어톤`). 몇 개가 올지
          서버가 정하므로 접힘 상태도 id 로 기억한다.
        */}
        {teams.map((team) => (
          <section className="team-chat-group" key={team.id}>
            <TeamHeader
              name={team.name}
              marked={team.marked}
              open={groups.isOpen(team.id)}
              onToggle={() => groups.toggle(team.id)}
            />
            {groups.isOpen(team.id) ? (
              <div className="nested-team">
                {team.projects.map((project) => (
                  <div className="project-team" key={project.id}>
                    <button
                      className="project-title"
                      type="button"
                      aria-expanded={groups.isOpen(project.id)}
                      onClick={() => groups.toggle(project.id)}
                    >
                      <strong>{project.name}</strong>
                      <Icon
                        className={groups.isOpen(project.id) ? 'ui-icon chevron open' : 'ui-icon chevron'}
                        src={icons.expandDown}
                      />
                    </button>
                    {groups.isOpen(project.id) ? (
                      <div className="project-chat-list">
                        {project.rooms.length === 0 ? (
                          <p className="chat-list-empty">방이 없습니다.</p>
                        ) : project.rooms.map((chat) => (
                          <ChatPreview
                            chat={chat}
                            key={chat.id}
                            selected={selectedChatId === chat.id}
                            onSelect={() => onSelectChat(chat.id)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </aside>
  )
}

function ChatMessage({ row }) {
  if (row.kind === 'day') {
    return (
      <button className="date-divider" type="button">
        {row.label}
        <Icon src={icons.expandRight} />
      </button>
    )
  }

  const { message } = row
  const time = formatTime(message.sent_at)

  if (message.is_mine) {
    return (
      <div className="message-row me">
        <time>{time}</time>
        <p className="message-bubble orange">{message.body}</p>
      </div>
    )
  }

  return (
    <div className="message-row bot">
      {/* 대리인이 보낸 것과 사람이 보낸 것을 가른다. 화면에서 대리인은
          `{이름}의 Bordo` 로 불리고 아바타도 다르다. */}
      {message.sender?.is_agent || !message.sender?.avatar_url ? (
        <BordoAvatar />
      ) : (
        <img className="chat-avatar" src={message.sender.avatar_url} alt="" />
      )}
      <div>
        <strong>{message.sender?.name ?? ''}</strong>
        <span>
          <p className="message-bubble gray">{message.body}</p>
          <time>{time}</time>
        </span>
      </div>
    </div>
  )
}

function ChatRoom({ room, roomId, onClose }) {
  const [roomTool, setRoomTool] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const canSend = messageText.trim().length > 0 && !sending && Boolean(roomId)

  const { data, error, loading, setData } = useResource(
    (signal) => (roomId ? fetchMessages(roomId, {}, signal) : Promise.resolve(null)),
    [roomId],
  )

  const rows = useMemo(() => withDayDividers(data?.results ?? []), [data])

  const toggleRoomTool = (nextTool) => {
    setRoomTool((current) => (current === nextTool ? '' : nextTool))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSend) {
      return
    }

    const body = messageText.trim()
    setSending(true)
    setSendError('')
    try {
      // 중복 전송은 도메인 키로 막는다. `Idempotency-Key` 는 계약에만 있고
      // 아직 동작하지 않는다.
      const sent = await sendMessage(roomId, { body, clientMessageId: crypto.randomUUID() })
      setData((current) => ({
        ...(current ?? { results: [] }),
        results: [...(current?.results ?? []), sent],
      }))
      setMessageText('')
    } catch (err) {
      // 입력한 것을 지우지 않는다. 지우면 다시 칠 수밖에 없다.
      setSendError(err?.message || '보내지 못했습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="chat-room" aria-label="채팅창">
      <header className="chat-room-header">
        {/*
          `onClick` 이 없어 **눌러도 아무 일도 일어나지 않았다.** 화살표가 있으니
          사용자는 눌러 보고, 안 되면 화면이 멈춘 줄 안다.

          대화를 닫아 목록만 남긴다. 브라우저 뒤로가기를 부르면 채팅 화면 자체를
          떠나 버리는데, 이 자리의 화살표가 뜻하는 것은 **대화에서 나오기**다.
        */}
        <button className="back-button" type="button" aria-label="뒤로가기" onClick={onClose}>
          <Icon src={icons.expandLeft} />
        </button>
        <div className="chat-room-title">
          <strong>{room?.name ?? ''}</strong>
          <span>{room?.context ?? ''}</span>
        </div>
        <div className="chat-room-actions">
          <IconButton label="검색" active={roomTool === 'search'} onClick={() => toggleRoomTool('search')}>
            <Icon src={icons.search} />
          </IconButton>
          <IconButton label="전체 화면" active={roomTool === 'fullscreen'} onClick={() => toggleRoomTool('fullscreen')}>
            <Icon src={icons.fullscreen} />
          </IconButton>
          <IconButton label="메뉴" active={roomTool === 'menu'} onClick={() => toggleRoomTool('menu')}>
            <Icon src={icons.menu} />
          </IconButton>
        </div>
      </header>

      <div className="chat-message-scroll">
        {!roomId ? (
          <Empty>왼쪽에서 대화를 고르십시오.</Empty>
        ) : loading && !data ? (
          <Loading label="대화를 불러오는 중입니다…" />
        ) : error && !data ? (
          <LoadError error={error} />
        ) : rows.length === 0 ? (
          <Empty>아직 나눈 이야기가 없습니다.</Empty>
        ) : rows.map((row) => (
          <ChatMessage key={row.id} row={row} />
        ))}
      </div>

      {sendError ? <p className="chat-send-error" role="alert">{sendError}</p> : null}

      <form className={canSend ? 'chat-composer can-send' : 'chat-composer'} onSubmit={submit}>
        <button type="button" aria-label="첨부파일">
          <Icon src={icons.addSmall} />
        </button>
        <button type="button" aria-label="설정">
          <Icon src={icons.filter} />
        </button>
        <input
          aria-label="채팅 입력"
          placeholder="채팅을 입력하세요..."
          value={messageText}
          disabled={!roomId}
          onChange={(event) => setMessageText(event.target.value)}
        />
        <button className="send" type="submit" aria-label="전송" disabled={!canSend}>
          <Icon src={icons.send} />
        </button>
      </form>
    </main>
  )
}

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

function SettingsPanel() {
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

function BordoSettingsPage({ onBack }) {
  const handleNavigate = (event, item) => {
    if (item.id !== 'chat') {
      return
    }

    event.preventDefault()
    onBack()
  }

  return (
    <div className="settings-page">
      <GlobalSidebar active="chat" onNavigate={handleNavigate} />
      <SettingsPanel />
      <main className="settings-brand" aria-label="설정 미리보기">
        <p>Bordo</p>
      </main>
    </div>
  )
}

export function ChatPage() {
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [view, setView] = useState('chat')

  const sidebar = useResource((signal) => fetchSidebar(signal))
  const important = useResource((signal) => fetchImportant(signal))

  const importantRooms = useMemo(
    // 중요 채팅은 **메시지 목록**으로 온다. 같은 방의 메시지가 여럿이면 방이
    // 여러 번 나오므로 방 기준으로 합친다. 미리보기는 그 방의 가장 최근 것이다.
    () => {
      const seen = new Map()
      ;(important.data?.results ?? []).forEach((row) => {
        if (!seen.has(row.room.id)) {
          seen.set(row.room.id, {
            ...toPreview(row.room),
            message: `${row.message.sender.name}: ${row.message.body}`,
            sentAt: row.message.sent_at,
            marked: true,
          })
        }
      })
      return [...seen.values()]
    },
    [important.data],
  )

  const openRoom = useMemo(() => {
    const all = [
      ...(sidebar.data?.my_agent_room ? [toPreview(sidebar.data.my_agent_room)] : []),
      ...importantRooms,
      ...toTeamRows(sidebar.data).flatMap((t) => t.projects.flatMap((p) => p.rooms)),
    ]
    return all.find((room) => room.id === selectedChatId) ?? null
  }, [sidebar.data, importantRooms, selectedChatId])

  // 방을 열면 읽음 워터마크를 올린다. 실패해도 대화는 보여야 하므로 삼킨다 —
  // 미읽음 숫자가 잠깐 안 맞는 것이 대화가 안 열리는 것보다 낫다.
  useEffect(() => {
    if (selectedChatId) {
      markRead(selectedChatId).catch(() => {})
    }
  }, [selectedChatId])

  if (view === 'settings') {
    return <BordoSettingsPage onBack={() => setView('chat')} />
  }

  if (sidebar.loading && !sidebar.data) {
    return (
      <div className="chat-page">
        <GlobalSidebar active="chat" />
        <Loading label="채팅 목록을 불러오는 중입니다…" />
      </div>
    )
  }

  if (sidebar.error && !sidebar.data) {
    return (
      <div className="chat-page">
        <GlobalSidebar active="chat" />
        <LoadError error={sidebar.error} onRetry={sidebar.reload} />
      </div>
    )
  }

  return (
    <div className="chat-page">
      <GlobalSidebar active="chat" />
      <ChatListPanel
        importantRooms={importantRooms}
        selectedChatId={selectedChatId}
        sidebar={sidebar.data}
        onSelectChat={setSelectedChatId}
        onOpenSettings={() => setView('settings')}
      />
      <ChatRoom room={openRoom} roomId={selectedChatId} onClose={() => setSelectedChatId(null)} />
    </div>
  )
}
