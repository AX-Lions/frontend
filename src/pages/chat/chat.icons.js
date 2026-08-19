/**
 * 채팅 화면이 쓰는 아이콘 경로.
 *
 * `public/` 아래 정적 파일이라 번들러를 타지 않는다. 화면 여러 곳이 같은 아이콘을
 * 쓰는데 경로를 각자 적으면, 디자이너가 파일 이름을 바꿨을 때 고칠 자리가 흩어진다.
 *
 * 예전 이름은 `chat.mock.js` 였고 목 대화·목 팀 목록이 함께 들어 있었다.
 * 실데이터를 붙인 뒤로는 아무도 안 읽는데 파일 이름이 `mock` 이라, 남은 것도
 * 가짜라고 오해하기 쉬웠다. 상수만 남기고 이름을 뜻에 맞춘다.
 */
export const icons = {
  add: '/chat-icons/add-round.svg',
  addSmall: '/chat-icons/add-round-small.svg',
  ai: '/chat-icons/ai-frame.svg',
  aiIcon: '/chat-icons/ai-icon.svg',
  check: '/icons/checked.svg',
  expandDown: '/icons/ExpandDown.svg',
  expandLeft: '/chat-icons/expand-left.svg',
  expandRight: '/icons/Expandright.svg',
  exitFullscreen: '/chat-icons/exit-full-screen-corner.svg',
  filter: '/chat-icons/filter-alt.svg',
  fullscreen: '/chat-icons/full-screen-corner.svg',
  menu: '/chat-icons/menu.svg',
  profile: '/chat-icons/profile.svg',
  refresh: '/icons/Refresh.svg',
  request: '/chat-icons/request.svg',
  requestSmall: '/chat-icons/request-small.svg',
  search: '/chat-icons/search.svg',
  send: '/chat-icons/send-hor.svg',
  setting: '/chat-icons/setting-line.svg',
}
