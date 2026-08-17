import { AppLink } from '../../app/AppLink.jsx'
import './GlobalSidebar.css'

/**
 * 모든 화면에 있는 좌측 레일.
 *
 * 링크는 전부 `AppLink` 다 — 문서를 다시 받지 않으면서 새 탭 열기·주소 복사는
 * 그대로 되는 이유는 그쪽에 적어 뒀다.
 *
 * `onNavigate` 를 주면 이동 직전에 불린다. 화면이 자기 사정으로 이동을 막을 수
 * 있다(채팅 안의 설정 화면처럼 주소는 그대로인데 패널만 닫히는 경우).
 * 그쪽에서 `preventDefault()` 하면 주소는 바뀌지 않는다.
 */

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

/*
  프로필은 누르면 켜졌다 꺼지기만 하고 **아무 데도 가지 않았다.** 프로필을
  누른 사람이 기대하는 것은 자기 설정이므로 개인 설정으로 보낸다. 나머지
  항목과 같은 링크라 새 탭으로 열거나 주소를 복사하는 것이 똑같이 동작한다.
*/
const accountItem = { id: 'account', href: '/account', label: '개인 설정' }

export function GlobalSidebar({ active = 'home', onNavigate, user }) {
  const className = (id, base) => (active === id ? `${base} active` : base)
  const current = (id) => (active === id ? 'page' : undefined)

  // 레일에는 아이콘만 보인다. 여러 계정을 오가는 사람이 지금 누구로 로그인해
  // 있는지 확인할 자리가 여기뿐이라, 이름을 받으면 라벨에 함께 적는다.
  const accountLabel = user?.name ? `개인 설정 · ${user.name}` : '개인 설정'

  return (
    <aside className="global-sidebar" aria-label="주요 메뉴">
      <nav className="global-sidebar-nav" aria-label="주요 화면">
        {globalNavItems.map((item) => (
          <AppLink
            className={className(item.id, 'global-sidebar-link')}
            href={item.href}
            key={item.id}
            aria-label={item.label}
            aria-current={current(item.id)}
            title={item.label}
            onClick={(event) => onNavigate?.(event, item)}
          >
            <img src={item.icon} alt="" />
          </AppLink>
        ))}
      </nav>

      <AppLink
        className={className(accountItem.id, 'global-sidebar-user')}
        href={accountItem.href}
        aria-label={accountLabel}
        aria-current={current(accountItem.id)}
        title={accountLabel}
        onClick={(event) => onNavigate?.(event, accountItem)}
      >
        <img src={user?.avatarUrl || '/figma-icons/global-profile.png'} alt="" />
      </AppLink>
    </aside>
  )
}
