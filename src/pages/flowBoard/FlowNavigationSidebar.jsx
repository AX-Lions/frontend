import { FlowMetricBadge } from './FlowMetricBadge'

export function FlowNavigationSidebar({
  activeCategory,
  activeIndex,
  collapsedFilters,
  contentFilters,
  icons,
  indexes,
  isCollapsed,
  isScrolled,
  onCategorySelect,
  onFilterCollapseToggle,
  onIndexSelect,
  onScroll,
  onSidebarToggle,
  participants,
}) {
  return (
    <aside className={isCollapsed ? 'flow-sidebar is-collapsed' : 'flow-sidebar'} aria-label="회의 탐색">
      <header className={isScrolled ? 'team-header is-scrolled' : 'team-header'}>
        <a className="team-name" href="/">
          AX Lions
        </a>
        <button className="team-refresh" type="button" aria-label="새로고침">
          <img src={icons.refresh} alt="" />
        </button>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          aria-expanded={!isCollapsed}
          onClick={onSidebarToggle}
        >
          <img className={isCollapsed ? 'is-collapsed' : ''} src={icons.expandLeftDouble} alt="" />
        </button>
      </header>

      <div className="sidebar-scroll" onScroll={onScroll}>
        <section className="sidebar-section categories" aria-labelledby="category-title">
          <h2 id="category-title">카테고리</h2>
          <button
            className={activeCategory === 'meeting' ? 'category-link selected' : 'category-link'}
            type="button"
            onClick={() => onCategorySelect('meeting')}
          >
            <img src={icons.bookCheck} alt="" />
            회의
          </button>
          <button
            className={activeCategory === 'work' ? 'category-link selected' : 'category-link'}
            type="button"
            onClick={() => onCategorySelect('work')}
          >
            <img src={icons.database} alt="" />
            작업
          </button>
        </section>

        <section className="sidebar-section index-section" aria-labelledby="index-title">
          <h2 id="index-title">인덱스</h2>
          <nav className="index-list">
            {indexes.map((item) => (
              <button
                className={activeIndex === item ? 'selected' : ''}
                type="button"
                key={item}
                onClick={() => onIndexSelect(item)}
              >
                {item}
              </button>
            ))}
          </nav>
        </section>

        <section className="sidebar-section filter-section" aria-labelledby="filter-title">
          <h2 id="filter-title">필터링</h2>
          <label className="filter-toggle">
            <span>시간순</span>
            <input type="checkbox" />
            <img className="checked-icon" src={icons.checked} alt="" />
            <img className="unchecked-icon" src={icons.unchecked} alt="" />
          </label>

          <button
            className={collapsedFilters.participants ? 'filter-heading is-collapsed' : 'filter-heading'}
            type="button"
            onClick={() => onFilterCollapseToggle('participants')}
          >
            참여자
            <img src={icons.expandDown} alt="" />
          </button>
          {!collapsedFilters.participants
            ? participants.map((participant) => (
                <label className="check-row" key={participant.name}>
                  <span>{participant.name}</span>
                  <input type="checkbox" defaultChecked={participant.checked} />
                  <img className="checked-icon" src={icons.checked} alt="" />
                  <img className="unchecked-icon" src={icons.unchecked} alt="" />
                </label>
              ))
            : null}

          <button
            className={
              collapsedFilters.content ? 'filter-heading content-heading is-collapsed' : 'filter-heading content-heading'
            }
            type="button"
            onClick={() => onFilterCollapseToggle('content')}
          >
            내용
            <img src={icons.expandDown} alt="" />
          </button>
          {!collapsedFilters.content
            ? contentFilters.map((filter) => (
                <label className="check-row content-row" key={filter.name}>
                  <span>
                    <FlowMetricBadge tone={filter.tone} />
                    {filter.name}
                  </span>
                  <input type="checkbox" defaultChecked={filter.checked} />
                  <img className="checked-icon" src={icons.checked} alt="" />
                  <img className="unchecked-icon" src={icons.unchecked} alt="" />
                </label>
              ))
            : null}
        </section>
      </div>
    </aside>
  )
}
