import './GlobalSidebar.css'

const globalNavItems = [
  {
    id: 'home',
    href: '/',
    label: '홈',
    icon: '/icons/HomeIcon.svg',
  },
  {
    id: 'meeting',
    href: '/flow-board',
    label: '회의',
    icon: '/icons/Book_check.svg',
  },
  {
    id: 'chat',
    href: '/chat',
    label: '채팅',
    icon: '/icons/Chat.svg',
  },
]

export function GlobalSidebar({ active = 'home', onNavigate }) {
  const handleNavigate = (event, item) => {
    if (!onNavigate) {
      return
    }

    onNavigate(event, item)
  }

  return (
    <aside className="global-sidebar" aria-label="주요 메뉴">
      <nav className="global-sidebar-nav" aria-label="주요 화면">
        {globalNavItems.map((item) => (
          <a
            className={active === item.id ? 'global-sidebar-link active' : 'global-sidebar-link'}
            href={item.href}
            key={item.id}
            aria-label={item.label}
            title={item.label}
            onClick={(event) => handleNavigate(event, item)}
          >
            <img src={item.icon} alt="" />
          </a>
        ))}
      </nav>
      {/*
        누르면 켜졌다 꺼지기만 하고 **아무 데도 가지 않았다.** 프로필을 누른
        사람이 기대하는 것은 자기 설정이므로 개인 설정으로 보낸다.

        `<a>` 로 바꾼다. 나머지 항목과 같은 링크라 새 탭으로 열거나 주소를
        복사하는 것이 똑같이 동작한다.
      */}
      <a
        className={active === 'account' ? 'global-sidebar-user active' : 'global-sidebar-user'}
        href="/account"
        aria-label="개인 설정"
        title="개인 설정"
      >
        <img src="/figma-icons/global-profile.png" alt="" />
      </a>
    </aside>
  )
}
