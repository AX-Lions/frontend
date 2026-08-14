import { useState } from 'react'

const icons = {
  add: '/icons/AddIcon.svg',
  expandDown: '/icons/ExpandDown.svg',
  expandRight: '/icons/Expandright.svg',
  folder: '/icons/FolderIcon.svg',
  menu: '/icons/menuIcon.svg',
  search: '/icons/Search.svg',
}

export function Sidebar({ recentProjects = [], favoriteProjects = [] }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
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

  return (
    <aside className={isCollapsed ? 'sidebar is-collapsed' : 'sidebar'} aria-label="사이드 메뉴">
      <div className="sidebar-top">
        <button
          className="icon-button"
          type="button"
          aria-label={isCollapsed ? '사이드바 열기' : '사이드바 접기'}
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
        >
          <img src={icons.menu} alt="" />
        </button>
        <a className="logo" href="/">
          <img src="/BordoLogo.svg" alt="Bordo" />
        </a>
      </div>

      {!isCollapsed ? (
        <>
          <label className="search-box">
            <img src={icons.search} alt="" aria-hidden="true" />
            <input aria-label="검색" type="search" />
          </label>

          <nav className="project-nav" aria-label="프로젝트">
            <div className="section-title">
              <span>프로젝트</span>
              <button type="button" aria-label="프로젝트 추가">
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
              ? recentProjects.map((project) => (
                  <a className="project-link" href="/flowchart" key={project.id}>
                    <img className="doc-icon" src={icons.folder} alt="" aria-hidden="true" />
                    {project.name}
                  </a>
                ))
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
              ? favoriteProjects.map((project) => (
                  <a className="project-link" href="/flowchart" key={project.id}>
                    <img className="doc-icon" src={icons.folder} alt="" aria-hidden="true" />
                    {project.name}
                  </a>
                ))
              : null}
          </nav>

          <div className="quick-links">
            <a href="/">Bordo 바로가기</a>
            <a href="/">Discord 바로가기</a>
          </div>

          <a className="profile-link" href="/">
            <span className="profile-avatar" aria-hidden="true" />
            사용자 이름
          </a>
        </>
      ) : null}
    </aside>
  )
}
