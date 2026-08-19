import { useEffect, useMemo, useRef, useState } from 'react'

import { navigate } from '../../app/navigation.js'
import { LiveMeetingPrompt } from '../../shared/components/LiveMeetingPrompt.jsx'
import { globalNavItems } from '../../shared/constants/globalNav.js'
import { useChatBadge } from '../../shared/hooks/useChatBadge.js'
import { useInboxBadge } from '../../shared/hooks/useInboxBadge.js'
import { useIsTeamLead } from '../../shared/hooks/useIsTeamLead.js'
import { useLiveMeeting } from '../../shared/hooks/useLiveMeeting.js'

/**
 * 홈의 사이드바.
 *
 * 프로젝트 목록은 지금 화면 안에서 프로젝트를 고르는 자리라, 화면을 고르는
 * 전역 레일(`GlobalSidebar`)과는 원래도 다른 일이었다. 그런데 시안(`666:5059`)은
 * 로고 밑에 화면 이동 아이콘 줄을 붙여 둔 모양이라, 홈에서는 이 컴포넌트가
 * 그 줄까지 그린다 — 로고와 아이콘이 같은 칸에 있어야 붙어 보인다. 나머지
 * 화면은 지금처럼 `GlobalSidebar` 하나로 다닌다.
 *
 * ## 링크가 전부 `/` 였다
 *
 * 접히는 동작만 붙어 있고 목적지가 없었다. 누르면 홈이 다시 뜨므로 **눌렀는데
 * 아무 일도 안 일어난 것처럼** 보인다. 목적지는 전부 `GET /home` 이 이미
 * 내려주는 값에서 나온다 — 추가 요청이 필요 없다.
 */

const icons = {
  add: '/icons/AddIcon.svg',
  expandDown: '/icons/ExpandDown.svg',
  expandRight: '/icons/Expandright.svg',
  folder: '/icons/FolderIcon.svg',
  menu: '/icons/menuIcon.svg',
  search: '/icons/Search.svg',
}

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || (event.button !== undefined && event.button !== 0)
}

/** 앱 안으로 가는 링크는 문서를 다시 받지 않는다. 보조 클릭은 그대로 둔다. */
function goInApp(event, href) {
  if (isModifiedClick(event)) {
    return
  }
  event.preventDefault()
  navigate(href)
}

/*
  접힘 상태는 **위(`HomePage`)가 들고 있다.** 전역 레일도 같이 접혀야 하는데,
  레일은 이 컴포넌트 밖에 있는 형제라 여기서 손이 닿지 않는다. 두 곳이 같은
  값을 봐야 하므로 값은 공통 부모에 둔다.
*/
export function Sidebar({
  /*
    아이콘 줄에서 켜진 것.

    `홈` 으로 박혀 있었다. 이 사이드바는 홈 전용이었으니 맞는 말이었는데,
    회의 일정·요청함이 같은 사이드바를 쓰게 되면서 **어느 화면에 있든 홈이
    켜진 채로** 보였다. 시안(`666:5248`)은 요청함에서 요청함 아이콘이 켜져
    있다 — 그것이 지금 어디인지 말해 주는 유일한 표시다.
  */
  active = 'home',
  isCollapsed = false,
  onToggleCollapse,
  recentProjects = [],
  favoriteProjects = [],
  shortcuts,
  userName = '',
  avatarUrl = '',
  meetingIdByProject = {},
  onAddProject,
}) {
  const [query, setQuery] = useState('')
  const [openSections, setOpenSections] = useState({
    recent: true,
    favorite: true,
  })
  const [meetingMenuOpen, setMeetingMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  const meetingMenuRef = useRef(null)
  const searchButtonRef = useRef(null)
  const searchBoxRef = useRef(null)

  const inboxBadge = useInboxBadge()
  const chatBadge = useChatBadge()
  const isTeamLead = useIsTeamLead()
  const {
    liveMeeting, promptOpen, secondsLeft, responding,
    openPrompt, respondDecline, respondJoin,
  } = useLiveMeeting()

  /*
    `회의 시작하기 · 회의 일정 보기` 드롭다운(시안 `692:7910`)은 바깥을
    눌러도 닫혀야 한다 — 안 닫히면 다음에 누른 것을 가리고, 사용자는 왜
    안 눌리는지 모른 채 같은 자리를 다시 누른다. `Escape` 도 같은 이유로 받는다.
  */
  useEffect(() => {
    if (!meetingMenuOpen) {
      return undefined
    }
    const close = (event) => {
      if (!meetingMenuRef.current?.contains(event.target)) {
        setMeetingMenuOpen(false)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMeetingMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [meetingMenuOpen])

  /*
    프로젝트 검색 칸도 같은 이유로 바깥을 누르면 닫는다.

    닫을 때 검색어도 지운다 — 칸만 감추고 검색어를 남기면, 다시 열었을 때
    아래 프로젝트 목록이 왜 걸러져 있는지 칸이 닫힌 동안은 알 길이 없다.
  */
  useEffect(() => {
    if (!searchOpen) {
      return undefined
    }
    const close = (event) => {
      if (!searchBoxRef.current?.contains(event.target)
        && !searchButtonRef.current?.contains(event.target)) {
        setSearchOpen(false)
        setQuery('')
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setQuery('')
        searchButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [searchOpen])

  const toggleSection = (section) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  /*
    검색은 **이미 받아 둔 목록 안에서** 건다.

    서버에 프로젝트 검색 엔드포인트가 없다. 만들어 달라고 하기 전에, 여기
    사이드바가 보여주는 것은 최근·즐겨찾기 두 목록뿐이고 둘 다 화면에 이미
    들어와 있다. 이 자리에서 사람이 하는 일은 "아까 그거 어디 갔지" 이므로
    보이는 것을 좁히는 것으로 충분하다.

    전체 프로젝트를 가로질러 찾는 검색은 목록이 길어지면 필요해진다. 그때는
    서버가 붙어야 한다 — 그전까지 이 칸이 아무 반응도 안 하는 것보다는
    좁혀 주는 편이 낫다.
  */
  const needle = query.trim().toLowerCase()
  const shownRecent = useMemo(
    () => (needle
      ? recentProjects.filter((p) => (p.name || '').toLowerCase().includes(needle))
      : recentProjects),
    [recentProjects, needle],
  )
  const shownFavorite = useMemo(
    () => (needle
      ? favoriteProjects.filter((p) => (p.name || '').toLowerCase().includes(needle))
      : favoriteProjects),
    [favoriteProjects, needle],
  )

  /*
    프로젝트 링크가 `project_id` 없이 `/flow-board` 로만 갔다. 어느 것을 눌러도
    같은 화면이 떴다.

    회의 id 를 알면 그것을 싣는다 — 플로우 화면이 지금 읽는 것이 `?meeting` 이라,
    `?project` 만 실으면 아직 아무 데도 안 닿는다. 최근 회의 목록에 없는
    프로젝트는 회의 id 를 모르므로 `?project` 만 싣는다. 플로우 쪽이 그것을
    읽게 되면 그때부터 바로 맞는 화면이 뜬다.
  */
  const projectHref = (project) => {
    const meetingId = meetingIdByProject[project.id]
    return meetingId
      ? `/flow-board?meeting=${meetingId}&project=${project.id}`
      : `/flow-board?project=${project.id}`
  }

  const renderProjects = (list, emptyLabel) => {
    if (list.length === 0) {
      return <p className="project-nav-empty">{emptyLabel}</p>
    }

    /* 이름이 옆에 적혀 있으므로 말풍선은 붙이지 않는다 — 같은 글이 아래에
       한 번 더 뜰 뿐이다. 말풍선은 그림만 있는 단추의 몫이다. */
    return list.map((project) => (
      <a
        className="project-link"
        href={projectHref(project)}
        key={project.id}
        onClick={(event) => goInApp(event, projectHref(project))}
      >
        <img className="doc-icon" src={icons.folder} alt="" aria-hidden="true" />
        {project.name}
      </a>
    ))
  }

  // `GET /home` 의 `shortcuts` 가 방 id 와 Discord 주소를 이미 들고 온다.
  // 여기서 채팅 사이드바를 한 번 더 부르면 홈 첫 화면에 요청이 하나 더 는다.
  const agentRoomId = shortcuts?.agent_room_id ?? null
  const discord = shortcuts?.discord ?? null
  const agentHref = agentRoomId ? `/chat?room=${agentRoomId}` : '/chat'

  return (
    <>
      <aside className={isCollapsed ? 'sidebar is-collapsed' : 'sidebar'} aria-label="사이드 메뉴">
      <div className="sidebar-top">
        <button
          className="icon-button"
          type="button"
          aria-label={isCollapsed ? '사이드바 열기' : '사이드바 접기'}
          data-tip={isCollapsed ? '사이드바 열기' : '사이드바 접기'}
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapse}
        >
          <img src={icons.menu} alt="" />
        </button>
        <a className="logo" href="/" aria-label="Bordo 홈" data-tip="홈으로" onClick={(event) => goInApp(event, '/')}>
          <img src="/BordoLogo.svg" alt="Bordo" />
        </a>
      </div>

      {!isCollapsed ? (
        <>
          {/*
            시안 `666:5059` 의 아이콘 줄. `홈` 은 언제나 이 화면 자체라 항상
            켜진 것으로 그린다. 지금 진행 중인 회의가 있으면 `회의` 자리가
            실시간 아이콘으로 바뀐다 — `GlobalSidebar` 와 같은 훅을 쓰므로
            판정도 팝업도 똑같다.

            검색 칸은 눌러야 뜬다 — 늘 펼쳐 두면 최근 항목·즐겨찾기보다
            위에 항상 자리를 차지해, 프로젝트를 찾을 일이 없는 대부분의
            방문에서 화면만 차지한다.
          */}
          <div className="sidebar-icon-row" aria-label="주요 화면">
            <div className="sidebar-icon-group">
              {globalNavItems.map((item) => {
                if (item.id === 'meeting' && liveMeeting) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="sidebar-icon-btn sidebar-icon-live"
                      aria-label="진행 중인 회의 참여하기"
                      data-tip="진행 중인 회의 참여하기"
                      onClick={openPrompt}
                    >
                      <img src="/icons/LiveMeetingIcon.svg" alt="" />
                    </button>
                  )
                }

                /*
                  팀장에게는 `회의` 를 눌렀을 때 곧장 이동하지 않고 먼저
                  묻는다(시안 `692:7910`) — 회의를 시작할지, 잡힌 일정을
                  볼지. 팀장이 아니면 원래대로 `/flow-board` 로 바로 간다.
                */
                if (item.id === 'meeting' && isTeamLead) {
                  return (
                    <div className="sidebar-meeting-menu" key={item.id} ref={meetingMenuRef}>
                      <button
                        type="button"
                        className={meetingMenuOpen ? 'sidebar-icon-btn active' : 'sidebar-icon-btn'}
                        aria-label={item.label}
                        aria-haspopup="menu"
                        aria-expanded={meetingMenuOpen}
                        data-tip={item.label}
                        onClick={() => setMeetingMenuOpen((open) => !open)}
                      >
                        <img src={item.icon} alt="" />
                      </button>

                      {meetingMenuOpen ? (
                        <div className="sidebar-meeting-panel" role="menu">
                          {/*
                            디스코드가 실제 회의 자리다 — "시작" 은 그리로
                            보내는 것이지, 서버가 따로 만드는 행위가 아니다.
                          */}
                          <a
                            className="sidebar-meeting-row"
                            role="menuitem"
                            href={discord?.connected && discord.url ? discord.url : undefined}
                            aria-disabled={!(discord?.connected && discord.url)}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={(event) => {
                              if (!(discord?.connected && discord.url)) {
                                event.preventDefault()
                                return
                              }
                              setMeetingMenuOpen(false)
                            }}
                          >
                            <img src="/icons/SignalStart.svg" alt="" />
                            회의 시작하기
                          </a>
                          <hr />
                          <a
                            className="sidebar-meeting-row"
                            role="menuitem"
                            href="/meeting-schedule"
                            onClick={(event) => {
                              setMeetingMenuOpen(false)
                              goInApp(event, '/meeting-schedule')
                            }}
                          >
                            <img src="/icons/CalendarCheck.svg" alt="" />
                            회의 일정 보기
                          </a>
                        </div>
                      ) : null}
                    </div>
                  )
                }

                const isActive = item.id === active
                return (
                  <a
                    key={item.id}
                    className={isActive ? 'sidebar-icon-btn active' : 'sidebar-icon-btn'}
                    href={item.href}
                    aria-label={item.tip ?? item.label}
                    aria-current={isActive ? 'page' : undefined}
                    data-tip={item.tip ?? item.label}
                    onClick={(event) => goInApp(event, item.href)}
                  >
                    <img src={item.icon} alt="" />
                    {item.id === 'inbox' && inboxBadge > 0 ? (
                      <span className="sidebar-icon-badge">{inboxBadge > 99 ? '99+' : inboxBadge}</span>
                    ) : null}
                    {item.id === 'chat' && chatBadge > 0 ? (
                      <span className="sidebar-icon-badge">{chatBadge > 99 ? '99+' : chatBadge}</span>
                    ) : null}
                  </a>
                )
              })}
            </div>

            <button
              ref={searchButtonRef}
              type="button"
              className={searchOpen ? 'sidebar-icon-btn active' : 'sidebar-icon-btn'}
              aria-label="검색"
              aria-expanded={searchOpen}
              data-tip="검색"
              onClick={() => setSearchOpen((open) => {
                const next = !open
                if (next) {
                  window.requestAnimationFrame(() => searchInputRef.current?.focus())
                } else {
                  setQuery('')
                }
                return next
              })}
            >
              <img src={icons.search} alt="" />
            </button>
          </div>

          {searchOpen ? (
            <label className="search-box" ref={searchBoxRef}>
              <img src={icons.search} alt="" aria-hidden="true" />
              <input
                ref={searchInputRef}
                aria-label="프로젝트 검색"
                type="search"
                placeholder="프로젝트 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          ) : null}

          <nav className="project-nav" aria-label="프로젝트">
            <div className="section-title">
              <span>프로젝트</span>
              <button type="button" aria-label="프로젝트 추가" data-tip="프로젝트 추가" onClick={onAddProject}>
                <img src={icons.add} alt="" />
              </button>
            </div>

            <button
              className="nav-subtitle"
              type="button"
              aria-expanded={openSections.recent}
              onClick={() => toggleSection('recent')}
            >
              최근 항목
              <img src={openSections.recent ? icons.expandDown : icons.expandRight} alt="" />
            </button>
            {openSections.recent
              ? renderProjects(shownRecent, needle ? '찾는 이름이 없습니다.' : '최근 연 프로젝트가 없습니다.')
              : null}

            <button
              className="nav-subtitle"
              type="button"
              aria-expanded={openSections.favorite}
              onClick={() => toggleSection('favorite')}
            >
              즐겨찾기
              <img src={openSections.favorite ? icons.expandDown : icons.expandRight} alt="" />
            </button>
            {openSections.favorite
              ? renderProjects(shownFavorite, needle ? '찾는 이름이 없습니다.' : '즐겨찾기한 프로젝트가 없습니다.')
              : null}
          </nav>

          <div className="quick-links">
            {/* `Bordo 바로가기` 는 **내 대리인과의 채팅**이다. 이름만 보고
                홈으로 보내면 이미 홈에 있는 사람이 누른 것이라 아무 일도
                안 일어난 것처럼 보인다. */}
            <a href={agentHref} onClick={(event) => goInApp(event, agentHref)}>
              Bordo 바로가기
            </a>

            {/*
              Discord 주소는 서버가 조립해 준다. 팀이 아직 연결되지 않았으면
              `connected: false` 로만 온다 — 그때 링크를 그럴듯하게 띄워 두면
              눌렀을 때 Discord 첫 화면으로 튕긴다. 갈 곳이 없다는 것을
              그대로 말한다.
            */}
            {discord?.connected && discord.url ? (
              <a href={discord.url} target="_blank" rel="noreferrer noopener">
                Discord 바로가기
              </a>
            ) : (
              <span className="quick-link-off" data-tip="팀이 아직 Discord 서버와 연결되지 않았습니다">
                Discord 미연결
              </span>
            )}
          </div>

          {/* 하단 프로필. `사용자 이름` 하드코딩에 목적지도 `/` 였다.
              이름은 `GET /home` 의 `user_name` 을 그대로 쓴다. */}
          <a
            className="profile-link"
            href="/account"
            onClick={(event) => goInApp(event, '/account')}
          >
            {avatarUrl ? (
              <img className="profile-avatar-image" src={avatarUrl} alt="" />
            ) : (
              // 아바타가 없는 계정이 대부분이다. 빈 원을 두면 누구인지
              // 알 수 없으므로 이름 첫 글자를 넣는다.
              <span className="profile-avatar" aria-hidden="true">
                {userName ? userName.trim().charAt(0) : ''}
              </span>
            )}
            {userName || '개인 설정'}
          </a>
        </>
      ) : null}
      </aside>

      <LiveMeetingPrompt
        open={promptOpen}
        meeting={liveMeeting}
        secondsLeft={secondsLeft}
        responding={responding}
        onDecline={respondDecline}
        onJoin={respondJoin}
      />
    </>
  )
}
