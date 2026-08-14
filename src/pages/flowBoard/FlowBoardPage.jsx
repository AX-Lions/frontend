import './flowBoard.css'
import { FlowBriefingSidebar } from './FlowBriefingSidebar'
import { FlowMetricBadge } from './FlowMetricBadge'
import { FlowNavigationSidebar } from './FlowNavigationSidebar'
import { FlowRail } from './FlowRail'
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
} from './flowBoard.api'
import { useFlowBoard } from './useFlowBoard'
import { useFlowBoardUi } from './useFlowBoardUi'

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
            <FlowMetricBadge tone={item.tone} />
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

export function FlowBoardPage() {
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
  } = useFlowBoard(BOARD_CONTENT_BOUNDS)
  const {
    activeBriefTag,
    activeCategory,
    activeIndex,
    activeMetricId,
    activeRail,
    activeReplyId,
    clearReply,
    collapsedFilters,
    isBriefChatActive,
    isBriefSearchActive,
    isFlowSidebarCollapsed,
    isBriefScrolled,
    isMeetingMenuOpen,
    isSidebarScrolled,
    setActiveCategory,
    setActiveIndex,
    setActiveRail,
    setIsBriefChatActive,
    setIsBriefSearchActive,
    setIsBriefScrolled,
    setIsSidebarScrolled,
    toggleBriefTag,
    toggleFlowSidebar,
    toggleFilterCollapse,
    toggleMeetingMenu,
    toggleMetric,
    toggleReply,
  } = useFlowBoardUi(indexes[0])

  const clearReplyFocus = (event) => {
    if (activeReplyId && !event.target.closest('.reply-card')) {
      clearReply()
    }
  }

  return (
    <div className="flow-board-page" onPointerDownCapture={clearReplyFocus}>
      <FlowRail activeRail={activeRail} icons={icons} onRailSelect={setActiveRail} />

      <FlowNavigationSidebar
        activeCategory={activeCategory}
        activeIndex={activeIndex}
        collapsedFilters={collapsedFilters}
        contentFilters={contentFilters}
        icons={icons}
        indexes={indexes}
        isCollapsed={isFlowSidebarCollapsed}
        isScrolled={isSidebarScrolled}
        onCategorySelect={setActiveCategory}
        onFilterCollapseToggle={toggleFilterCollapse}
        onIndexSelect={setActiveIndex}
        onScroll={(event) => setIsSidebarScrolled(event.currentTarget.scrollTop > 0)}
        onSidebarToggle={toggleFlowSidebar}
        participants={participants}
      />

      <main className="flow-workspace">
        <section
          className={isPanning ? 'flow-board is-panning' : 'flow-board'}
          aria-label="회의 플로우 보드"
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

          <div className="board-center-frame">
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
          </div>

          {zoom > minZoom ? (
            <div className="zoom-controls" aria-label="플로우 보드 확대 축소">
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

        <FlowBriefingSidebar
          activeBriefTag={activeBriefTag}
          activeReplyId={activeReplyId}
          briefTags={briefTags}
          checkItems={checkItems}
          icons={icons}
          isChatActive={isBriefChatActive}
          isSearchActive={isBriefSearchActive}
          isScrolled={isBriefScrolled}
          onBriefTagToggle={toggleBriefTag}
          onChatActiveChange={setIsBriefChatActive}
          onReplyToggle={toggleReply}
          onScroll={(event) => setIsBriefScrolled(event.currentTarget.scrollTop > 0)}
          onSearchActiveChange={setIsBriefSearchActive}
          replyItems={replyItems}
          requestItems={requestItems}
        />
      </main>
    </div>
  )
}
