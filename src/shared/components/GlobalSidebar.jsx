import { navigate } from '../../app/navigation.js'
import './GlobalSidebar.css'

/**
 * 모든 화면에 있는 좌측 레일.
 *
 * ## 왜 `<a>` 인데 클릭을 가로채나
 *
 * `href` 를 그대로 두면 브라우저가 문서를 다시 받아 온다. 홈 → 채팅 한 번에
 * 번들을 다시 내려받고 토큰 확인부터 다시 하므로, 화면이 흰색으로 한 번
 * 깜빡인다. `navigate()` 로 주소만 바꾸면 `AppRouter` 가 알아서 따라온다.
 *
 * 그렇다고 `<button>` 으로 바꾸지는 않는다. 새 탭으로 열기·주소 복사가
 * 사라지고, 스크린 리더가 링크 목록에서 이 레일을 못 찾는다. 그래서 `href` 는
 * 남기고 **보조 클릭(Ctrl·Cmd·Shift·가운데 버튼)일 때는 가로채지 않는다.**
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

/** 새 탭·새 창으로 여는 클릭인지. 이건 브라우저에게 그대로 넘긴다. */
function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || (event.button !== undefined && event.button !== 0)
}

export function GlobalSidebar({ active = 'home', onNavigate, user }) {
  const go = (event, item) => {
    // 화면이 자기 사정으로 이동을 가로챌 수 있다(채팅 안의 설정 화면처럼
    // 주소가 같은데 패널만 바뀌는 경우). 먼저 물어보고, 그쪽이
    // `preventDefault()` 했으면 여기서는 아무 것도 하지 않는다.
    onNavigate?.(event, item)

    if (event.defaultPrevented || isModifiedClick(event)) {
      return
    }

    event.preventDefault()
    navigate(item.href)
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
            aria-current={active === item.id ? 'page' : undefined}
            title={item.label}
            onClick={(event) => go(event, item)}
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

        `user` 를 받으면 이름을 라벨에 쓴다. 레일에는 아이콘만 보이므로,
        여러 계정을 오가는 사람이 지금 누구인지 확인할 자리가 여기뿐이다.
      */}
      <a
        className={active === 'account' ? 'global-sidebar-user active' : 'global-sidebar-user'}
        href="/account"
        aria-label={user?.name ? `개인 설정 · ${user.name}` : '개인 설정'}
        aria-current={active === 'account' ? 'page' : undefined}
        title={user?.name ? `개인 설정 · ${user.name}` : '개인 설정'}
        onClick={(event) => go(event, { id: 'account', href: '/account', label: '개인 설정' })}
      >
        <img src={user?.avatarUrl || '/figma-icons/global-profile.png'} alt="" />
      </a>
    </aside>
  )
}
