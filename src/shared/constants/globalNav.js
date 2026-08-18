/**
 * 앱을 통틀어 같은 화면 목록.
 *
 * 전역 레일(`GlobalSidebar`)과 홈 사이드바의 아이콘 줄(`Sidebar`)이 같은
 * 목록을 각자의 모양으로 그린다 — 화면 종류가 하나뿐이니 정의도 하나여야
 * 어느 쪽에 새 화면을 추가했는데 다른 쪽엔 안 넣는 실수가 안 생긴다.
 */
/*
  순서는 시안(`666:5059`)의 `상단좌측아이콘` 을 그대로 따른다 — 홈 · 채팅 ·
  회의 · 요청함. 회의보다 채팅이 앞이다.
*/
export const globalNavItems = [
  {
    id: 'home',
    href: '/',
    label: '홈',
    icon: '/icons/HomeIcon.svg',
  },
  {
    id: 'chat',
    href: '/chat',
    label: '채팅',
    icon: '/icons/Chat.svg',
  },
  {
    id: 'meeting',
    href: '/flow-board',
    label: '회의',
    // `회의아이콘` 컴포넌트(`666:4885`)는 기본 상태부터 마이크다 —
    // `Book_check.svg` 는 플로우 사이드바의 `회의` 카테고리 필터 아이콘과
    // 헷갈려 잘못 골랐던 것이다.
    icon: '/icons/Microphone.svg',
  },
  {
    id: 'inbox',
    href: '/inbox',
    label: '요청함',
    icon: '/icons/InboxIcon.svg',
  },
]
