import { AppLink } from '../../app/AppLink.jsx'
import { globalNavItems } from '../constants/globalNav.js'
import { useChatBadge } from '../hooks/useChatBadge.js'
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
 *
 * ## 요청함 · 검색은 여기 없다
 *
 * `globalNavItems` 전체가 아니라 `요청함` 을 뺀 목록만 그린다 — 이 레일에서는
 * 빼 달라는 요청이었다. 요청함은 지금 홈의 아이콘 줄(`Sidebar`)에만 남는다.
 * 검색 아이콘도 같은 이유로 뺐다.
 *
 * ## 순서·아이콘이 홈과 다르다
 *
 * `globalNavItems` 의 순서(홈·채팅·회의·요청함)는 홈 아이콘 줄(시안
 * `666:5059`)을 따른 것이다. 이 레일은 시안이 따로 있고(`576:4858` —
 * `채팅` 이 맨 아래) 회의 아이콘 그림도 다르다 — 홈 쪽은 책, 이 레일은
 * 클립보드다(`576:4400`). `globalNavItems` 를 고치면 홈까지 같이 바뀌므로
 * 여기서만 순서를 다시 짜고 아이콘을 덮어쓴다.
 *
 * ## 이 자리는 마이크로 안 바뀐다
 *
 * 전에는 진행 중인 회의가 있으면 `회의` 자리가 마이크(`LiveMeetingIcon`)로
 * 바뀌었다. 이 레일은 **어디서든 화면을 옮겨 다니는 자리**라 회의 판으로
 * 가는 길이 잠깐씩 사라지면 안 된다는 판단으로, 여기서는 뺐다 — 클립보드
 * 아이콘이 항상 있는다. 마이크는 이제 홈 아이콘 줄(`Sidebar.jsx`)에만
 * 있고, 그쪽은 그 자리가 원래도 `/flow-board` 로 가는 길이 아니었다.
 *
 * ## 홈에는 이 레일이 없다
 *
 * 홈 화면(시안 `666:5059`)은 로고 밑에 아이콘 줄을 붙여 넣은 모양이라, 별도
 * 세로 레일과 나란히 두면 로고와 아이콘이 다른 칸에 떨어져 보인다. 그래서
 * 홈은 `Sidebar` 가 가로 줄을 직접 그리고, 이 레일은 쓰지 않는다. 나머지
 * 화면(채팅·회의·개인 설정·대리 참석 준비)은 지금처럼 이 레일 하나로 다닌다.
 */

const RAIL_ORDER = ['home', 'meeting', 'chat']
const railNavItems = RAIL_ORDER
  .map((id) => globalNavItems.find((item) => item.id === id))
  .filter(Boolean)

/** 이 레일에서만 다른 그림을 쓰는 아이콘(시안 `576:4858`). */
const RAIL_ICON_OVERRIDE = {
  meeting: '/icons/GlobalMeetingIcon.svg',
}

/*
  프로필은 누르면 켜졌다 꺼지기만 하고 **아무 데도 가지 않았다.** 프로필을
  누른 사람이 기대하는 것은 자기 설정이므로 개인 설정으로 보낸다. 나머지
  항목과 같은 링크라 새 탭으로 열거나 주소를 복사하는 것이 똑같이 동작한다.
*/
const accountItem = { id: 'account', href: '/account', label: '개인 설정' }

export function GlobalSidebar({ active = 'home', collapsed = false, onNavigate, user }) {
  const className = (id, base) => (active === id ? `${base} active` : base)
  const current = (id) => (active === id ? 'page' : undefined)

  const chatBadge = useChatBadge()

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
        {railNavItems.map((item) => (
          <AppLink
            className={className(item.id, 'global-sidebar-link')}
            href={item.href}
            key={item.id}
            aria-label={item.tip ?? item.label}
            aria-current={current(item.id)}
            data-tip={item.tip ?? item.label}
            onClick={(event) => onNavigate?.(event, item)}
          >
            <img src={RAIL_ICON_OVERRIDE[item.id] ?? item.icon} alt="" />
            {item.id === 'chat' && chatBadge > 0 ? (
              <span className="global-sidebar-badge">{chatBadge > 99 ? '99+' : chatBadge}</span>
            ) : null}
          </AppLink>
        ))}
      </nav>

      <AppLink
        className={className(accountItem.id, 'global-sidebar-user')}
        href={accountItem.href}
        aria-label={accountLabel}
        aria-current={current(accountItem.id)}
        data-tip={accountLabel}
        onClick={(event) => onNavigate?.(event, accountItem)}
      >
        {/*
          홈 사이드바(`Sidebar.jsx`)의 하단 프로필과 **같은 자리를 같은 규칙으로
          그린다.** 예전에는 여기만 고정 이미지(`/figma-icons/global-profile.png`)로
          때웠는데, 그 파일 자체가 거의 흰 원이라 아바타가 없는 계정은 텅 빈
          동그라미로 보였다 — 홈 쪽은 이름 첫 글자를 넣어 누구인지 알 수 있는데
          레일만 다른 사람처럼 보였다.
        */}
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" />
        ) : (
          <span className="profile-avatar" aria-hidden="true">
            {user?.name ? user.name.trim().charAt(0) : ''}
          </span>
        )}
      </AppLink>
    </aside>
  )
}
