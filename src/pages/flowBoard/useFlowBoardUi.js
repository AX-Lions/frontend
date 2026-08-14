import { useState } from 'react'

export function useFlowBoardUi(initialIndex) {
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false)
  const [isBriefScrolled, setIsBriefScrolled] = useState(false)
  const [isBriefSearchActive, setIsBriefSearchActive] = useState(false)
  const [isBriefChatActive, setIsBriefChatActive] = useState(false)
  const [isSidebarScrolled, setIsSidebarScrolled] = useState(false)
  const [isFlowSidebarCollapsed, setIsFlowSidebarCollapsed] = useState(false)
  const [activeReplyId, setActiveReplyId] = useState(null)
  const [activeBriefTag, setActiveBriefTag] = useState(null)
  const [activeMetricId, setActiveMetricId] = useState(null)
  const [activeCategory, setActiveCategory] = useState('meeting')
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const [activeRail, setActiveRail] = useState('meeting')
  const [collapsedFilters, setCollapsedFilters] = useState({
    participants: false,
    content: false,
  })

  const toggleMetric = (metricId) => {
    setActiveMetricId((currentId) => (currentId === metricId ? null : metricId))
  }

  const toggleReply = (replyId) => {
    setActiveReplyId((currentId) => (currentId === replyId ? null : replyId))
  }

  const clearReply = () => {
    setActiveReplyId(null)
  }

  const toggleBriefTag = (tagLabel) => {
    setActiveBriefTag((currentLabel) => (currentLabel === tagLabel ? null : tagLabel))
  }

  const toggleFilterCollapse = (filterName) => {
    setCollapsedFilters((filters) => ({
      ...filters,
      [filterName]: !filters[filterName],
    }))
  }

  const toggleMeetingMenu = () => {
    setIsMeetingMenuOpen((isOpen) => !isOpen)
  }

  const toggleFlowSidebar = () => {
    setIsFlowSidebarCollapsed((isCollapsed) => !isCollapsed)
  }

  return {
    activeCategory,
    activeBriefTag,
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
  }
}
