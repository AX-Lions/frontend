import { useState } from 'react'

import { icons } from './chat.icons.js'
import { toDirectRows, toTeamRows } from './chat.data.js'
import { formatTime } from './chat.format.js'
import { AvatarStack, BordoAvatar, Icon, IconButton, RequestIcon, UnreadBadge } from './chat.ui.jsx'

function ChatPreview({ chat, selected, onSelect }) {
  return (
    <button className={selected ? 'chat-preview selected' : 'chat-preview'} type="button" onClick={onSelect}>
      <div className="chat-preview-left">
        {chat.bordo ? (
          <BordoAvatar />
        ) : chat.stacked || !chat.avatar ? (
          <AvatarStack avatars={chat.avatars} />
        ) : (
          <img className="chat-avatar" src={chat.avatar} alt="" />
        )}
        <div className="chat-preview-copy">
          <div className="chat-preview-title">
            <strong>{chat.name}</strong>
            {chat.context ? <span>{chat.context}</span> : null}
            {chat.marked ? <RequestIcon small /> : null}
          </div>
          <p>{chat.message || '아직 나눈 이야기가 없습니다.'}</p>
        </div>
      </div>
      <div className="chat-preview-meta">
        <time>{formatTime(chat.sentAt)}</time>
        <UnreadBadge count={chat.unread} label={chat.name} />
      </div>
    </button>
  )
}

/**
 * 팀 한 줄.
 *
 * 예전에는 줄 전체가 버튼 하나였고, 그 안에 `모두 채팅 바로가기` 가 **글씨로만**
 * 들어 있었다. 눌러도 팀이 접히기만 하고 단체방은 열리지 않았다.
 *
 * 그래서 접기와 바로가기를 두 버튼으로 가른다. 버튼 안에 버튼을 넣을 수 없어
 * 줄 자체는 `div` 다.
 *
 * 미읽음 뱃지를 여기 그리는 이유 — 서버가 팀 노드에 하위 프로젝트·방을 **다 더한
 * 합계**를 준다. 접혀 있을 때 그 아래 볼 것이 있는지는 이 숫자로만 알 수 있다.
 */
function TeamHeader({ team, open, onToggle, onOpenGroupRoom }) {
  return (
    <div className="team-chat-header">
      <button className="team-name" type="button" aria-expanded={open} onClick={onToggle}>
        <strong>{team.name}</strong>
        {team.marked ? <RequestIcon small /> : null}
        <UnreadBadge count={team.unread} label={team.name} />
      </button>
      <span className="team-actions">
        {team.groupRoomId ? (
          <button
            className="team-shortcut"
            type="button"
            onClick={() => onOpenGroupRoom(team.groupRoomId)}
          >
            모두 채팅 바로가기
          </button>
        ) : (
          // 팀 단체방은 서버가 첫 조회 때 만들어 준다. 그래도 안 왔으면
          // 자리를 비우지 않고 왜 없는지 적는다.
          <span className="team-shortcut disabled" title="이 팀에는 아직 단체방이 없습니다.">
            단체방 없음
          </span>
        )}
        <button
          className="chevron-button"
          type="button"
          aria-expanded={open}
          aria-label={open ? `${team.name} 접기` : `${team.name} 펼치기`}
          onClick={onToggle}
        >
          <Icon className={open ? 'ui-icon chevron open' : 'ui-icon chevron'} src={icons.expandDown} />
        </button>
      </span>
    </div>
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
  // 어느 프로젝트에도 안 매달린 1:1 · 동료 대리인 방. 서버는 `direct_rooms` 로
  // 따로 내려주는데 화면이 이 칸을 아예 안 그려서, 프로젝트 밖에서 건 대화는
  // **목록에서 통째로 사라져 있었다.** 방을 못 찾으니 다시 걸고, 그러면 서버가
  // 같은 방을 되살려 주는데도 사용자는 새 방이 생긴 줄 안다.
  const directRooms = toDirectRows(sidebar)

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
        {directRooms.length > 0 ? (
          <section className="chat-list-section">
            <div className="section-heading">
              <h2>개인 채팅</h2>
            </div>
            {directRooms.map((chat) => (
              <ChatPreview
                chat={chat}
                key={chat.id}
                selected={selectedChatId === chat.id}
                onSelect={() => onSelectChat(chat.id)}
              />
            ))}
          </section>
        ) : null}

        {teams.map((team) => (
          <section className="team-chat-group" key={team.id}>
            <TeamHeader
              open={groups.isOpen(team.id)}
              team={team}
              onOpenGroupRoom={onSelectChat}
              onToggle={() => groups.toggle(team.id)}
            />
            {groups.isOpen(team.id) ? (
              <div className="nested-team">
                {team.projects.length === 0 ? (
                  <p className="chat-list-empty">이 팀에는 아직 프로젝트가 없습니다.</p>
                ) : null}
                {team.projects.map((project) => (
                  <div className="project-team" key={project.id}>
                    <button
                      className="project-title"
                      type="button"
                      aria-expanded={groups.isOpen(project.id)}
                      onClick={() => groups.toggle(project.id)}
                    >
                      <span className="project-name">
                        <strong>{project.name}</strong>
                        {project.marked ? <RequestIcon small /> : null}
                        <UnreadBadge count={project.unread} label={project.name} />
                      </span>
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
