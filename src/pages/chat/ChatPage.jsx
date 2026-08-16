import { useEffect, useState } from 'react'
import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'

import './chat.css'
import { icons, importantChats, messages, primaryChat, projectChats, teamRows } from './chat.mock.js'

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
        ) : chat.stacked ? (
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
        <time>{chat.time}</time>
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

function ChatListPanel({ selectedChatId, onSelectChat, onOpenSettings }) {
  const [promptVisible, setPromptVisible] = useState(true)
  const [tool, setTool] = useState('')
  const [importantOpen, setImportantOpen] = useState(true)
  const [axOpen, setAxOpen] = useState(true)
  const [ideaOpen, setIdeaOpen] = useState(true)
  const [projectOpen, setProjectOpen] = useState(true)

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
            <p>{primaryChat.message}</p>
          </div>
          <time>{primaryChat.time}</time>
        </button>

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
          {importantOpen
            ? importantChats.map((chat) => (
                <ChatPreview
                  chat={chat}
                  key={chat.id}
                  selected={selectedChatId === chat.id}
                  onSelect={() => onSelectChat(chat.id)}
                />
              ))
            : null}
        </section>

        <section className="team-chat-group">
          <TeamHeader name="AX Lions" open={axOpen} onToggle={() => setAxOpen((open) => !open)} />
          {axOpen ? (
            <div className="nested-team">
              <TeamHeader
                name="멋사 아이디어톤"
                nested
                open={ideaOpen}
                onToggle={() => setIdeaOpen((open) => !open)}
              />
              {ideaOpen ? (
                <div className="project-team">
                  <button
                    className="project-title"
                    type="button"
                    aria-expanded={projectOpen}
                    onClick={() => setProjectOpen((open) => !open)}
                  >
                    <strong>멋사 중앙해커톤</strong>
                    <Icon className={projectOpen ? 'ui-icon chevron open' : 'ui-icon chevron'} src={icons.expandDown} />
                  </button>
                  {projectOpen ? (
                    <div className="project-chat-list">
                      {projectChats.map((chat) => (
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
              ) : null}
            </div>
          ) : null}
          <div className="other-team-list">
            {teamRows.map((team) => (
              <TeamHeader key={team.id} name={team.name} marked={team.marked} open={false} />
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}

function ChatMessage({ message }) {
  if (message.type === 'date') {
    return (
      <button className="date-divider" type="button">
        {message.label}
        <Icon src={icons.expandRight} />
      </button>
    )
  }

  if (message.type === 'me') {
    return (
      <div className="message-row me">
        <time>{message.time}</time>
        <p className={message.large ? 'message-bubble orange large' : 'message-bubble orange'}>{message.text}</p>
      </div>
    )
  }

  return (
    <div className="message-row bot">
      <BordoAvatar />
      <div>
        <strong>{message.author}</strong>
        <span>
          <i className="message-bubble gray" />
          <time>{message.time}</time>
        </span>
      </div>
    </div>
  )
}

function ChatRoom() {
  const [roomTool, setRoomTool] = useState('')
  const [messageText, setMessageText] = useState('')
  const canSend = messageText.trim().length > 0

  const toggleRoomTool = (nextTool) => {
    setRoomTool((current) => (current === nextTool ? '' : nextTool))
  }

  return (
    <main className="chat-room" aria-label="채팅창">
      <header className="chat-room-header">
        <button className="back-button" type="button" aria-label="뒤로가기">
          <Icon src={icons.expandLeft} />
        </button>
        <div className="chat-room-title">
          <strong>임수연의 Bordo</strong>
          <span>멋사 중앙해커톤</span>
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
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      <form className={canSend ? 'chat-composer can-send' : 'chat-composer'} onSubmit={(event) => event.preventDefault()}>
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

const promptCards = [
  '내가 이건 말하면 안돼라고 상단에 입력한 메시지들은 모두 개인적인 내용이니까 다른 사람에게 공유하면 안돼',
  '내가 이건 말하면 안돼라고 상단에 입력한 메시지들은 모두 개인적인 내용이니까 다른 사람에게 공유하면 안돼',
]

function SettingSwitch({ enabled, onToggle }) {
  return (
    <button className={enabled ? 'settings-switch on' : 'settings-switch'} type="button" aria-pressed={enabled} onClick={onToggle}>
      <span className="settings-switch-knob" />
      <span className="settings-switch-label">{enabled ? 'ON' : 'OFF'}</span>
    </button>
  )
}

function SettingsPanel() {
  const [settings, setSettings] = useState(settingItems)
  const [prompts, setPrompts] = useState(() => promptCards.map((text, index) => ({ id: index + 1, text })))
  const [selectedPromptId, setSelectedPromptId] = useState(1)
  const [openPromptMenuId, setOpenPromptMenuId] = useState(null)
  const [promptText, setPromptText] = useState('')
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timerId = window.setTimeout(() => setNotice(null), 1800)

    return () => window.clearTimeout(timerId)
  }, [notice])

  const showNotice = (type) => {
    setNotice({
      type,
      message: type === 'success' ? '성공적으로 수정되었습니다.' : '오류가 발생했습니다. 다시 시도해주세요.',
    })
  }

  const toggleSetting = (settingId) => {
    setSettings((currentSettings) =>
      currentSettings.map((setting) =>
        setting.id === settingId ? { ...setting, enabled: !setting.enabled } : setting,
      ),
    )
    showNotice('success')
  }

  const addPrompt = (event) => {
    event.preventDefault()
    const trimmedPrompt = promptText.trim()

    if (!trimmedPrompt) {
      showNotice('error')
      return
    }

    const nextPrompt = {
      id: Date.now(),
      text: trimmedPrompt,
    }

    setPrompts((currentPrompts) => [nextPrompt, ...currentPrompts])
    setPromptText('')
    setSelectedPromptId(nextPrompt.id)
    setOpenPromptMenuId(null)
    showNotice('success')
  }

  const deletePrompt = (promptId) => {
    setPrompts((currentPrompts) => currentPrompts.filter((prompt) => prompt.id !== promptId))
    setSelectedPromptId((currentId) => (currentId === promptId ? null : currentId))
    setOpenPromptMenuId(null)
    showNotice('success')
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
                <SettingSwitch enabled={item.enabled} onToggle={() => toggleSetting(item.id)} />
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
                    <button type="button" onClick={() => deletePrompt(prompt.id)}>
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
  const [selectedChatId, setSelectedChatId] = useState('bordo')
  const [view, setView] = useState('chat')

  if (view === 'settings') {
    return <BordoSettingsPage onBack={() => setView('chat')} />
  }

  return (
    <div className="chat-page">
      <GlobalSidebar active="chat" />
      <ChatListPanel
        selectedChatId={selectedChatId}
        onSelectChat={setSelectedChatId}
        onOpenSettings={() => setView('settings')}
      />
      <ChatRoom />
    </div>
  )
}
