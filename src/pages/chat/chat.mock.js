export const icons = {
  add: '/chat-icons/add-round.svg',
  addSmall: '/chat-icons/add-round-small.svg',
  ai: '/chat-icons/ai-frame.svg',
  aiIcon: '/chat-icons/ai-icon.svg',
  bookCheck: '/icons/Book_check.svg',
  chat: '/icons/Chat.svg',
  expandDown: '/icons/ExpandDown.svg',
  expandLeft: '/chat-icons/expand-left.svg',
  expandRight: '/icons/Expandright.svg',
  filter: '/chat-icons/filter-alt.svg',
  fullscreen: '/chat-icons/full-screen-corner.svg',
  home: '/icons/HomeIcon.svg',
  menu: '/chat-icons/menu.svg',
  profile: '/chat-icons/profile.svg',
  request: '/chat-icons/request.svg',
  requestSmall: '/chat-icons/request-small.svg',
  search: '/chat-icons/search.svg',
  send: '/chat-icons/send-hor.svg',
  setting: '/chat-icons/setting-line.svg',
}

export const primaryChat = {
  id: 'my-bordo',
  title: '나의 Bordo',
  message: '요청하신 8/13 회의 내용은 다음과 같습니다.',
  time: '오후 8:31',
}

export const importantChats = [
  {
    id: 'jaemin-important',
    name: '서재민',
    context: 'AX Lions - 멋사 중앙해커톤',
    message: '내용',
    time: '오후 8:31',
    unread: 2,
    avatar: '/flowchart/profile-2.jpeg',
  },
]

export const projectChats = [
  {
    id: 'bordo',
    name: '임수연의 Bordo',
    message: '해당 부분은 작업 가능합니다.',
    time: '오후 8:31',
    unread: 2,
    active: true,
    bordo: true,
  },
  {
    id: 'all',
    name: '멋사 중앙해커톤 모두',
    message: '임수연: 플로우 화면 디자인은 8/14까지 완료...',
    time: '오후 8:31',
    unread: 2,
    stacked: true,
  },
  {
    id: 'jaemin',
    name: '서재민',
    message: 'API 변경된 부분 최대한 빨리 부탁드립니다.',
    time: '오후 8:31',
    unread: 2,
    avatar: '/flowchart/profile-2.jpeg',
    marked: true,
  },
  {
    id: 'biseong',
    name: '최비성',
    message: 'DB 구축 완료되었으니 연동 부탁드립니다.',
    time: '오후 8:31',
    avatar: '/flowchart/profile-1.jpeg',
    mutedRequest: true,
  },
  {
    id: 'daeun',
    name: '강다은',
    message: 'Github 확인 부탁드립니다.',
    time: '오후 8:31',
    avatar: '/flowchart/profile-3.jpeg',
    mutedRequest: true,
  },
]

export const teamRows = [
  { id: 'academic', name: '연합학술제 6조' },
  { id: 'line4', name: '4호선톤 불4조', marked: true },
  { id: 'amore', name: '아모레 공모전 1팀', marked: true },
  { id: 'capstone', name: '캡스톤 디자인 2조', marked: true },
]

export const messages = [
  { id: 1, type: 'bot', author: '임수연의 Bordo', time: '오전 11:23' },
  { id: 2, type: 'me', text: 'AI 대리인한테 보낼 때 말풍선 색깔', time: '오전 11:23' },
  { id: 3, type: 'bot', author: '임수연의 Bordo', time: '오전 11:23' },
  { id: 4, type: 'me', text: 'AI 대리인한테 보낼 때 말풍선 색깔', time: '오전 11:23' },
  { id: 'date', type: 'date', label: '2026년 8월 14일 금요일' },
  { id: 5, type: 'bot', author: '임수연의 Bordo', time: '오전 11:23' },
  { id: 6, type: 'me', text: 'AI 대리인한테 보낼 때 말풍선 색깔', time: '오전 11:23' },
  {
    id: 7,
    type: 'me',
    text: 'AI 대리인한테 보낼 때 말풍선 색깔',
    time: '오전 11:26',
    large: true,
  },
]
