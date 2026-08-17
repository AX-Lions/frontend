import { useMemo, useState } from 'react'

import './flowBoard.css'
import { FlowBriefingSidebar } from './FlowBriefingSidebar'
import { FlowMetricBadge } from './FlowMetricBadge'
import { FlowNavigationSidebar } from './FlowNavigationSidebar'
import { FlowRail } from './FlowRail'
import {
  BOARD_CONTENT_BOUNDS,
  boardMetrics,
  icons,
  meetingRecord,
  toneLabels,
} from './flowBoard.api'
import { toneOf } from './flowBoard.data'
import { useFlowBoardMeeting, useMeetingFlow } from './useFlowBoardData'
import { useFlowBoard } from './useFlowBoard'
import { useFlowBoardUi } from './useFlowBoardUi'
import { LoadError, Loading } from '../../shared/components/LoadState.jsx'

/**
 * 요약표 3열.
 *
 * 서버는 `discovered_issues` · `changes` · `next_plans` 세 배열로 준다. 제목은
 * 화면 라벨을 따른다 — 중앙 요약표 헤더가 `변동 사항` 이라 `changes` 를
 * `변동 사항` 으로 읽는다.
 */
function toSummaryColumns(summary) {
  if (!summary) {
    return []
  }
  return [
    { title: '발견한 문제', items: summary.discovered_issues ?? [] },
    { title: '변동 사항', items: summary.changes ?? [] },
    { title: '이후 계획', items: summary.next_plans ?? [] },
  ]
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

  const meeting = useFlowBoardMeeting('MEETING')
  const meetingId = meeting.data?.meetingId ?? null

  /*
    고른 것이 아니라 **끈 것**을 담는다.

    고른 것을 담으면 목록이 도착하기 전에는 "아직 모른다"(null)와 "아무것도 안
    골랐다"(빈 배열)를 구별해야 하고, 목록이 오는 순간 effect 로 초기화해야 한다.
    끈 것을 담으면 처음이 빈 배열 하나뿐이라 그 단계가 통째로 없어진다.
  */
  const [excludedParticipants, setExcludedParticipants] = useState([])
  const [excludedContents, setExcludedContents] = useState([])

  const options = meeting.data?.options
  const allParticipants = useMemo(() => (options?.participants ?? []).map((p) => p.id), [options])
  const allContents = options?.content_types ?? []

  const pickedParticipants = allParticipants.filter((id) => !excludedParticipants.includes(id))
  const pickedContents = allContents.filter((value) => !excludedContents.includes(value))

  // 전부 끄면 조회하지 않는다. 아무 조건에도 안 맞는 것을 보여 달라는 뜻이라
  // 화면이 비는 것이 맞고, 빈 조건을 서버에 보내면 **거르지 않은 것으로 읽혀
  // 전부 다시 나온다.**
  const nothingPicked =
    (allParticipants.length > 0 && pickedParticipants.length === 0) ||
    (allContents.length > 0 && pickedContents.length === 0)

  const flow = useMeetingFlow(
    nothingPicked ? null : meetingId,
    excludedParticipants.length ? pickedParticipants : [],
    excludedContents.length ? pickedContents : [],
  )

  const participantRows = (options?.participants ?? []).map((p) => ({
    id: p.id,
    label: p.label,
    checked: !excludedParticipants.includes(p.id),
  }))

  const contentRows = allContents.map((value) => ({
    value,
    name: toneLabels[toneOf(value)] ?? value,
    tone: toneOf(value),
    checked: !excludedContents.includes(value),
  }))

  const toggleExcluded = (setter) => (value) => setter((current) => (
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  ))

  const summaryColumns = useMemo(() => toSummaryColumns(meeting.data?.summary), [meeting.data])

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
  } = useFlowBoardUi(null)

  if (meeting.loading && !meeting.data) {
    return <div className="flow-board-page"><Loading label="회의를 불러오는 중입니다…" /></div>
  }

  if (meeting.error && !meeting.data) {
    return (
      <div className="flow-board-page">
        <LoadError error={meeting.error} onRetry={meeting.reload} />
      </div>
    )
  }

  return (
    <div className="flow-board-page">
      <FlowRail activeRail={activeRail} icons={icons} onRailSelect={setActiveRail} />

      <FlowNavigationSidebar
        activeCategory={activeCategory}
        activeIndex={activeIndex}
        collapsedFilters={collapsedFilters}
        contentFilters={contentRows}
        icons={icons}
        indexes={meeting.data?.indexes ?? []}
        isCollapsed={isFlowSidebarCollapsed}
        isScrolled={isSidebarScrolled}
        onCategorySelect={setActiveCategory}
        onContentToggle={toggleExcluded(setExcludedContents)}
        onFilterCollapseToggle={toggleFilterCollapse}
        onIndexSelect={setActiveIndex}
        onParticipantToggle={toggleExcluded(setExcludedParticipants)}
        onScroll={(event) => setIsSidebarScrolled(event.currentTarget.scrollTop > 0)}
        onSidebarToggle={toggleFlowSidebar}
        participants={participantRows}
        teamName={meeting.data?.detail?.project_name}
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
            {/* 서버가 `8/17 글로벌 회의 일정 및 개발 방향 논의` 처럼 완성해 준다.
                날짜를 클라이언트가 찍으면 브라우저 시간대로 나가 같은 회의를
                사람마다 다른 날짜로 본다. */}
            <h1>{flow.data?.meeting_label ?? meeting.data?.detail?.title ?? ''}</h1>
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
                        {column.items.length === 0 ? (
                          <p className="summary-column-empty">없음</p>
                        ) : column.items.map((item, i) => {
                          // 같은 문구가 두 번 나올 수 있다. 문구를 key 로 쓰면
                          // 하나가 사라지고, 누를 때도 둘이 같이 눌린다.
                          const itemKey = `${column.title}-${i}`

                          return (
                            <button
                              className={activeSummaryItem === itemKey ? 'is-active' : ''}
                              type="button"
                              key={itemKey}
                              onClick={() => {
                                setActiveSummaryItem(itemKey)
                                setRecordPanelMode('meeting')
                              }}
                            >
                              {item}
                            </button>
                          )
                        })}
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
