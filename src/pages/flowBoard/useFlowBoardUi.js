import { useState } from 'react'

/**
 * 화면에만 사는 상태.
 *
 * 조회 조건(카테고리)은 여기 두지 않는다 — 그쪽은 URL 과 요청에 실려야 해서
 * 페이지가 들고 있다. 여기는 **접힘·스크롤·강조**처럼 서버가 몰라도 되는 것만
 * 담는다.
 *
 * ## 필터 상태가 반만 남았다
 *
 * 좌측 `필터링` 중 **참여자 체크와 `시간순` 체크박스는 없어졌고, 아이콘이 붙은
 * `내용` 종류 필터는 남았다.** 종류는 판을 읽는 방식 자체를 바꾸지만(요청사항만
 * 보기), 참여자는 시간순 인덱스를 훑으면 자연히 드러나서 겹치는 물음이었다.
 *
 * `시간순` 체크박스가 사라진 것은 시간 순서가 이 화면의 기본 전제가 됐기
 * 때문이다. 선의 진하기(`opacity`)는 이제 늘 걸린다(`FlowCanvas`).
 */
export function useFlowBoardUi() {
  const [isMeetingMenuOpen, setIsMeetingMenuOpen] = useState(false)
  const [isBriefScrolled, setIsBriefScrolled] = useState(false)
  const [isSidebarScrolled, setIsSidebarScrolled] = useState(false)
  const [isFlowSidebarCollapsed, setIsFlowSidebarCollapsed] = useState(false)

  /*
    두 목록의 접힘.

    시간순 인덱스는 회의가 길면 스무 줄이 넘어가 그 아래 `내용` 필터가 스크롤
    바깥으로 밀린다. 접을 수 없으면 필터를 한 번 만지려고 매번 목록 끝까지
    내려가야 한다. 반대로 필터를 접으면 인덱스가 한 화면에 더 들어온다.

    처음은 둘 다 펼침이다. 접어 둔 채로 시작하면 **거기 무엇이 있는지 모르는
    사람에게는 없는 기능**이 된다.
  */
  const [isTimelineCollapsed, setIsTimelineCollapsed] = useState(false)
  const [isContentCollapsed, setIsContentCollapsed] = useState(false)

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
    isContentCollapsed,
    isFlowSidebarCollapsed,
    isBriefScrolled,
    isMeetingMenuOpen,
    isSidebarScrolled,
    isTimelineCollapsed,
    setActiveTimelineItem,
    setIsBriefScrolled,
    setIsMeetingMenuOpen,
    setIsSidebarScrolled,
    toggleContentCollapse: () => setIsContentCollapsed((v) => !v),
    toggleFlowSidebar: () => setIsFlowSidebarCollapsed((v) => !v),
    toggleMeetingMenu: () => setIsMeetingMenuOpen((v) => !v),
    toggleTimelineCollapse: () => setIsTimelineCollapsed((v) => !v),
    toggleTimelineItem,
  }
}
