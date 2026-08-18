/**
 * 화면이 쓰는 상수.
 *
 * 파일 이름이 `api` 지만 호출은 하나도 없다 — 실제 호출은 `flowBoard.data.js`
 * 에 있다. 이름을 못 바꾸는 것은 다른 트랙이 같은 저장소를 고치는 중이라
 * 파일 이동이 통합 때 충돌을 만들기 때문이다. 대신 **목 데이터는 전부
 * 걷어냈다.** 이 파일에 남은 것은 아이콘 경로와 한국어 라벨뿐이다.
 */

export const icons = {
  add: '/icons/AddIcon.svg',
  bookCheck: '/icons/Book_check.svg',
  chat: '/icons/Chat.svg',
  checked: '/icons/checked.svg',
  database: '/icons/Database.svg',
  expandDown: '/icons/ExpandDown.svg',
  expandLeftDouble: '/icons/Expand_left_double.svg',
  expandRight: '/icons/Expandright.svg',
  home: '/icons/HomeIcon.svg',
  search: '/icons/Search.svg',
  teamSwitch: '/icons/TeamSwitch.svg',
  unchecked: '/icons/unchecked.svg',
}

/**
 * 회의 모드 6종의 아이콘. 디자이너가 준 파일을 그대로 쓴다.
 *
 * 작업 모드 5종은 여기 없다. `public/figma-icons/category-1..5.svg` 는 이름만
 * 그럴듯하고 실제로는 데이터베이스 아이콘을 쪼갠 조각(원기둥 윗면·아랫면,
 * 체크 표시)이라 **다섯이 서로 구별되지 않는다.** 대신 `FlowMetricBadge` 가
 * 인라인 SVG 로 그린다.
 */
export const toneIcons = {
  opinion: '/flowchart/icons/opinion.svg',
  request: '/flowchart/icons/request.svg',
  change: '/flowchart/icons/change.svg',
  schedule: '/flowchart/icons/schedule.svg',
  conclusion: '/flowchart/icons/decision.svg',
  etc: '/flowchart/icons/decision.svg',
}

/**
 * `content_type` 코드의 한국어 이름.
 *
 * 화살표 뱃지와 브리핑 칩은 서버가 `label` 을 실어 주므로 그것을 쓴다. 이
 * 표가 필요한 곳은 **`filter_options.content_types` 뿐**이다 — 그쪽은 코드
 * 문자열 배열이라 라벨이 없다.
 */
export const toneLabels = {
  opinion: '의견',
  request: '요청사항',
  change: '변동사항',
  schedule: '일정',
  conclusion: '결론',
  etc: '기타',
  work: '작업',
  revision: '수정',
  feedback: '피드백',
  share: '공유',
  aiLookup: 'AI 조회',
}
