import { useState } from 'react'

import { icons } from './chat.icons.js'
import { NewChatDialog } from './NewChatDialog.jsx'
import { toTeamRows } from './chat.data.js'
import { formatTime } from './chat.format.js'
import { AvatarStack, BordoAvatar, Icon, IconButton, PersonAvatar, UnreadBadge } from './chat.ui.jsx'

function ChatPreview({ chat, selected, onSelect }) {
  return (
    <button className={selected ? 'chat-preview selected' : 'chat-preview'} type="button" onClick={onSelect}>
      <div className="chat-preview-left">
        {chat.bordo ? (
          <BordoAvatar />
        ) : chat.stacked || !chat.avatar ? (
          <AvatarStack avatars={chat.avatars} />
        ) : (
          <PersonAvatar className="chat-avatar" src={chat.avatar} />
        )}
        <div className="chat-preview-copy">
          <div className="chat-preview-title">
            <strong>{chat.name}</strong>
            {chat.context ? <span>{chat.context}</span> : null}
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
 * 줄 하나가 하는 일은 **펼치고 접는 것 하나**다. 예전에는 옆에 `모두 채팅
 * 바로가기` 가 나란히 있어서, 팀을 펼치려고 눌렀는데 단체방이 열리는 일이
 * 생겼다. 팀은 방이 아니라 방을 담는 칸이라, 이 줄에서 기대되는 동작은 하나뿐이다.
 *
 * 미읽음 뱃지를 여기 그리는 이유 — 서버가 팀 노드에 하위 프로젝트·방을 **다 더한
 * 합계**를 준다. 접혀 있을 때 그 아래 볼 것이 있는지는 이 숫자로만 알 수 있다.
 */
function TeamHeader({ team, open, onToggle }) {
  return (
    <button
      className="team-chat-header"
      type="button"
      aria-expanded={open}
      aria-label={open ? `${team.name} 접기` : `${team.name} 펼치기`}
      onClick={onToggle}
    >
      <span className="team-name">
        <strong>{team.name}</strong>
        <UnreadBadge count={team.unread} label={team.name} />
      </span>
      <Icon className={open ? 'ui-icon chevron open' : 'ui-icon chevron'} src={icons.expandDown} />
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

/**
 * 목록 걸러 보기.
 *
 * **서버에 방 검색 API 가 없다.** `/chat/rooms/{id}/search` 는 방 하나 안의
 * 메시지를 찾는 것이라 여기 쓸 수 없다. 그래서 이건 검색이 아니라 **이미
 * 받아 온 목록을 좁히는 것**이고, 화면에도 그렇게 적는다.
 *
 * 없는 API 를 목으로 때우지 않는다. 목록에 없는 방은 여기서도 안 나온다.
 */
function matchesRoom(room, needle) {
  if (!needle) {
    return true
  }
  return `${room.name ?? ''} ${room.context ?? ''} ${room.message ?? ''}`
    .toLowerCase()
    .includes(needle)
}

/**
 * 자리에 있는지 없는지를 켜고 끄는 스위치.
 *
 * ## 왜 채팅 목록 맨 위인가
 *
 * 자리를 비우는 순간이 곧 **채팅을 닫는 순간**이다. 설정 화면 안쪽에 두면
 * 비우기 전에 거기까지 들어갈 사람이 없고, 그러면 대리인은 영영 안 나선다.
 * 나갈 때 반드시 지나는 자리에 둬야 눌린다.
 *
 * ## 두 값뿐이다
 *
 * `활동 중` 은 내가 직접 답한다. `자리 비움` 은 오는 말을 내 Bordo 가 먼저
 * 받는다. 「바쁨」 같은 중간값은 두지 않는다 — 대리인이 나설지 말지는 예·아니오
 * 라서, 중간값을 만들면 그 상태에서 대리인이 어떻게 행동하는지 아무도 모른다.
 */
function PresenceToggle({ busy, status, onChange }) {
  const away = status === 'AWAY'

  return (
    <div className={away ? 'presence-toggle is-away' : 'presence-toggle'}>
      <div className="presence-switch" role="radiogroup" aria-label="내 상태">
        <button
          type="button"
          role="radio"
          aria-checked={!away}
          disabled={busy}
          onClick={() => onChange('ACTIVE')}
        >
          활동 중
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={away}
          disabled={busy}
          onClick={() => onChange('AWAY')}
        >
          자리 비움
        </button>
      </div>
      {/*
        지금 무슨 일이 일어나는지 한 줄로 말한다. 스위치만 두면 `자리 비움` 이
        남에게 보이는 표시인지, 내 Bordo 가 실제로 답을 하는 것인지 알 수 없다 —
        후자라는 것이 이 제품의 값이다.
      */}
      <p>
        {away
          ? '오는 말을 Bordo가 먼저 받습니다. 돌아오면 아래에 모아 둡니다.'
          : '오는 말을 직접 받습니다.'}
      </p>
    </div>
  )
}

export function ChatListPanel({
  sidebar,
  awayRooms,
  presence,
  presenceBusy,
  selectedChatId,
  onCreatedRoom,
  onPresenceChange,
  onSelectChat,
  onOpenAgentSettings,
  onOpenChatSettings,
}) {
  const [promptVisible, setPromptVisible] = useState(true)
  const [tool, setTool] = useState('')
  const [query, setQuery] = useState('')
  const [awayOpen, setAwayOpen] = useState(true)
  const groups = useCollapsed()

  const needle = tool === 'search' ? query.trim().toLowerCase() : ''
  const primaryChat = sidebar?.my_agent_room
  const teams = toTeamRows(sidebar)
    .map((team) => ({
      ...team,
      projects: team.projects
        .map((project) => ({ ...project, rooms: project.rooms.filter((r) => matchesRoom(r, needle)) }))
        // 걸러 보는 중에는 이름이 맞는 프로젝트도 남긴다. 방이 하나도 안 걸려도
        // 그 프로젝트가 있다는 것 자체가 답일 수 있다.
        .filter((project) => !needle
          || project.rooms.length > 0
          || project.name.toLowerCase().includes(needle)),
    }))
    .filter((team) => !needle
      || team.projects.length > 0
      || team.name.toLowerCase().includes(needle))
  const visibleAway = (awayRooms ?? []).filter((room) => matchesRoom(room, needle))

  const toggleTool = (nextTool) => {
    setTool((current) => (current === nextTool ? '' : nextTool))
  }

  // 걸러 보는 중에는 접힘을 무시한다. 접힌 팀 안에 답이 있으면 사용자는
  // 걸렀는데도 아무것도 안 나온 것으로 본다.
  const isOpen = (id) => Boolean(needle) || groups.isOpen(id)

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
          {/* 톱니와 반짝이가 **같은 화면**을 열고 있었다. 톱니를 누른 사람은
              채팅 설정을 기대하는데 대리인 설정이 떴다. 둘을 가른다. */}
          {/*
            말풍선이 가리키는 것이 이 버튼이라, 이 버튼을 감싼 자리를 기준으로
            띄운다.

            예전에는 패널 전체를 기준으로 `top: 71px; right: 64px` 이었다. 헤더
            높이와 아이콘 위치를 손으로 잰 값이라, 그 사이에 무엇이 하나만 끼어도
            **아무것도 안 가리키는 알약이 공중에 뜬다.** 실제로 그렇게 됐다.
          */}
          <span className="chat-tip-anchor">
            <IconButton label="AI 대리인 설정" onClick={onOpenAgentSettings}>
              <Icon src={icons.ai} />
            </IconButton>

            {/*
              똑같은 안내가 검색칸 자리에도 한 벌 더 있었다(`position: absolute`
              인데 자기 자리를 잡아 줄 조상이 없어, 엉뚱하게 아래 `자리 비움`
              스위치 위에 겹쳐 떴다). 가리키는 버튼이 하나인데 말풍선이 둘일
              이유가 없어 이 벌만 남긴다.

              세 번 깜빡이면 스스로 접는다 — 눌러서만 닫히면 처음 켠 사람이
              그새 다른 데를 보고 있다가 다시 열었을 때도 여전히 떠 있어,
              눈에 안 띄던 권유가 나중엔 방해로 읽힌다. `setTimeout` 으로
              직접 시간을 세지 않고 `onAnimationEnd` 를 쓰는 이유는, 그러면
              깜빡이는 시간(`chat.css` 의 `chat-tip-blink`)과 사라지는 시점이
              **한 곳**에만 적히기 때문이다 — 따로 세면 애니메이션 길이만
              바뀌었을 때 깜빡임이 끝나기 전에 사라지거나 끝난 뒤에도 한
              박자 남는다.
            */}
            {promptVisible ? (
              <div className="chat-tip is-blinking" role="note" onAnimationEnd={() => setPromptVisible(false)}>
                <p>당신의 Bordo를 입맛에 맞게 조정해보세요!</p>
                <button type="button" aria-label="안내 닫기" onClick={() => setPromptVisible(false)}>
                  ×
                </button>
              </div>
            ) : null}
          </span>
          <IconButton label="채팅 설정" onClick={onOpenChatSettings}>
            <Icon src={icons.setting} />
          </IconButton>
        </div>
      </header>

      {/*
        검색칸은 **머리 바로 밑**이다.

        자리 비움 스위치 아래에 있었다. 검색은 아래 목록을 좁히는 일이라 그
        목록 바로 위에 있어야 손이 짧고, 스위치는 목록과 상관없는 내 상태라
        사이에 끼면 두 가지가 한 덩이로 보인다.
      */}
      {tool === 'search' ? (
        <div className="chat-list-search">
          <input
            aria-label="채팅 목록 걸러 보기"
            placeholder="이름 · 최근 메시지로 좁히기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" aria-label="지우기" onClick={() => setQuery('')}>×</button>
          ) : null}
          {/* 서버에 방 검색 API 가 없다. 이건 검색이 아니라 이미 받아 온 목록을
              좁히는 것이라, 그렇다고 적어 둔다. */}
          <p>불러온 목록 안에서만 찾습니다.</p>
        </div>
      ) : null}

      <PresenceToggle
        busy={presenceBusy}
        status={presence}
        onChange={onPresenceChange}
      />

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

        {/*
          자리를 비운 사이 오간 말.

          예전에는 이 자리가 `중요 채팅` 이었다 — **내가 미리 별을 찍어 둔
          것**만 모이는 목록이다. 자리를 비우기 전에 무엇이 중요해질지 알 수
          있으면 애초에 자리를 안 비웠을 것이라, 정작 돌아왔을 때 가장 먼저
          봐야 하는 것(없는 동안 오간 말)은 방을 하나씩 열어야 찾을 수 있었다.
        */}
        <section className="chat-list-section away-section">
          <button
            className="section-heading interactive"
            type="button"
            aria-expanded={awayOpen}
            onClick={() => setAwayOpen((open) => !open)}
          >
            <h2>
              자리 비운 사이 Bordo가 나눈 대화
              {visibleAway.length > 0 ? <b>{visibleAway.length}</b> : null}
            </h2>
            <Icon className={awayOpen ? 'ui-icon chevron open' : 'ui-icon chevron'} src={icons.expandDown} />
          </button>
          {awayOpen && visibleAway.length === 0 ? (
            <p className="chat-list-empty">
              아직 Bordo가 대신 받은 대화가 없습니다.
            </p>
          ) : null}
          {awayOpen
            ? visibleAway.map((chat) => (
                <button
                  className={selectedChatId === chat.id ? 'away-preview selected' : 'away-preview'}
                  type="button"
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <div className="away-preview-head">
                    <strong>{chat.name}</strong>
                    {/* 몇 번 대신 답했는지. 방 이름만으로는 한 마디 받아넘긴
                        것과 열 번 오간 것이 같아 보인다. */}
                    <span className="away-count">{`대신 답함 ${chat.handledCount}`}</span>
                    <time>{formatTime(chat.sentAt)}</time>
                  </div>
                  {chat.context ? <span className="away-path">{chat.context}</span> : null}
                  <p>{chat.message}</p>
                </button>
              ))
            : null}
        </section>

        {/*
          서버가 `팀 → 프로젝트 → 방` 3층으로 준다. 목에서는 이 층이 고정된
          이름으로 박혀 있었다(`AX Lions` · `멋사 아이디어톤`). 몇 개가 올지
          서버가 정하므로 접힘 상태도 id 로 기억한다.

          어느 프로젝트에도 안 매달린 1:1 · 동료 대리인 방(`개인 채팅`)은
          시안(`576:6096`)에 없어서 여기서는 그리지 않는다 — 팀 밑에 못
          들어가는 방은 이 목록에서 안 보인다.
        */}
        {teams.map((team) => (
          <section className="team-chat-group" key={team.id}>
            <TeamHeader
              open={isOpen(team.id)}
              team={team}
              onToggle={() => groups.toggle(team.id)}
            />
            {isOpen(team.id) ? (
              <div className="nested-team">
                {/*
                  팀 단체방.

                  팀 줄에서 방을 여는 길을 없앴으므로 방 자체는 여기 둔다.
                  안 두면 **열 수 없는 방의 미읽음이 팀 뱃지에 영영 남는다** —
                  서버 팀 합계에 그 방 몫이 들어 있기 때문이다.

                  프로젝트보다 위에 두는 이유는 팀 전체에 오는 말이라서다.
                  프로젝트 사이에 끼면 프로젝트 하나로 읽힌다.
                */}
                {team.groupRoom ? (
                  <ChatPreview
                    chat={team.groupRoom}
                    selected={selectedChatId === team.groupRoom.id}
                    onSelect={() => onSelectChat(team.groupRoom.id)}
                  />
                ) : null}
                {team.projects.length === 0 ? (
                  <p className="chat-list-empty">이 팀에는 아직 프로젝트가 없습니다.</p>
                ) : null}
                {team.projects.map((project) => (
                  <div className="project-team" key={project.id}>
                    <button
                      className="project-title"
                      type="button"
                      aria-expanded={isOpen(project.id)}
                      onClick={() => groups.toggle(project.id)}
                    >
                      <span className="project-name">
                        <strong>{project.name}</strong>
                        <UnreadBadge count={project.unread} label={project.name} />
                      </span>
                      <Icon
                        className={isOpen(project.id) ? 'ui-icon chevron open' : 'ui-icon chevron'}
                        src={icons.expandDown}
                      />
                    </button>
                    {isOpen(project.id) ? (
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

      {tool === 'create' ? (
        <NewChatDialog
          onClose={() => setTool('')}
          onCreated={(room) => {
            setTool('')
            onCreatedRoom(room)
          }}
        />
      ) : null}
    </aside>
  )
}
