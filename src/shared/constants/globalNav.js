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
    /*
      말풍선에는 `회의` 가 아니라 `회의 플로우보드` 라고 적는다.

      진행 중인 회의가 있으면 이 자리가 **마이크 아이콘**으로 바뀌는데, 둘 다
      `회의` 라고만 뜨면 마이크(지금 하는 회의에 들어가기)와 이 아이콘(지난
      회의의 흐름 판 보기)이 같은 곳으로 가는 것처럼 읽힌다. 가는 곳이 다르니
      이름도 달라야 한다.

      `label` 은 그대로 둔다 — 팀장에게는 이 아이콘이 판으로 가지 않고 `회의
      시작 · 일정` 메뉴를 여는 자리라, 거기서는 `회의` 가 맞다.
    */
    tip: '회의 플로우보드',
    icon: '/icons/Book_check.svg',
  },
  {
    id: 'inbox',
    href: '/inbox',
    label: '요청함',
    icon: '/icons/InboxIcon.svg',
  },
]
