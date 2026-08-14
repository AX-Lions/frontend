import { useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 1
const MAX_ZOOM = 1.2
const ZOOM_STEP = 0.1
const BOARD_VIEW_PADDING_X = 48
const BOARD_VIEW_PADDING_Y = 40

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
}

export function useFlowchartBoard(contentBounds) {
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
