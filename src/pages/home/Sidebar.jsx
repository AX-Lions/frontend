import { useMemo, useState } from 'react'

import { navigate } from '../../app/navigation.js'

/**
 * 홈의 프로젝트 사이드바.
 *
 * 전역 레일(`GlobalSidebar`)과 **다른 것**이다. 레일은 화면을 고르고, 이쪽은
 * 지금 화면 안에서 프로젝트를 고른다. 그래서 둘을 합치지 않고 나란히 둔다.
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

    return list.map((project) => (
      <a
        className="project-link"
        href={projectHref(project)}
        key={project.id}
        title={project.name}
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
    <aside className={isCollapsed ? 'sidebar is-collapsed' : 'sidebar'} aria-label="사이드 메뉴">
      <div className="sidebar-top">
        <button
          className="icon-button"
          type="button"
          aria-label={isCollapsed ? '사이드바 열기' : '사이드바 접기'}
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapse}
        >
          <img src={icons.menu} alt="" />
        </button>
        <a className="logo" href="/" aria-label="Bordo 홈" onClick={(event) => goInApp(event, '/')}>
          <img src="/BordoLogo.svg" alt="Bordo" />
        </a>
      </div>

      {!isCollapsed ? (
        <>
          <label className="search-box">
            <img src={icons.search} alt="" aria-hidden="true" />
            <input
              aria-label="프로젝트 검색"
              type="search"
              placeholder="프로젝트 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <nav className="project-nav" aria-label="프로젝트">
            <div className="section-title">
              <span>프로젝트</span>
              <button type="button" aria-label="프로젝트 추가" onClick={onAddProject}>
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
              <span className="quick-link-off" title="팀이 아직 Discord 서버와 연결되지 않았습니다">
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
  )
}
