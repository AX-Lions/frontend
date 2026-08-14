import './flowchart.css'
import {
  BOARD_CONTENT_BOUNDS,
  boardMetrics,
  briefTags,
  checkItems,
  contentFilters,
  icons,
  indexes,
  participants,
  replyItems,
  requestItems,
  summaryColumns,
  toneIcons,
  toneLabels,
} from './flowchart.api'
import { useFlowchartBoard } from './useFlowchartBoard'
import { useFlowchartUi } from './useFlowchartUi'

function BadgeIcon({ tone }) {
  return (
    <span className={`metric-icon ${tone}`} aria-label={toneLabels[tone]}>
      <img src={toneIcons[tone]} alt="" />
    </span>
  )
}

function MetricGroup({ activeMetricId, className, items, onMetricToggle }) {
  return (
    <div className={`metric-group ${className}`}>
      {items.map((item) => {
        const metricId = `${className}-${item.tone}`

        return (
          <button
            className={activeMetricId === metricId ? 'metric-item is-active' : 'metric-item'}
            type="button"
            key={metricId}
            onClick={() => onMetricToggle(metricId)}
          >
            <BadgeIcon tone={item.tone} />
            <b>{item.count}</b>
          </button>
        )
      })}
    </div>
  )
}

function ProfileNode({ className, image, name }) {
  return (
    <button className={`profile-node ${className}`} type="button" aria-label={`${name} 프로필`}>
      <img src={image} alt="" />
      <span>{name}</span>
    </button>
  )
}

export function FlowchartPage() {
  const {
    boardRef,
    handleBoardPointerDown,
    handleBoardPointerMove,
    handleBoardWheel,
    isPanning,
    maxZoom,
    minZoom,
    renderedZoom,
    stopBoardPan,
    zoom,
    zoomIn,
    zoomOut,
    zoomPercent,
  } = useFlowchartBoard(BOARD_CONTENT_BOUNDS)
  const {
    activeCategory,
    activeIndex,
    activeMetricId,
    activeRail,
    activeReplyId,
    collapsedFilters,
    isBriefScrolled,
    isMeetingMenuOpen,
    isSidebarScrolled,
    setActiveCategory,
    setActiveIndex,
    setActiveRail,
    setIsBriefScrolled,
    setIsSidebarScrolled,
    toggleFilterCollapse,
    toggleMeetingMenu,
    toggleMetric,
    toggleReply,
  } = useFlowchartUi(indexes[0])

  return (
    <div className="flowchart-page">
      <aside className="flow-rail" aria-label="주요 메뉴">
        <a
          className={activeRail === 'home' ? 'rail-link active' : 'rail-link'}
          href="/"
          aria-label="홈"
          onClick={() => setActiveRail('home')}
        >
          <img src={icons.home} alt="" />
        </a>
        <a
          className={activeRail === 'meeting' ? 'rail-link active' : 'rail-link'}
          href="/flowchart"
          aria-label="회의"
          onClick={() => setActiveRail('meeting')}
        >
          <img src={icons.bookCheck} alt="" />
        </a>
        <button
          className={activeRail === 'chat' ? 'rail-link active' : 'rail-link'}
          type="button"
          aria-label="채팅"
          onClick={() => setActiveRail('chat')}
        >
          <img src={icons.chat} alt="" />
        </button>
        <span className="rail-user" />
      </aside>

      <aside className="flow-sidebar" aria-label="회의 탐색">
        <header className={isSidebarScrolled ? 'team-header is-scrolled' : 'team-header'}>
          <a className="team-name" href="/">
            AX Lions
          </a>
          <button className="team-refresh" type="button" aria-label="새로고침">
            <img src={icons.refresh} alt="" />
          </button>
          <button className="sidebar-toggle" type="button" aria-label="사이드바 접기">
            <img src={icons.expandLeftDouble} alt="" />
          </button>
        </header>

        <div className="sidebar-scroll" onScroll={(event) => setIsSidebarScrolled(event.currentTarget.scrollTop > 0)}>
          <section className="sidebar-section categories" aria-labelledby="category-title">
            <h2 id="category-title">카테고리</h2>
            <button
              className={activeCategory === 'meeting' ? 'category-link selected' : 'category-link'}
              type="button"
              onClick={() => setActiveCategory('meeting')}
            >
              <img src={icons.bookCheck} alt="" />
              회의
            </button>
            <button
              className={activeCategory === 'work' ? 'category-link selected' : 'category-link'}
              type="button"
              onClick={() => setActiveCategory('work')}
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
                  onClick={() => setActiveIndex(item)}
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
              onClick={() => toggleFilterCollapse('participants')}
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
              onClick={() => toggleFilterCollapse('content')}
            >
              내용
              <img src={icons.expandDown} alt="" />
            </button>
            {!collapsedFilters.content
              ? contentFilters.map((filter) => (
                  <label className="check-row content-row" key={filter.name}>
                    <span>
                      <BadgeIcon tone={filter.tone} />
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

      <main className="flow-workspace">
        <section
          className={isPanning ? 'flow-board is-panning' : 'flow-board'}
          aria-label="회의 플로우"
          ref={boardRef}
          onWheel={handleBoardWheel}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={stopBoardPan}
          onPointerCancel={stopBoardPan}
        >
          <header className="meeting-title">
            <h1>8/13 회의</h1>
            <button type="button" aria-label="회의 선택" aria-expanded={isMeetingMenuOpen} onClick={toggleMeetingMenu}>
              <img className={isMeetingMenuOpen ? 'is-open' : ''} src={icons.expandDown} alt="" />
            </button>
          </header>

          <div
            className="board-zoom-surface"
            style={{
              width: BOARD_CONTENT_BOUNDS.width * renderedZoom,
              height: BOARD_CONTENT_BOUNDS.height * renderedZoom,
            }}
          >
            <div
              className="board-stage"
              style={{
                transform: `scale(${renderedZoom})`,
                left: -BOARD_CONTENT_BOUNDS.left * renderedZoom,
                top: -BOARD_CONTENT_BOUNDS.top * renderedZoom,
              }}
            >
              <svg className="connector-layer" viewBox="0 0 776 931" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <marker id="flow-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                    <path d="M0,0 L8,4 L0,8" />
                  </marker>
                </defs>
                <path d="M198 146 H578" />
                <path d="M630 198 V642" />
                <path d="M630 198 V302 H146 V642" />
                <path d="M198 694 H578" />
              </svg>

              <ProfileNode className="top-left" image="/flowchart/profile-2.jpeg" name="유수인" />
              <ProfileNode className="top-right" image="/flowchart/profile-3.jpeg" name="서재민" />
              <ProfileNode className="bottom-right" image="/flowchart/profile-1.jpeg" name="강다은" />

              <MetricGroup
                activeMetricId={activeMetricId}
                className="top-flow"
                items={boardMetrics.top}
                onMetricToggle={toggleMetric}
              />
              <MetricGroup
                activeMetricId={activeMetricId}
                className="left-flow"
                items={boardMetrics.left}
                onMetricToggle={toggleMetric}
              />
              <MetricGroup
                activeMetricId={activeMetricId}
                className="right-flow"
                items={boardMetrics.right}
                onMetricToggle={toggleMetric}
              />

              <article className="summary-board">
                {summaryColumns.map((column) => (
                  <section className="summary-column" key={column.title}>
                    <h2>{column.title}</h2>
                    <div>
                      {column.items.map((item) => (
                        <button type="button" key={item}>
                          {item}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </article>

              <div className="ai-profile">
                <button className="ai-avatar" type="button" aria-label="임수연의 Bordo 활동내역">
                  <span className="ai-spark">✦</span>
                  <strong>
                    임수연의
                    <br />
                    Bordo
                  </strong>
                </button>
                <p>
                  Bordo의 활동내역을 보려면
                  <br />
                  위 버튼을 눌러주세요!
                </p>
              </div>
            </div>
          </div>

          {zoom > minZoom ? (
            <div className="zoom-controls" aria-label="플로우 확대 축소">
              <button type="button" aria-label="축소" onClick={zoomOut} disabled={zoom <= minZoom}>
                -
              </button>
              <output aria-live="polite">{zoomPercent}%</output>
              <button type="button" aria-label="확대" onClick={zoomIn} disabled={zoom >= maxZoom}>
                +
              </button>
            </div>
          ) : null}
        </section>

        <aside className={activeReplyId ? 'briefing-panel has-active-reply' : 'briefing-panel'} aria-label="Zero 브리핑">
          <header className={isBriefScrolled ? 'briefing-header is-scrolled' : 'briefing-header'}>
            <h2>Zero 브리핑</h2>
            <label className="brief-search">
              <img src={icons.search} alt="" />
              <input type="search" aria-label="브리핑 검색" />
            </label>
          </header>

          <div className="briefing-scroll" onScroll={(event) => setIsBriefScrolled(event.currentTarget.scrollTop > 0)}>
            <section className="brief-section overview">
              <h3>회의 한눈에 보기</h3>
              <p>
                이번 회의에서는 백엔드 개발 진행 상황과 프론트엔드/디자인 싱크를 중심으로 논의했어요. API 연동 일정이
                변경되었으며, 디자인 최종안은 다음 회의 전까지 확정하기로 했어요.
              </p>
              <div className="brief-tags">
                {briefTags.map((tag) => (
                  <span key={tag.label}>
                    {tag.label}
                    <b>{tag.count}</b>
                  </span>
                ))}
              </div>
            </section>

            <section className="brief-section">
              <h3>확인이 필요해요</h3>
              <div className="brief-card-list">
                {checkItems.map((item) => (
                  <article className="brief-card" key={item.title}>
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.body}</p>
                    </div>
                    <img src={icons.expandRight} alt="" />
                  </article>
                ))}
              </div>
            </section>

            <section className="brief-section">
              <h3>나에게 요청한 내용</h3>
              <div className="brief-card-list">
                {requestItems.map((item) => (
                  <article className="brief-card muted" key={item.title}>
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="brief-section reply-section">
              <h3>답변이 필요해요</h3>
              <div className="reply-card-list">
                {replyItems.map((item) => {
                  const isActive = item.id === activeReplyId

                  return (
                    <button
                      className={isActive ? 'reply-card is-active' : 'reply-card'}
                      type="button"
                      key={item.id}
                      onClick={() => toggleReply(item.id)}
                    >
                      <strong>{item.question}</strong>
                      <span>
                        <em>{item.meta}</em>
                        <b>{isActive ? '답변중...' : '답변하기'}</b>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <form className="brief-chat">
            <textarea aria-label="Zero에게 질문" placeholder="Zero에게 물어보세요..." />
            <div>
              <button type="button" aria-label="내용 추가">
                <img src={icons.add} alt="" />
              </button>
              <button type="button" aria-label="필터">
                <span />
              </button>
              <button className="send-button" type="submit" aria-label="보내기">
                ›
              </button>
            </div>
          </form>
        </aside>
      </main>
    </div>
  )
}
