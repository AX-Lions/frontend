import { useState } from 'react'

/**
 * 화면에만 사는 상태.
 *
 * 조회 조건(카테고리)은 여기 두지 않는다 — 그쪽은 URL 과 요청에 실려야 해서
 * 페이지가 들고 있다. 여기는 **접힘·스크롤·강조**처럼 서버가 몰라도 되는 것만
 * 담는다.
 *
 * ## 필터 상태가 통째로 빠졌다
 *
 * 좌측 `필터링`(시간순 체크 · 참여자 체크 · 내용 종류 체크 · 접힘)이 화면에서
 * 없어지고 그 자리를 `시간순 인덱스` 가 대신한다. 켤 곳이 없어진 상태를 남겨
 * 두면 다음 사람이 **어딘가에 필터 UI 가 있는 줄 알고 찾게 된다** — 예전에
 * `activeReplyId` 계열을 걷어낸 것과 같은 이유다.
 *
 * `시간순` 체크박스도 같이 사라졌다. 시간 순서가 이 화면의 기본 전제가 됐으므로
 * 선의 진하기(`opacity`)는 이제 늘 걸린다(`FlowCanvas`).
 */
export function useFlowBoardUi() {
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false)
  const [isBriefScrolled, setIsBriefScrolled] = useState(false)
  const [isSidebarScrolled, setIsSidebarScrolled] = useState(false)
  const [isFlowSidebarCollapsed, setIsFlowSidebarCollapsed] = useState(false)

  /**
   * 좌측 `시간순 인덱스` 에서 고른 줄. 전달 내용 한 건이다.
   *
   * 예전에는 안건(`activeIndex`)이었다. 안건은 여러 화살표를 한꺼번에 가리켜서
   * **판이 뭉텅이로 켜졌다 꺼졌다** 했고, 정작 "몇 번째에 무슨 말이 오갔나" 는
   * 어디에도 없었다. 이제 한 줄이 엣지 하나를 가리킨다.
   */
  const [activeTimelineItem, setActiveTimelineItem] = useState(null)

  /** 같은 줄을 다시 누르면 강조가 풀린다. 풀 방법이 없으면 전체를 다시 볼 수 없다. */
  const toggleTimelineItem = (item) => {
    setActiveTimelineItem((current) => (current?.edge_id === item.edge_id ? null : item))
  }

  return {
    activeTimelineItem,
    isFlowSidebarCollapsed,
    isBriefScrolled,
    isMeetingMenuOpen,
    isSidebarScrolled,
    setActiveTimelineItem,
    setIsBriefScrolled,
    setIsMeetingMenuOpen,
    setIsSidebarScrolled,
    toggleFlowSidebar: () => setIsFlowSidebarCollapsed((v) => !v),
    toggleMeetingMenu: () => setIsMeetingMenuOpen((v) => !v),
    toggleTimelineItem,
  }
}
