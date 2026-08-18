import { useState } from 'react'

/**
 * 화면에만 사는 상태.
 *
 * 조회 조건(필터 체크·카테고리)은 여기 두지 않는다 — 그쪽은 URL 과 요청에
 * 실려야 해서 페이지가 들고 있다. 여기는 **접힘·스크롤·강조**처럼 서버가 몰라도
 * 되는 것만 담는다.
 *
 * `activeReplyId` 계열을 걷어냈다. 답글 UI 는 화면 어디에도 없는데 상태와
 * 토글 세 개가 남아 있어, 읽는 사람이 "어딘가에 답글 목록이 있나" 를 찾게 했다.
 */
export function useFlowBoardUi() {
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false)
  const [isBriefScrolled, setIsBriefScrolled] = useState(false)
  const [isSidebarScrolled, setIsSidebarScrolled] = useState(false)
  const [isFlowSidebarCollapsed, setIsFlowSidebarCollapsed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(null)
  const [isTimeOrdered, setIsTimeOrdered] = useState(false)
  const [participantKeyword, setParticipantKeyword] = useState('')
  const [collapsedFilters, setCollapsedFilters] = useState({
    participants: false,
    content: false,
  })

  const toggleFilterCollapse = (filterName) => {
    setCollapsedFilters((filters) => ({
      ...filters,
      [filterName]: !filters[filterName],
    }))
  }

  /** 같은 안건을 다시 누르면 강조가 풀린다. 풀 방법이 없으면 전체를 다시 볼 수 없다. */
  const toggleIndex = (item) => {
    setActiveIndex((current) => (current?.id === item.id ? null : item))
  }

  return {
    activeIndex,
    collapsedFilters,
    isFlowSidebarCollapsed,
    isBriefScrolled,
    isMeetingMenuOpen,
    isSidebarScrolled,
    isTimeOrdered,
    participantKeyword,
    setActiveIndex,
    setIsBriefScrolled,
    setIsMeetingMenuOpen,
    setIsSidebarScrolled,
    setParticipantKeyword,
    toggleFilterCollapse,
    toggleFlowSidebar: () => setIsFlowSidebarCollapsed((v) => !v),
    toggleIndex,
    toggleMeetingMenu: () => setIsMeetingMenuOpen((v) => !v),
    toggleTimeOrder: () => setIsTimeOrdered((v) => !v),
  }
}
