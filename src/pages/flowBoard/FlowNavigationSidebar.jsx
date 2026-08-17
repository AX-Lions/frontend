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
  onContentToggle,
  onIndexSelect,
  onParticipantToggle,
  onScroll,
  onSidebarToggle,
  participants,
  teamName,
}) {
  return (
    <aside className={isCollapsed ? 'flow-sidebar is-collapsed' : 'flow-sidebar'} aria-label="회의 탐색">
      <header className={isScrolled ? 'team-header is-scrolled' : 'team-header'}>
        <a className="team-name" href="/">
          {teamName ?? '　'}
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
          {/*
            인덱스는 안건이다. 문자열이 아니라 `{id, label, related_edge_ids}` 라
            누르면 그 안건에 걸린 화살표로 갈 수 있다. 라벨을 key 로 쓰면 같은
            제목의 안건이 둘일 때 하나가 사라진다.
          */}
          <nav className="index-list">
            {indexes.length === 0 ? (
              <p className="index-empty">잡힌 안건이 없습니다.</p>
            ) : indexes.map((item) => (
              <button
                className={activeIndex?.id === item.id ? 'selected' : ''}
                type="button"
                key={item.id}
                onClick={() => onIndexSelect(item)}
              >
                {item.label}
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
          {/*
            `defaultChecked` 에서 `checked` 로 바꿨다. 체크가 조회 조건이 되면서
            **누른 것과 실제로 걸린 조건이 갈리면 안 되기** 때문이다. 되돌아온
            결과와 체크 상태가 어긋나면 사용자는 필터가 고장 났다고 본다.
          */}
          {!collapsedFilters.participants
            ? participants.map((participant) => (
                <label className="check-row" key={participant.id ?? participant.name}>
                  <span>{participant.label ?? participant.name}</span>
                  <input
                    type="checkbox"
                    checked={participant.checked}
                    onChange={() => onParticipantToggle?.(participant.id)}
                  />
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
                <label className="check-row content-row" key={filter.value ?? filter.name}>
                  <span>
                    <FlowMetricBadge tone={filter.tone} />
                    {filter.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={filter.checked}
                    onChange={() => onContentToggle?.(filter.value)}
                  />
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
