import { AppLink } from '../../app/AppLink.jsx'
import { api } from '../../lib/api.js'
import { useResource } from '../../lib/useResource.js'
import './GlobalSidebar.css'

/**
 * 모든 화면에 있는 좌측 레일.
 *
 * 링크는 전부 `AppLink` 다 — 문서를 다시 받지 않으면서 새 탭 열기·주소 복사는
 * 그대로 되는 이유는 그쪽에 적어 뒀다.
 *
 * `collapsed` 를 주면 폭 0 으로 접힌다. 옆에 붙는 화면 사이드바(홈의 프로젝트
 * 목록, 플로우의 회의 탐색)가 접힐 때 레일만 남아 있으면 **접었는데 왼쪽이
 * 그대로 두 칸인 것처럼** 보인다. 그래서 같이 접는다 — 다시 펴는 버튼은 접힌
 * 사이드바 쪽에 떠 있으므로 레일이 사라져도 돌아올 길은 남는다.
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
  {
    id: 'inbox',
    href: '/inbox',
    label: '요청함',
    icon: '/icons/InboxIcon.svg',
  },
]

/*
  프로필은 누르면 켜졌다 꺼지기만 하고 **아무 데도 가지 않았다.** 프로필을
  누른 사람이 기대하는 것은 자기 설정이므로 개인 설정으로 보낸다. 나머지
  항목과 같은 링크라 새 탭으로 열거나 주소를 복사하는 것이 똑같이 동작한다.
*/
const accountItem = { id: 'account', href: '/account', label: '개인 설정' }

/** 요청함 카드 전부의 `답변·확인·승인 필요` 를 더한다. 뱃지는 "몇 개나 남았나" 하나다. */
function pendingTotal(inbox) {
  return (inbox?.groups ?? []).reduce((sum, group) => (
    sum + group.items.reduce((s, item) => (
      s + item.needs_answer + item.needs_confirm + item.needs_approval
    ), 0)
  ), 0)
}

export function GlobalSidebar({ active = 'home', collapsed = false, onNavigate, user }) {
  const className = (id, base) => (active === id ? `${base} active` : base)
  const current = (id) => (active === id ? 'page' : undefined)

  /*
    요청함 뱃지.

    `InboxPage` 와 같은 `cacheKey`(`inbox`) 를 쓴다 — 레일은 모든 화면에 떠
    있으므로 화면마다 따로 부르면 페이지를 옮길 때마다 `/me/inbox` 가 다시
    나간다. 같은 키를 쓰면 `useResource` 가 나눠 쓰거나 캐시를 먼저 보여준다.

    오류는 그냥 둔다. 아직 실서버에 없는 주소라 실서버 모드에서는 항상
    실패하는데, 뱃지 하나 때문에 레일에 오류를 띄우면 정작 화면 이동이
    막힌 것처럼 보인다 — 뱃지가 없는 것으로 조용히 넘어간다.
  */
  const { data: inbox } = useResource(
    (signal) => api.get('/me/inbox', undefined, { signal }), [], { cacheKey: 'inbox' })
  const inboxBadge = pendingTotal(inbox)

  // 레일에는 아이콘만 보인다. 여러 계정을 오가는 사람이 지금 누구로 로그인해
  // 있는지 확인할 자리가 여기뿐이라, 이름을 받으면 라벨에 함께 적는다.
  const accountLabel = user?.name ? `개인 설정 · ${user.name}` : '개인 설정'

  return (
    <aside
      className={collapsed ? 'global-sidebar is-collapsed' : 'global-sidebar'}
      aria-label="주요 메뉴"
      inert={collapsed}
    >
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
            {item.id === 'inbox' && inboxBadge > 0 ? (
              <span className="global-sidebar-badge">{inboxBadge > 99 ? '99+' : inboxBadge}</span>
            ) : null}
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
