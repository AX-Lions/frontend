import { useState } from 'react'

import { icons } from './chat.icons.js'
import { toTeamRows } from './chat.data.js'
import { formatTime } from './chat.format.js'
import { AvatarStack, BordoAvatar, Icon, IconButton, RequestIcon } from './chat.ui.jsx'

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

function TeamHeader({ name, marked, open = true, onToggle }) {
  return (
    <button className="team-chat-header" type="button" aria-expanded={open} onClick={onToggle}>
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

export function ChatListPanel({ sidebar, importantRooms, selectedChatId, onSelectChat, onOpenSettings }) {
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
