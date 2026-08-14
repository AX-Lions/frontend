import { useState } from 'react'

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

function GlobalRail() {
  return (
    <aside className="chat-rail" aria-label="주요 메뉴">
      <a className="chat-rail-link" href="/" aria-label="홈" title="홈">
        <Icon src={icons.home} />
      </a>
      <a className="chat-rail-link" href="/flow-board" aria-label="회의" title="회의">
        <Icon src={icons.bookCheck} />
      </a>
      <a className="chat-rail-link active" href="/chat" aria-label="채팅" title="채팅">
        <Icon src={icons.chat} />
      </a>
      <span className="chat-rail-user" aria-hidden="true" />
    </aside>
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

function ChatListPanel({ selectedChatId, onSelectChat }) {
  const [promptVisible, setPromptVisible] = useState(true)
  const [tool, setTool] = useState('')
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
          <IconButton label="AI 대리인 설정" active={tool === 'ai'} onClick={() => toggleTool('ai')}>
            <Icon src={icons.ai} />
          </IconButton>
          <IconButton label="채팅 설정" active={tool === 'settings'} onClick={() => toggleTool('settings')}>
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
          <button className="section-heading interactive" type="button">
            <h2>
              중요 채팅 <RequestIcon small />
            </h2>
            <Icon src={icons.expandDown} />
          </button>
          {importantChats.map((chat) => (
            <ChatPreview
              chat={chat}
              key={chat.id}
              selected={selectedChatId === chat.id}
              onSelect={() => onSelectChat(chat.id)}
            />
          ))}
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

export function ChatPage() {
  const [selectedChatId, setSelectedChatId] = useState('bordo')

  return (
    <div className="chat-page">
      <GlobalRail />
      <ChatListPanel selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} />
      <ChatRoom />
    </div>
  )
}
