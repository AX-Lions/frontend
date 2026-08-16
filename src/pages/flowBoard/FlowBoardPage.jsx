import { useState } from 'react'

import './flowBoard.css'
import { FlowBriefingSidebar } from './FlowBriefingSidebar'
import { FlowMetricBadge } from './FlowMetricBadge'
import { FlowNavigationSidebar } from './FlowNavigationSidebar'
import { FlowRail } from './FlowRail'
import {
  BOARD_CONTENT_BOUNDS,
  boardMetrics,
  contentFilters,
  icons,
  indexes,
  meetingRecord,
  participants,
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
  const isBordoBriefingEntry = new URLSearchParams(window.location.search).get('source') === 'bordo-briefing'
  const [recordPanelMode, setRecordPanelMode] = useState(isBordoBriefingEntry ? 'bordo' : null)
  const [activeSummaryItem, setActiveSummaryItem] = useState(null)
  const isRecordPanelOpen = recordPanelMode !== null
  const isBordoPanelOpen = recordPanelMode === 'bordo'
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
  } = useFlowBoardUi(indexes[0])

  return (
    <div className="flow-board-page">
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

      <main className={isRecordPanelOpen ? 'flow-workspace has-record-panel' : 'flow-workspace'}>
        <section
          className={isPanning ? 'flow-board is-panning' : 'flow-board'}
          aria-label="회의 플로우보드"
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
                    <marker id="flow-arrow-diagonal" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
                      <path d="M0,0 L8,4 L0,8" />
                    </marker>
                  </defs>
                  <path className="connector-top" d="M175 376 H589" />
                  <path className="connector-left" d="M614 425 L131 688" />
                  <path className="connector-right" d="M666 452 V681" />
                </svg>

                <article className="summary-board">
                  {summaryColumns.map((column) => (
                    <section className="summary-column" key={column.title}>
                      <h2>{column.title}</h2>
                      <div>
                        {column.items.map((item) => (
                          <button
                            className={activeSummaryItem === `${column.title}-${item}` ? 'is-active' : ''}
                            type="button"
                            key={item}
                            onClick={() => {
                              setActiveSummaryItem(`${column.title}-${item}`)
                              setRecordPanelMode('meeting')
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </section>
                  ))}
                </article>

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

                <div
                  className={isBordoPanelOpen ? 'ai-profile is-open' : 'ai-profile'}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClickCapture={(event) => {
                    event.stopPropagation()
                    setRecordPanelMode((mode) => (mode === 'bordo' ? null : 'bordo'))
                  }}
                >
                  <button className="ai-avatar" type="button" aria-label="임수연의 Bordo 활동내역">
                    <span className="ai-spark">B</span>
                    <strong>
                      임수연의
                      <br />
                      Bordo
                    </strong>
                  </button>
                  <p>Bordo의 활동내역을 보려면 위 버튼을 눌러주세요!</p>
                </div>
              </div>
            </div>
          </div>

          {zoom > minZoom ? (
            <div className="zoom-controls" aria-label="플로우보드 확대 축소">
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

        {isRecordPanelOpen ? (
          <FlowBriefingSidebar
            activeBriefTag={activeBriefTag}
            icons={icons}
            isChatActive={isBriefChatActive}
            isSearchActive={isBriefSearchActive}
            isScrolled={isBriefScrolled}
            meetingRecord={meetingRecord}
            mode={recordPanelMode}
            onBriefTagToggle={toggleBriefTag}
            onChatActiveChange={setIsBriefChatActive}
            onScroll={(event) => setIsBriefScrolled(event.currentTarget.scrollTop > 0)}
            onSearchActiveChange={setIsBriefSearchActive}
          />
        ) : null}
      </main>
    </div>
  )
}
