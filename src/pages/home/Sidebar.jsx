import { useEffect, useMemo, useRef, useState } from 'react'

import { navigate } from '../../app/navigation.js'
import { globalNavItems } from '../../shared/constants/globalNav.js'
import { useChatBadge } from '../../shared/hooks/useChatBadge.js'
import { useInboxBadge } from '../../shared/hooks/useInboxBadge.js'
import { NoLiveMeetingDialog } from './NoLiveMeetingDialog.jsx'

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

    한때 `홈` 으로 박혀 있었다. 이 사이드바가 홈 전용이던 시절에는 맞는
    말이었지만, 회의 일정·요청함이 같은 사이드바를 쓰게 되면서 **어느
    화면에 있든 홈이 켜진 채로** 보였다. 그마저도 `홈` 자리가 `일정` 으로
    바뀐 지금은 뜻이 없다 — 홈 화면 자체를 가리키는 아이콘이 이 줄에
    더는 없다. 그래서 기본값은 **아무것도 안 켜진 상태**다. 홈이 아닌
    화면(`요청함`·`일정`)은 각자 자기 id 를 명시적으로 넘긴다.
  */
  active = '',
  isCollapsed = false,
  onToggleCollapse,
  recentProjects = [],
  favoriteProjects = [],
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
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef(null)
  const searchButtonRef = useRef(null)
  const searchBoxRef = useRef(null)

  const inboxBadge = useInboxBadge()
  const chatBadge = useChatBadge()
  /*
    마이크 자리(시안 `576:4400`·`576:4855`)는 지금은 진행 중인 회의를
    실제로 잇지 않는다 — 눌러도 늘 "아직 진행 중인 회의가 없습니다" 를
    띄운다. 예전에는 이 자리가 진행 중인 회의가 있을 때만 나타나는
    실시간 아이콘이었는데(`useLiveMeeting`), 이제는 항상 떠 있는 자리라
    그 훅과 팀장 전용 드롭다운(회의 시작하기 · 일정 보기)은 더 이상 여기서
    쓰지 않는다. 실시간 참여 팝업(`LiveMeetingPrompt`)은 나중에 이 자리가
    실제 회의를 잇게 되면 다시 연결한다 — 지금 지워도 되는 죽은 기능이
    아니라 아직 이어지지 않은 기능이라 파일은 남겨 둔다.
  */
  const [micModalOpen, setMicModalOpen] = useState(false)

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
            시안 `666:5059` 의 아이콘 줄이었는데, 마이크 자리가 생기면서
            시안이 `576:4855` 로 갈렸다 — `홈` 대신 `일정`, `회의`(플로우보드
            바로가기) 대신 언제나 떠 있는 `마이크` 다. `홈` 을 빼는 이유는
            로고(`.logo`, 바로 위)가 이미 그 자리를 하고 있어서다 — 아이콘
            줄에 또 있으면 같은 목적지가 둘이 된다. `회의` 를 빼는 이유는
            전역 레일(`GlobalSidebar`)이 그 길을 이미 맡고 있어서다.

            검색 칸은 눌러야 뜬다 — 늘 펼쳐 두면 최근 항목·즐겨찾기보다
            위에 항상 자리를 차지해, 프로젝트를 찾을 일이 없는 대부분의
            방문에서 화면만 차지한다.
          */}
          <div className="sidebar-icon-row" aria-label="주요 화면">
            <div className="sidebar-icon-group">
              {globalNavItems.map((item) => {
                if (item.id === 'home') {
                  const isActive = active === 'home'
                  return (
                    <a
                      key={item.id}
                      className={isActive ? 'sidebar-icon-btn active' : 'sidebar-icon-btn'}
                      href="/meeting-schedule"
                      aria-label="회의 일정"
                      aria-current={isActive ? 'page' : undefined}
                      data-tip="회의 일정"
                      onClick={(event) => goInApp(event, '/meeting-schedule')}
                    >
                      <img src="/icons/CalendarCheck.svg" alt="" />
                    </a>
                  )
                }

                if (item.id === 'meeting') {
                  /*
                    빨간 뱃지(진행 중 표시)는 지금은 켜지 않는다 — 이 자리가
                    아직 실제 회의를 안 잇고 있어서, 켜 두면 회의가 있다는
                    거짓 신호가 된다.
                  */
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="sidebar-icon-btn"
                      aria-label="회의 참여"
                      data-tip="회의 참여"
                      onClick={() => setMicModalOpen(true)}
                    >
                      <img src="/icons/Microphone.svg" alt="" />
                    </button>
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

      <NoLiveMeetingDialog open={micModalOpen} onClose={() => setMicModalOpen(false)} />
    </>
  )
}
