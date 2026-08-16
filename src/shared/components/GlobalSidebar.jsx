import { useState } from 'react'

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
  const [isProfileSelected, setIsProfileSelected] = useState(false)

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
      <button
        className={isProfileSelected ? 'global-sidebar-user active' : 'global-sidebar-user'}
        type="button"
        aria-label="프로필"
        aria-pressed={isProfileSelected}
        title="프로필"
        onClick={() => setIsProfileSelected((selected) => !selected)}
      >
        <img src="/figma-icons/global-profile.png" alt="" />
      </button>
    </aside>
  )
}
