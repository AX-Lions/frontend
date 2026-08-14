import { useState } from 'react'

export function useFlowchartUi(initialIndex) {
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false)
  const [isBriefScrolled, setIsBriefScrolled] = useState(false)
  const [isSidebarScrolled, setIsSidebarScrolled] = useState(false)
  const [activeReplyId, setActiveReplyId] = useState(null)
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

  const toggleFilterCollapse = (filterName) => {
    setCollapsedFilters((filters) => ({
      ...filters,
      [filterName]: !filters[filterName],
    }))
  }

  const toggleMeetingMenu = () => {
    setIsMeetingMenuOpen((isOpen) => !isOpen)
  }

  return {
    activeCategory,
    activeIndex,
    activeMetricId,
    activeRail,
    activeReplyId,
    collapsedFilters,
    isBriefScrolled,
    isMeetingMenuOpen,
    isSidebarScrolled,
    setActiveCategory,
    setActiveIndex,
    setActiveRail,
    setIsBriefScrolled,
    setIsSidebarScrolled,
    toggleFilterCollapse,
    toggleMeetingMenu,
    toggleMetric,
    toggleReply,
  }
}
