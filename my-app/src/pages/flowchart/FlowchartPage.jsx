import { useEffect, useRef, useState } from 'react'
import './flowchart.css'

const icons = {
  add: '/icons/AddIcon.svg',
  bookCheck: '/icons/Book_check.svg',
  chat: '/icons/Chat.svg',
  checked: '/icons/checked.svg',
  database: '/icons/Database.svg',
  desk: '/icons/Desk_alt.svg',
  expandDown: '/icons/ExpandDown.svg',
  expandLeftDouble: '/icons/Expand_left_double.svg',
  expandRight: '/icons/Expandright.svg',
  figmaCategoryMeeting: '/icons/Book_check.svg',
  figmaCategoryWork: '/icons/Desk_alt.svg',
  figmaGlobalChat: '/figma-icons/figma-global-chat.svg',
  figmaGlobalHome: '/figma-icons/figma-global-home.svg',
  figmaGlobalMeeting: '/figma-icons/figma-global-meeting.svg',
  folder: '/icons/FolderIcon.svg',
  home: '/icons/HomeIcon.svg',
  refresh: '/icons/Refresh.svg',
  search: '/icons/Search.svg',
}

const participants = [
  { name: '유수인', checked: true },
  { name: '서재민', checked: true },
  { name: '강다은', checked: true },
  { name: '임수연의 Bordo', checked: true },
  { name: '최비성', checked: false },
  { name: '임수연', checked: false },
]

const contentFilters = [
  { name: '의견', tone: 'opinion', checked: true },
  { name: '요청사항', tone: 'request', checked: true },
  { name: '변동사항', tone: 'change', checked: true },
  { name: '일정', tone: 'schedule', checked: true },
  { name: '결론', tone: 'decision', checked: false },
]

const indexes = [
  '진행 상황 공유',
  '백엔드 개발 논의',
  '프론트엔드/디자인 싱크 맞추기',
  '기획안 작성 방향 논의',
  '작업 마감 기한 논의',
]

const summaryColumns = [
  {
    title: '발견한 문제',
    items: ['로그인 오류 발생', '모바일 화면 깨짐', 'API 응답 속도 저하', '알림 일부 누락', '사용자 피드백 부족'],
  },
  {
    title: '변동 사항',
    items: ['개발 일정 2일 연기', '담당자 변경', '디자인 시안 수정', '기능 우선순위 변경', '테스트 범위 확대'],
  },
  {
    title: '이후 계획',
    items: ['로그인 오류 수정', 'QA 테스트 진행', '수정안 최종 검토', '개발 팀에 내용 공유', '다음 회의에서 확정'],
  },
]

const boardMetrics = {
  top: [
    { tone: 'opinion', count: 3 },
    { tone: 'request', count: 5 },
    { tone: 'change', count: 2 },
  ],
  left: [
    { tone: 'request', count: 2 },
    { tone: 'change', count: 3 },
    { tone: 'schedule', count: 1 },
  ],
  right: [
    { tone: 'opinion', count: 1 },
    { tone: 'request', count: 1 },
    { tone: 'change', count: 2 },
    { tone: 'schedule', count: 1 },
  ],
}

const briefTags = [
  { label: '중요', count: 3 },
  { label: '결정', count: 3 },
  { label: '요청사항', count: 2 },
  { label: '수정사항', count: 4 },
]

const checkItems = [
  { title: '백엔드 개발 일정 변경', body: 'API 연동 완료일이 8/16 → 8/19로 변경됐어요.' },
  { title: '디자인 수정 요청', body: '임수연님이 회의 화면의 우측 패널 너비 조정을 요청했어요.' },
]

const requestItems = [
  { title: '8/15까지 회의 화면 디자인 수정', body: '서재민님이 요청했어요.' },
  { title: '수정된 화면 개발팀에 공유', body: '다음 회의 전까지 확인이 필요해요.' },
]

const BOARD_CONTENT_BOUNDS = {
  left: 94,
  top: 72,
  width: 588,
  height: 800,
}
const MIN_ZOOM = 1
const MAX_ZOOM = 1.2
const ZOOM_STEP = 0.1

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
}

function BadgeIcon({ tone }) {
  const labels = {
    opinion: '의견',
    request: '요청',
    change: '수정',
    schedule: '일정',
    decision: '결정',
  }

  return (
    <span className={`metric-icon ${tone}`} aria-label={labels[tone]}>
      <span />
    </span>
  )
}

function MetricGroup({ className, items }) {
  return (
    <div className={`metric-group ${className}`}>
      {items.map((item) => (
        <span className="metric-item" key={`${className}-${item.tone}`}>
          <BadgeIcon tone={item.tone} />
          <b>{item.count}</b>
        </span>
      ))}
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
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [fitScale, setFitScale] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const boardRef = useRef(null)
  const hasCenteredBoard = useRef(false)
  const panState = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  })
  const zoomPercent = Math.round(zoom * 100)
  const renderedZoom = (fitScale || 1) * zoom

  const setZoomFromPoint = (nextZoom, point) => {
    const board = boardRef.current

    setZoom((currentZoom) => {
      const resolvedZoom = clampZoom(nextZoom)

      if (!board || resolvedZoom === currentZoom) {
        return resolvedZoom
      }

      const viewportPoint = point ?? {
        x: board.clientWidth / 2,
        y: board.clientHeight / 2,
      }
      const baseScale = fitScale || 1
      const currentRenderedZoom = baseScale * currentZoom
      const resolvedRenderedZoom = baseScale * resolvedZoom
      const boardX = (board.scrollLeft + viewportPoint.x) / currentRenderedZoom
      const boardY = (board.scrollTop + viewportPoint.y) / currentRenderedZoom

      window.requestAnimationFrame(() => {
        board.scrollLeft = boardX * resolvedRenderedZoom - viewportPoint.x
        board.scrollTop = boardY * resolvedRenderedZoom - viewportPoint.y
      })

      return resolvedZoom
    })
  }

  const zoomOut = () => setZoomFromPoint(zoom - ZOOM_STEP)
  const zoomIn = () => setZoomFromPoint(zoom + ZOOM_STEP)

  const handleBoardWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) {
      return
    }

    event.preventDefault()
    const board = boardRef.current
    const rect = board.getBoundingClientRect()
    const zoomDelta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP

    setZoomFromPoint(zoom + zoomDelta, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  const handleBoardPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('.zoom-controls, .meeting-title button')) {
      return
    }

    const board = boardRef.current

    if (!board) {
      return
    }

    panState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: board.scrollLeft,
      scrollTop: board.scrollTop,
    }
    board.setPointerCapture(event.pointerId)
    setIsPanning(true)
  }

  const handleBoardPointerMove = (event) => {
    const board = boardRef.current

    if (!board || panState.current.pointerId !== event.pointerId) {
      return
    }

    event.preventDefault()
    board.scrollLeft = panState.current.scrollLeft - (event.clientX - panState.current.startX)
    board.scrollTop = panState.current.scrollTop - (event.clientY - panState.current.startY)
  }

  const stopBoardPan = (event) => {
    const board = boardRef.current

    if (board && panState.current.pointerId === event.pointerId) {
      board.releasePointerCapture(event.pointerId)
    }

    panState.current.pointerId = null
    setIsPanning(false)
  }

  useEffect(() => {
    const preventBrowserZoom = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
      }
    }

    window.addEventListener('wheel', preventBrowserZoom, { passive: false })

    return () => {
      window.removeEventListener('wheel', preventBrowserZoom)
    }
  }, [])

  useEffect(() => {
    const board = boardRef.current

    if (!board) {
      return
    }

    const updateFitScale = () => {
      const boardHeader = board.querySelector('.meeting-title')
      const availableWidth = board.clientWidth
      const availableHeight = board.clientHeight - (boardHeader?.offsetHeight ?? 64)
      const nextFitScale = Math.min(
        availableWidth / BOARD_CONTENT_BOUNDS.width,
        availableHeight / BOARD_CONTENT_BOUNDS.height,
      )

      setFitScale(Number(nextFitScale.toFixed(4)))
    }

    updateFitScale()

    const resizeObserver = new ResizeObserver(updateFitScale)
    resizeObserver.observe(board)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const board = boardRef.current

    if (!board || !fitScale || hasCenteredBoard.current) {
      return
    }

    hasCenteredBoard.current = true
    window.requestAnimationFrame(() => {
      const boardHeader = board.querySelector('.meeting-title')
      const headerHeight = boardHeader?.offsetHeight ?? 64
      const visibleCenterY = headerHeight + (board.clientHeight - headerHeight) / 2

      board.scrollLeft = Math.max(
        0,
        (BOARD_CONTENT_BOUNDS.left + BOARD_CONTENT_BOUNDS.width / 2) * renderedZoom - board.clientWidth / 2,
      )
      board.scrollTop = Math.max(
        0,
        (BOARD_CONTENT_BOUNDS.top + BOARD_CONTENT_BOUNDS.height / 2) * renderedZoom - visibleCenterY,
      )
    })
  }, [fitScale, renderedZoom])

  return (
    <div className="flowchart-page">
      <aside className="flow-rail" aria-label="주요 메뉴">
        <a className="rail-link" href="/" aria-label="홈">
          <img src={icons.figmaGlobalHome} alt="" />
        </a>
        <a className="rail-link active" href="/flowchart" aria-label="회의">
          <img src={icons.figmaGlobalMeeting} alt="" />
        </a>
        <button className="rail-link" type="button" aria-label="채팅">
          <img src={icons.figmaGlobalChat} alt="" />
        </button>
        <span className="rail-user" />
      </aside>

      <aside className="flow-sidebar" aria-label="회의 탐색">
        <header className="team-header">
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

        <section className="sidebar-section categories" aria-labelledby="category-title">
          <h2 id="category-title">카테고리</h2>
          <a className="category-link selected" href="/flowchart">
            <img src={icons.figmaCategoryMeeting} alt="" />
            회의
          </a>
          <a className="category-link" href="/flowchart">
            <img src={icons.database} alt="" />
            작업
          </a>
        </section>

        <section className="sidebar-section index-section" aria-labelledby="index-title">
          <h2 id="index-title">인덱스</h2>
          <nav className="index-list">
            {indexes.map((item) => (
              <a href="/flowchart" key={item}>
                {item}
              </a>
            ))}
          </nav>
        </section>

        <section className="sidebar-section filter-section" aria-labelledby="filter-title">
          <h2 id="filter-title">필터링</h2>
          <label className="filter-toggle">
            <span>시간순</span>
            <input type="checkbox" />
          </label>

          <button className="filter-heading" type="button">
            참여자
            <img src={icons.expandDown} alt="" />
          </button>
          {participants.map((participant) => (
            <label className="check-row" key={participant.name}>
              <span>{participant.name}</span>
              <input type="checkbox" defaultChecked={participant.checked} />
              <img className="checked-icon" src={icons.checked} alt="" />
            </label>
          ))}

          <button className="filter-heading content-heading" type="button">
            내용
            <img src={icons.expandDown} alt="" />
          </button>
          {contentFilters.map((filter) => (
            <label className="check-row content-row" key={filter.name}>
              <span>
                <BadgeIcon tone={filter.tone} />
                {filter.name}
              </span>
              <input type="checkbox" defaultChecked={filter.checked} />
              <img className="checked-icon" src={icons.checked} alt="" />
            </label>
          ))}
        </section>
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
            <button
              type="button"
              aria-label="회의 선택"
              aria-expanded={isMeetingMenuOpen}
              onClick={() => setIsMeetingMenuOpen((isOpen) => !isOpen)}
            >
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
                <path d="M208 146 H568" />
                <path d="M692 146 V354 H598" />
                <path d="M238 576 V632" />
                <path d="M598 465 H640 V632" />
              </svg>

              <ProfileNode className="top-left" image="/flowchart/profile-2.jpeg" name="유수인" />
              <ProfileNode className="top-right" image="/flowchart/profile-3.jpeg" name="서재민" />
              <ProfileNode className="bottom-right" image="/flowchart/profile-1.jpeg" name="강다은" />

              <MetricGroup className="top-flow" items={boardMetrics.top} />
              <MetricGroup className="left-flow" items={boardMetrics.left} />
              <MetricGroup className="right-flow" items={boardMetrics.right} />

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

          {zoom > MIN_ZOOM ? (
            <div className="zoom-controls" aria-label="플로우 확대 축소">
              <button type="button" aria-label="축소" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>
                -
              </button>
              <output aria-live="polite">{zoomPercent}%</output>
              <button type="button" aria-label="확대" onClick={zoomIn} disabled={zoom >= MAX_ZOOM}>
                +
              </button>
            </div>
          ) : null}
        </section>

        <aside className="briefing-panel" aria-label="Zero 브리핑">
          <header className="briefing-header">
            <h2>Zero 브리핑</h2>
            <label className="brief-search">
              <img src={icons.search} alt="" />
              <input type="search" aria-label="브리핑 검색" />
            </label>
          </header>

          <section className="brief-section overview">
            <h3>회의 한눈에 보기</h3>
            <p>
              이번 회의에서는 백엔드 개발 진행 상황과 프론트엔드/디자인 싱크를 중심으로 논의했어요.
              API 연동 일정이 변경되었으며, 디자인 최종안은 다음 회의 전까지 확정하기로 했어요.
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
