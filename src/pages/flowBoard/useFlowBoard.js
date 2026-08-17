import { useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 1
const MAX_ZOOM = 1.2
const ZOOM_STEP = 0.1
const BOARD_VIEW_PADDING_X = 48
const BOARD_VIEW_PADDING_Y = 40

/**
 * 판을 끌면 안 되는 것들.
 *
 * 노드와 뱃지가 여기 없으면 **누르는 순간 드래그가 시작돼 클릭이 안 난다.**
 * 이전 캔버스에서 대리인 프로필을 누르면 판이 따라 움직이던 자리다.
 */
const BOARD_INTERACTIVE = [
  '.zoom-controls',
  '.meeting-title button',
  '.meeting-menu',
  '.summary-board button',
  '.flow-node',
  '.flow-badge-group',
].join(', ')

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
}

export function useFlowBoard(contentBounds) {
  const [zoom, setZoom] = useState(1)
  const [fitScale, setFitScale] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const boardRef = useRef(null)
  const centeredFor = useRef(null)
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
    if (
      event.button !== 0 ||
      event.target.closest(BOARD_INTERACTIVE)
    ) {
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
    const board = boardRef.current

    if (!board) {
      return
    }

    /*
      브라우저 확대 차단을 **보드 안으로 좁힌다.**

      이전에는 `window` 에 걸려 있어서 사이드바·우측 패널 위에서도 ctrl+휠이
      막혔다. 화면 전체가 12px 고정 폰트라 글자를 키워 읽으려던 사람이
      **아무 데서도 확대할 수 없었다.** 판 위에서만 막으면 판은 자체 줌을 쓰고
      나머지는 브라우저 확대가 그대로 산다.

      React 의 `onWheel` 로는 못 막는다. React 는 루트에 passive 리스너로
      위임해 붙여서 `preventDefault()` 가 무시된다.
    */
    const preventBrowserZoom = (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
      }
    }

    board.addEventListener('wheel', preventBrowserZoom, { passive: false })

    return () => {
      board.removeEventListener('wheel', preventBrowserZoom)
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
        (availableWidth - BOARD_VIEW_PADDING_X) / contentBounds.width,
        (availableHeight - BOARD_VIEW_PADDING_Y) / contentBounds.height,
      )

      setFitScale(Number(Math.max(0.1, Math.min(1, nextFitScale)).toFixed(4)))
    }

    updateFitScale()

    const resizeObserver = new ResizeObserver(updateFitScale)
    resizeObserver.observe(board)

    return () => {
      resizeObserver.disconnect()
    }
  }, [contentBounds.height, contentBounds.width])

  useEffect(() => {
    const board = boardRef.current

    /*
      판 크기가 바뀌면 다시 가운데로 보낸다.

      한 번만 가운데를 잡던 코드였다. 무대가 776×931 고정일 때는 맞았지만,
      이제 무대 크기가 **노드 수에 따라 달라진다.** 회의↔작업을 오가거나
      필터로 사람이 줄면 판이 커지거나 작아지는데, 스크롤이 그대로면
      아무것도 없는 여백을 보고 있게 된다.
    */
    const key = `${contentBounds.width}x${contentBounds.height}`

    if (!board || !fitScale || centeredFor.current === key) {
      return
    }

    centeredFor.current = key
    window.requestAnimationFrame(() => {
      const boardHeader = board.querySelector('.meeting-title')
      const headerHeight = boardHeader?.offsetHeight ?? 64
      const visibleCenterY = headerHeight + (board.clientHeight - headerHeight) / 2

      board.scrollLeft = Math.max(
        0,
        (contentBounds.left + contentBounds.width / 2) * renderedZoom - board.clientWidth / 2,
      )
      board.scrollTop = Math.max(
        0,
        (contentBounds.top + contentBounds.height / 2) * renderedZoom - visibleCenterY,
      )
    })
  }, [contentBounds.height, contentBounds.left, contentBounds.top, contentBounds.width, fitScale, renderedZoom])

  return {
    boardRef,
    handleBoardPointerDown,
    handleBoardPointerMove,
    handleBoardWheel,
    isPanning,
    maxZoom: MAX_ZOOM,
    minZoom: MIN_ZOOM,
    renderedZoom,
    stopBoardPan,
    zoom,
    zoomIn,
    zoomOut,
    zoomPercent,
  }
}
