import { useMemo, useState } from 'react'

import './flowBoard.css'
import { FlowBriefingSidebar } from './FlowBriefingSidebar'
import { FlowCanvas } from './FlowCanvas'
import { FlowEdgePanel, FlowNodePanel } from './FlowInspectorPanel'
import { FlowNavigationSidebar } from './FlowNavigationSidebar'
import { FlowRail } from './FlowRail'
import { icons, toneLabels } from './flowBoard.api'
import { toneOf } from './flowBoard.data'
import { buildFlowLayout } from './flowLayout'
import {
  MEETING_MODE,
  WORK_MODE,
  useEdgeDetails,
  useFlowBoardMeeting,
  useFlowGraph,
  useFlowIndexes,
  useFlowOptions,
  useMe,
  useProjectMeetings,
} from './useFlowBoardData'
import { useFlowBoard } from './useFlowBoard'
import { useFlowBoardUi } from './useFlowBoardUi'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

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

/** 주소에 회의를 남긴다. 새로고침해도 방금 고른 회의가 그대로 열려야 한다. */
function rememberMeetingInUrl(meetingId) {
  const url = new URL(window.location.href)
  url.searchParams.set('meeting', meetingId)
  window.history.replaceState({}, '', url)
}

export function FlowBoardPage() {
  const entryParams = new URLSearchParams(window.location.search)
  const [mode, setMode] = useState(MEETING_MODE)
  const [pickedMeetingId, setPickedMeetingId] = useState(null)
  const [panel, setPanel] = useState(
    entryParams.get('source') === 'bordo-briefing' ? { kind: 'briefing' } : null,
  )
  const [activeChip, setActiveChip] = useState(null)
  const [activeSummaryItem, setActiveSummaryItem] = useState(null)

  /*
    고른 것이 아니라 **끈 것**을 담는다.

    고른 것을 담으면 목록이 도착하기 전에는 "아직 모른다"(null)와 "아무것도 안
    골랐다"(빈 배열)를 구별해야 하고, 목록이 오는 순간 effect 로 초기화해야 한다.
    끈 것을 담으면 처음이 빈 배열 하나뿐이라 그 단계가 통째로 없어진다.
  */
  const [excludedParticipants, setExcludedParticipants] = useState([])
  const [excludedContents, setExcludedContents] = useState([])

  const me = useMe()
  const meeting = useFlowBoardMeeting(pickedMeetingId)
  const meetingId = meeting.data?.meetingId ?? null
  const projectId = meeting.data?.detail?.project_id ?? null

  const ui = useFlowBoardUi()
  const indexes = useFlowIndexes(meetingId, mode)
  const options = useFlowOptions(mode, meetingId, projectId)
  const meetingList = useProjectMeetings(projectId, ui.isMeetingMenuOpen)

  const filterOptions = options.data?.filter_options
  const allParticipants = useMemo(
    () => (filterOptions?.participants ?? []).map((p) => p.id),
    [filterOptions],
  )
  const allContents = useMemo(() => filterOptions?.content_types ?? [], [filterOptions])

  const pickedParticipants = allParticipants.filter((id) => !excludedParticipants.includes(id))
  const pickedContents = allContents.filter((value) => !excludedContents.includes(value))

  // 전부 끄면 조회하지 않는다. 아무 조건에도 안 맞는 것을 보여 달라는 뜻이라
  // 화면이 비는 것이 맞고, 빈 조건을 서버에 보내면 **거르지 않은 것으로 읽혀
  // 전부 다시 나온다.**
  const nothingPicked =
    (allParticipants.length > 0 && pickedParticipants.length === 0) ||
    (allContents.length > 0 && pickedContents.length === 0)

  const flow = useFlowGraph({
    mode,
    meetingId,
    projectId,
    enabled: !nothingPicked,
    participantIds: excludedParticipants.length ? pickedParticipants : [],
    contentTypes: excludedContents.length ? pickedContents : [],
  })

  const layout = useMemo(
    () => buildFlowLayout(flow.data?.nodes ?? [], flow.data?.arrows ?? []),
    [flow.data],
  )

  // 무대 크기를 배치에서 가져온다. 776×931 이 `BOARD_CONTENT_BOUNDS` · SVG
  // viewBox · CSS 세 곳에 각각 적혀 있어, 한 곳만 고치면 판이 어긋났다.
  const contentBounds = useMemo(
    () => ({ left: 0, top: 0, width: layout.stage.width, height: layout.stage.height }),
    [layout.stage.width, layout.stage.height],
  )

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
  } = useFlowBoard(contentBounds)

  const edgeIds = panel?.kind === 'edge' ? panel.edgeIds : []
  const edgeDetails = useEdgeDetails(edgeIds)

  const myAgentNodeId = useMemo(() => {
    // 대리인 노드가 `임수연의 Bordo` 로 박혀 있었다. 내 것인지는 노드의
    // `user_id` 와 로그인한 사람의 id 를 맞춰 봐야 안다.
    const myId = me.data?.id
    return myId
      ? (flow.data?.nodes ?? []).find((n) => n.kind === 'AGENT' && n.user_id === myId)?.id ?? null
      : null
  }, [flow.data, me.data])

  const summaryColumns = useMemo(
    () => toSummaryColumns(meeting.data?.summary),
    [meeting.data],
  )

  /*
    강조할 화살표.

    안건을 고르면 그 안건의 `related_edge_ids`, 브리핑 태그를 고르면 그 칩의
    `edge_ids`. 둘을 교집합으로 묶지 않는 이유는, 겹치는 것이 없을 때 판 전체가
    흐려져 **필터가 고장 난 것처럼 보이기** 때문이다.
  */
  const highlightedEdgeIds = useMemo(() => {
    if (ui.activeIndex) {
      return new Set(ui.activeIndex.related_edge_ids ?? [])
    }
    if (activeChip) {
      const chip = (meeting.data?.briefing?.location_chips ?? [])
        .find((c) => c.content_type === activeChip)
      return chip ? new Set(chip.edge_ids ?? []) : null
    }
    return null
  }, [ui.activeIndex, activeChip, meeting.data])

  const participantRows = (filterOptions?.participants ?? []).map((p) => ({
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

  /*
    검색 결과만 남긴다.

    기본이 전체 체크라 "걸러진 결과를 켠다" 는 아무 변화도 만들지 못한다.
    엔터는 **그 사람들만 보기**여야 한다. 그래서 보이는 사람을 뺀 나머지를
    끈 목록에 넣는다.
  */
  const checkOnly = (ids) => {
    const keep = new Set(ids)
    setExcludedParticipants(allParticipants.filter((id) => !keep.has(id)))
  }

  const switchMode = (next) => {
    if (next === mode) {
      return
    }
    // 종류 목록이 모드마다 통째로 다르다(회의 6종 ↔ 작업 5종). 끈 것을 들고
    // 넘어가면 다른 모드에 없는 코드가 조건에 실려 **조회가 400 으로 죽는다.**
    setMode(next)
    setExcludedContents([])
    setActiveSummaryItem(null)
    ui.setActiveIndex(null)
    setPanel(null)
  }

  const selectNode = (node) => {
    // 내 대리인을 누르면 브리핑, 남을 누르면 그 사람 패널.
    setPanel(node.id === myAgentNodeId
      ? { kind: 'briefing', nodeId: node.id }
      : { kind: 'node', nodeId: node.id, node })
  }

  const selectBadge = (badgeId, count, arrow) => {
    setPanel({
      kind: 'edge',
      badgeId,
      count,
      direction: arrow.direction_label,
      edgeIds: count.edge_ids ?? [],
    })
  }

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

  // 회의가 하나도 없으면 **판이 아니라 안내를 그린다.**
  //
  // 여기서 막지 않으면 읽기는 성공했으므로 위 두 갈래를 지나쳐 보드가 그대로
  // 그려진다. 제목은 빈 문자열, 요약표는 빈 칸, 화살표 개수는 0 — 사용자에게는
  // **고장 난 화면으로 보인다.** "아직 회의가 없다" 와 "못 불러왔다" 는 다르다.
  if (!meetingId) {
    return (
      <div className="flow-board-page">
        <FlowRail />
        <Empty>아직 열린 회의가 없습니다. 회의가 끝나면 여기에 흐름이 그려집니다.</Empty>
      </div>
    )
  }

  const selectedNode = panel?.kind === 'node' ? panel.node : null
  const selectedNodeId = panel?.nodeId ?? null
  const briefing = meeting.data?.briefing ?? null
  const participantOf = (node) => (meeting.data?.detail?.participants ?? [])
    .find((p) => p.user_id === node.user_id)

  // 서버가 `8/17 글로벌 회의 일정 및 개발 방향 논의` · `8.10 - 8.16 작업 흐름`
  // 처럼 완성해 준다. 날짜를 클라이언트가 찍으면 브라우저 시간대로 나가 같은
  // 회의를 사람마다 다른 날짜로 본다.
  const headerLabel = flow.data?.meeting_label
    ?? flow.data?.period_label
    ?? meeting.data?.detail?.title
    ?? ''

  return (
    <div className="flow-board-page">
      <FlowRail />

      <FlowNavigationSidebar
        activeCategory={mode}
        activeIndex={ui.activeIndex}
        collapsedFilters={ui.collapsedFilters}
        contentFilters={contentRows}
        icons={icons}
        indexEmptyText={mode === WORK_MODE ? '묶인 문서가 없습니다.' : '잡힌 안건이 없습니다.'}
        indexes={indexes.data?.results ?? []}
        isCollapsed={ui.isFlowSidebarCollapsed}
        isScrolled={ui.isSidebarScrolled}
        isTimeOrdered={ui.isTimeOrdered}
        onCategorySelect={switchMode}
        onContentToggle={toggleExcluded(setExcludedContents)}
        onFilterCollapseToggle={ui.toggleFilterCollapse}
        onIndexSelect={ui.toggleIndex}
        onParticipantKeywordChange={ui.setParticipantKeyword}
        onParticipantSearchSubmit={checkOnly}
        onParticipantToggle={toggleExcluded(setExcludedParticipants)}
        onScroll={(event) => ui.setIsSidebarScrolled(event.currentTarget.scrollTop > 0)}
        onSidebarToggle={ui.toggleFlowSidebar}
        onTimeOrderToggle={ui.toggleTimeOrder}
        participantKeyword={ui.participantKeyword}
        participants={participantRows}
        teamName={meeting.data?.detail?.project_name}
      />

      <main className={panel ? 'flow-workspace has-record-panel' : 'flow-workspace'}>
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
            <h1>{headerLabel}</h1>
            <button
              type="button"
              aria-label="회의 선택"
              aria-expanded={ui.isMeetingMenuOpen}
              onClick={ui.toggleMeetingMenu}
            >
              <img className={ui.isMeetingMenuOpen ? 'is-open' : ''} src={icons.expandDown} alt="" />
            </button>

            {/* 아이콘만 180도 돌고 아무것도 안 뜨던 자리다. 회의를 바꿀 방법이
                주소를 손으로 고치는 것뿐이었다. */}
            {ui.isMeetingMenuOpen ? (
              <div className="meeting-menu" role="listbox" aria-label="회의 목록">
                {meetingList.loading && !meetingList.data ? <Loading label="회의 목록을 읽는 중입니다…" /> : null}
                {meetingList.error ? <LoadError error={meetingList.error} onRetry={meetingList.reload} /> : null}
                {meetingList.data?.results?.length === 0 ? <Empty>이 프로젝트에 회의가 없습니다.</Empty> : null}
                {(meetingList.data?.results ?? []).map((item) => (
                  <button
                    className={item.id === meetingId ? 'is-active' : ''}
                    type="button"
                    key={item.id}
                    role="option"
                    aria-selected={item.id === meetingId}
                    onClick={() => {
                      setPickedMeetingId(item.id)
                      rememberMeetingInUrl(item.id)
                      setPanel(null)
                      ui.setActiveIndex(null)
                      ui.setIsMeetingMenuOpen(false)
                    }}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
          </header>

          <div className="board-center-frame">
            <div
              className="board-zoom-surface"
              style={{
                width: layout.stage.width * renderedZoom,
                height: layout.stage.height * renderedZoom,
              }}
            >
              <FlowCanvas
                activeBadgeId={panel?.badgeId ?? null}
                highlightedEdgeIds={highlightedEdgeIds}
                layout={layout}
                myAgentNodeId={myAgentNodeId}
                onBadgeSelect={selectBadge}
                onNodeSelect={selectNode}
                selectedNodeId={selectedNodeId}
                showRecency={ui.isTimeOrdered}
                style={{ transform: `scale(${renderedZoom})` }}
              >
                <article
                  className="summary-board"
                  style={{
                    left: layout.summary.left,
                    top: layout.summary.top,
                    width: layout.summary.width,
                    minHeight: layout.summary.height,
                  }}
                >
                  {/* 작업 모드에는 요약표가 없다. `주요 작업 / 주요 변경 /
                      공유·연결` 은 계획에만 있고 엔드포인트가 없어서, 회의
                      요약을 그대로 띄우면 **작업 화면에서 회의 이야기를 읽게 된다.** */}
                  {mode === WORK_MODE ? (
                    <Empty>작업 모드 요약표는 아직 서버에 없습니다.</Empty>
                  ) : summaryColumns.length === 0 ? (
                    <Empty>아직 정리된 회의 요약이 없습니다.</Empty>
                  ) : summaryColumns.map((column) => (
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
                              title={item}
                              onClick={() => {
                                setActiveSummaryItem((current) => (current === itemKey ? null : itemKey))
                                setPanel({ kind: 'briefing' })
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
              </FlowCanvas>

              {/*
                조회 상태를 판 위에 겹쳐 보여 준다. 캔버스를 지우고 스피너만
                띄우면 필터를 한 칸 누를 때마다 판이 사라졌다 나타나 깜빡인다.
              */}
              {flow.loading && !flow.data ? (
                <div className="board-status"><Loading label="흐름을 그리는 중입니다…" /></div>
              ) : null}
              {flow.error && !flow.data ? (
                <div className="board-status"><LoadError error={flow.error} onRetry={flow.reload} /></div>
              ) : null}
              {nothingPicked ? (
                <div className="board-status"><Empty>필터가 전부 꺼져 있습니다. 하나 이상 켜 주세요.</Empty></div>
              ) : null}
              {!flow.loading && !flow.error && !nothingPicked && layout.nodes.length === 0 ? (
                <div className="board-status">
                  <Empty>{mode === WORK_MODE ? '이 기간에 오간 작업이 없습니다.' : '이 회의에서 오간 내용이 없습니다.'}</Empty>
                </div>
              ) : null}
            </div>
          </div>

          {/*
            `zoom > minZoom` 일 때만 그리던 탓에 기본 상태에서는 확대 버튼이
            **화면에 아예 없었다.** 확대하려면 먼저 확대해야 하는 셈이었다.
          */}
          <div className="zoom-controls" aria-label="플로우보드 확대 축소">
            <button type="button" aria-label="축소" onClick={zoomOut} disabled={zoom <= minZoom}>
              -
            </button>
            <output aria-live="polite">{zoomPercent}%</output>
            <button type="button" aria-label="확대" onClick={zoomIn} disabled={zoom >= maxZoom}>
              +
            </button>
          </div>
        </section>

        {panel?.kind === 'briefing' ? (
          briefing ? (
            <FlowBriefingSidebar
              activeChip={activeChip}
              briefing={briefing}
              icons={icons}
              isScrolled={ui.isBriefScrolled}
              onChipToggle={(contentType) => setActiveChip((c) => (c === contentType ? null : contentType))}
              onClose={() => setPanel(null)}
              onScroll={(event) => ui.setIsBriefScrolled(event.currentTarget.scrollTop > 0)}
            />
          ) : (
            <aside className="briefing-panel inspector-panel" aria-label="Bordo 브리핑">
              <header className="briefing-header">
                <h2>Bordo 브리핑</h2>
                <button className="panel-close" type="button" aria-label="패널 닫기" onClick={() => setPanel(null)}>
                  ×
                </button>
              </header>
              {/* 브리핑은 불참자에게만 만들어진다. 참석한 사람에게는 404 다 —
                  오류가 아니라 "브리핑받을 것이 없다" 이므로 그렇게 말한다. */}
              <Empty>이 회의에는 받을 브리핑이 없습니다.</Empty>
            </aside>
          )
        ) : null}

        {panel?.kind === 'node' && selectedNode ? (
          <FlowNodePanel
            node={selectedNode}
            participant={participantOf(selectedNode)}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel?.kind === 'edge' ? (
          <FlowEdgePanel
            count={panel.count}
            direction={panel.direction}
            edges={edgeDetails}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </main>
    </div>
  )
}
