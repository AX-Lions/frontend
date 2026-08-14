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
  refresh: '/icons/Refresh.svg',
  search: '/icons/Search.svg',
  unchecked: '/icons/unchecked.svg',
}

export const toneIcons = {
  opinion: '/flowchart/icons/opinion.svg',
  request: '/flowchart/icons/request.svg',
  change: '/flowchart/icons/change.svg',
  schedule: '/flowchart/icons/schedule.svg',
  decision: '/flowchart/icons/decision.svg',
}

export const toneLabels = {
  opinion: '의견',
  request: '요청사항',
  change: '변동사항',
  schedule: '일정',
  decision: '결정',
}

export const participants = [
  { name: '유수인', checked: true },
  { name: '서재민', checked: true },
  { name: '강다은', checked: true },
  { name: '임수연의 Bordo', checked: true },
  { name: '최비성', checked: false },
  { name: '임수연', checked: false },
]

export const contentFilters = [
  { name: '의견', tone: 'opinion', checked: true },
  { name: '요청사항', tone: 'request', checked: true },
  { name: '변동사항', tone: 'change', checked: true },
  { name: '일정', tone: 'schedule', checked: true },
  { name: '결론', tone: 'decision', checked: false },
]

export const indexes = [
  '진행 상황 공유',
  '백엔드 개발 논의',
  '프론트엔드/디자인 싱크 맞추기',
  '기획안 작성 방향 논의',
  '작업 마감 기한 논의',
]

export const summaryColumns = [
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

export const boardMetrics = {
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

export const briefTags = [
  { label: '중요', count: 3 },
  { label: '결정', count: 3 },
  { label: '요청사항', count: 2 },
  { label: '수정사항', count: 4 },
]

export const checkItems = [
  {
    title: '백엔드 개발 일정 변경',
    body: 'API 연동 완료일이 8/16 -> 8/19로 변경됐어요.',
  },
  {
    title: '디자인 수정 요청',
    body: '임수연님이 회의 화면의 우측 패널 너비 조정을 요청했어요.',
  },
]

export const requestItems = [
  {
    title: '8/15까지 회의 화면 디자인 수정',
    body: '서재민님이 요청했어요.',
  },
  {
    title: '수정된 화면 개발팀에 공유',
    body: '다음 회의 전까지 확인이 필요해요.',
  },
]

export const replyItems = [
  {
    id: 'design-deadline',
    question: '디자인 최종안은 언제까지 전달 가능할까요?',
    meta: '임수연 · 14:32',
  },
  {
    id: 'api-scope',
    question: 'API 수정사항도 이번 스프린트에 포함일까요?',
    meta: '최비성 · 14:32',
  },
]

export const BOARD_CONTENT_BOUNDS = {
  left: 28,
  top: 86,
  width: 720,
  height: 714,
}
