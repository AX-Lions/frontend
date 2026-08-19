import { useEffect, useMemo, useRef, useState } from 'react'

import { useSearchParam } from '../../app/navigation.js'
import './flowBoard.css'
import { FlowBriefingSidebar } from './FlowBriefingSidebar'
import { FlowCanvas } from './FlowCanvas'
import { FlowEdgePanel, FlowNodePanel } from './FlowInspectorPanel'
import { FlowNavigationSidebar } from './FlowNavigationSidebar'
import { FlowRail } from './FlowRail'
// 팀 전환하기는 홈에서 먼저 생겼다. 회의 화면에도 같은 팝업이 필요해져
// 여기서 그대로 가져다 쓴다 — 팝업 하나 때문에 `pages/home` 전체를
// `shared` 로 옮기면 그쪽에 남는 `NewProjectDialog` 등도 다 옮겨야 한다.
import { TeamSwitchDialog } from '../home/TeamSwitchDialog.jsx'
import { icons, toneLabels } from './flowBoard.api'
import { fetchBriefing, toneOf } from './flowBoard.data'
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
  const [switchingTeam, setSwitchingTeam] = useState(false)

  /*
    주소의 회의·프로젝트를 **계속 지켜본다.**

    한 번만 읽으면 뒤로 가기가 먹통이 된다. 주소는 `?meeting=A` 로 돌아갔는데
    화면은 회의 B 그대로고, 그 상태로 새로고침하면 갑자기 A 로 바뀐다.

    헤더에서 고른 회의(`pick`)는 **그 주소에 대해서만** 유효하다. 주소가
    달라지면 고른 것은 버린다 — 주소가 이긴다. 그래야 뒤로 가기로 돌아온
    회의가 화면에 뜬다.
  */
  const urlMeetingId = useSearchParam('meeting')
  const urlProjectId = useSearchParam('project')
  const [pick, setPick] = useState(null)
  const pickedMeetingId = pick && pick.forUrl === urlMeetingId ? pick.id : null
  const setPickedMeetingId = (id) => setPick({ forUrl: urlMeetingId, id })
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
  const meeting = useFlowBoardMeeting(pickedMeetingId, urlMeetingId, urlProjectId)
  const meetingId = meeting.data?.meetingId ?? null
  // 회의 상세에서 꺼내지 않는다. **회의가 없는 프로젝트도 자기 id 와 이름을
  // 알아야** 하는데, 그때는 상세가 없다.
  const projectId = meeting.data?.projectId ?? null
  const projectName = meeting.data?.projectName ?? ''

  /*
    브리핑을 **실제로 열었을 때만** 읽음으로 올린다.

    이 화면은 패널을 열든 말든 회의를 열 때 브리핑을 부른다. 그래서 회의 화면에
    잠깐 들른 것만으로 홈의 `Bordo 브리핑 보러가기` 가 사라졌다 — 사용자는 읽은
    적이 없는데 읽은 것이 된다. 자동 조회는 `markRead: false` 로 바꿨고, 올리는
    것은 여기 한 곳이다.

    회의마다 한 번만 보낸다. 패널을 닫았다 다시 열 때마다 보내면 같은 요청이
    의미 없이 반복된다 — 이미 읽음인 것을 다시 읽음으로 만들 뿐이다.

    실패는 삼킨다. 읽음 표시를 못 올렸다고 브리핑을 못 보여 줄 이유가 없다.
  */
  const markedMeetingRef = useRef(null)
  const briefingOpen = panel?.kind === 'briefing'
  useEffect(() => {
    if (!briefingOpen || !meetingId || markedMeetingRef.current === meetingId) {
      return
    }
    markedMeetingRef.current = meetingId
    fetchBriefing(meetingId).catch(() => {})
  }, [briefingOpen, meetingId])

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

  const summaryColumns = useMemo(
    () => toSummaryColumns(meeting.data?.summary),
    [meeting.data],
  )

  /*
    요약표에서 가장 긴 열의 줄 수.

    배치보다 **먼저** 구해야 한다. 요약표가 판 맨 위에 고정되면서 상자의
    아래 경계가 곧 그래프가 시작하는 자리가 됐다. 높이를 모르면 노드를
    어디부터 앉힐지 정할 수 없다 — 넉넉히 잡으면 상자와 노드 사이가 허옇게
    뜨고, 모자라게 잡으면 상자가 노드를 덮는다.

    작업 모드는 요약표 자리에 "아직 서버에 없습니다" 안내문만 뜨므로 0 이다.
  */
  const summaryRows = useMemo(
    () => (mode === WORK_MODE
      ? 0
      : summaryColumns.reduce((rows, column) => Math.max(rows, column.items.length), 0)),
    [mode, summaryColumns],
  )

  const layout = useMemo(
    () => buildFlowLayout(flow.data?.nodes ?? [], flow.data?.arrows ?? [], { summaryRows }),
    [flow.data, summaryRows],
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

  /*
    판에서 나를 가리키는 노드.

    전에는 **내 대리인 노드**(`kind: 'AGENT'`)를 찾았다. 대리인을 주인에게
    접으면서 그 노드가 없어졌다 — 그대로 두면 `null` 이 되어 내 자리 표시가
    사라지고, **브리핑으로 들어가는 입구도 같이 없어진다.** 대리인이 내 노드
    안으로 들어왔으므로 이제 내 노드가 그 입구다.
  */
  const myNodeId = useMemo(() => {
    const myId = me.data?.id
    return myId
      ? (flow.data?.nodes ?? []).find((n) => n.kind === 'USER' && n.user_id === myId)?.id ?? null
      : null
  }, [flow.data, me.data])

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
    // 내 노드를 누르면 브리핑(내 대리인이 한 일), 남을 누르면 그 사람 패널.
    setPanel(node.id === myNodeId
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
  //
  // 프로젝트 이름을 앞에 붙인다. 이 자리에는 헤더가 없어서, 사이드바에서 누른
  // 것이 열렸는지 확인할 단서가 이 한 줄뿐이다. 이름 없이 `회의가 없습니다`
  // 만 뜨면 **엉뚱한 프로젝트가 열린 것과 구별되지 않는다** — 방금 고친 결함이
  // 그 모습이었다.
  if (!meetingId) {
    return (
      <div className="flow-board-page">
        <FlowRail />
        <Empty>
          {projectName ? `${projectName}에는 ` : ''}
          아직 열린 회의가 없습니다. 회의가 끝나면 여기에 흐름이 그려집니다.
        </Empty>
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
      <FlowRail collapsed={ui.isFlowSidebarCollapsed} />

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
        onTeamSwitch={() => setSwitchingTeam(true)}
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
                myNodeId={myNodeId}
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

      {switchingTeam ? <TeamSwitchDialog onClose={() => setSwitchingTeam(false)} /> : null}
    </div>
  )
}
