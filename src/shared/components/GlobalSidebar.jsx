import { useEffect, useRef, useState } from 'react'

import { AppLink } from '../../app/AppLink.jsx'
import { globalNavItems } from '../constants/globalNav.js'
import { useInboxBadge } from '../hooks/useInboxBadge.js'
import { useLiveMeeting } from '../hooks/useLiveMeeting.js'
import { LiveMeetingPrompt } from './LiveMeetingPrompt.jsx'
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
 * ## 홈에는 이 레일이 없다
 *
 * 홈 화면(시안 `666:5059`)은 로고 밑에 이 아이콘 줄을 붙여 넣은 모양이라,
 * 별도 세로 레일과 나란히 두면 로고와 아이콘이 다른 칸에 떨어져 보인다.
 * 그래서 홈은 `Sidebar` 안에 같은 훅(`useInboxBadge` · `useLiveMeeting`)으로
 * 만든 가로 줄을 직접 그리고, 이 레일은 쓰지 않는다. 나머지 화면(채팅·회의·
 * 요청함·개인 설정·대리 참석 준비)은 지금처럼 이 레일 하나로 다닌다.
 */

/*
  프로필은 누르면 켜졌다 꺼지기만 하고 **아무 데도 가지 않았다.** 프로필을
  누른 사람이 기대하는 것은 자기 설정이므로 개인 설정으로 보낸다. 나머지
  항목과 같은 링크라 새 탭으로 열거나 주소를 복사하는 것이 똑같이 동작한다.
*/
const accountItem = { id: 'account', href: '/account', label: '개인 설정' }

export function GlobalSidebar({ active = 'home', collapsed = false, onNavigate, user }) {
  const className = (id, base) => (active === id ? `${base} active` : base)
  const current = (id) => (active === id ? 'page' : undefined)

  const inboxBadge = useInboxBadge()
  const {
    liveMeeting, promptOpen, secondsLeft, responding,
    openPrompt, respondDecline, respondJoin,
  } = useLiveMeeting()

  /*
    검색 아이콘(시안 `576:4796`).

    누르면 옆으로 검색창이 펼쳐지고, **바깥을 누르거나 Esc 를 누르면 접힌다.**
    아직 가로지를 검색 대상(전체 검색 API)이 없어 입력만 받는다 — 제출은
    아무 데도 보내지 않는다. 그 뒤는 검색 대상이 정해지면 붙인다.
  */
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    if (!searchOpen) {
      return undefined
    }

    const closeIfOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false)
      }
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', closeIfOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeIfOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [searchOpen])

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
    }
  }, [searchOpen])

  // 레일에는 아이콘만 보인다. 여러 계정을 오가는 사람이 지금 누구로 로그인해
  // 있는지 확인할 자리가 여기뿐이라, 이름을 받으면 라벨에 함께 적는다.
  const accountLabel = user?.name ? `개인 설정 · ${user.name}` : '개인 설정'

  return (
    <>
      <aside
        className={collapsed ? 'global-sidebar is-collapsed' : 'global-sidebar'}
        aria-label="주요 메뉴"
        inert={collapsed}
      >
        <nav className="global-sidebar-nav" aria-label="주요 화면">
          {globalNavItems.map((item) => {
            // 지금 진행 중인 회의가 있으면 `회의` 아이콘이 실시간 아이콘으로
            // 바뀐다. 눌러도 이동하지 않는다 — 참여할지 대리인을 보낼지부터
            // 팝업으로 묻는다.
            if (item.id === 'meeting' && liveMeeting) {
              return (
                <button
                  key={item.id}
                  type="button"
                  className="global-sidebar-link global-sidebar-live"
                  aria-label="지금 진행 중인 회의"
                  title="지금 진행 중인 회의"
                  onClick={openPrompt}
                >
                  <img src="/icons/LiveMeetingIcon.svg" alt="" />
                </button>
              )
            }

            return (
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
            )
          })}

          <div className="global-sidebar-search" ref={searchRef}>
            <button
              type="button"
              className={
                searchOpen ? 'global-sidebar-link global-sidebar-search-btn active' : 'global-sidebar-link global-sidebar-search-btn'
              }
              aria-label="검색"
              aria-expanded={searchOpen}
              title="검색"
              onClick={() => setSearchOpen((open) => !open)}
            >
              <img src="/icons/Search.svg" alt="" />
            </button>

            {searchOpen ? (
              <form className="global-sidebar-search-panel" onSubmit={(event) => event.preventDefault()}>
                <img src="/icons/Search.svg" alt="" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder="검색어를 입력하세요..."
                  aria-label="검색어 입력"
                />
              </form>
            ) : null}
          </div>
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

      <LiveMeetingPrompt
        open={promptOpen}
        meeting={liveMeeting}
        secondsLeft={secondsLeft}
        responding={responding}
        onDecline={respondDecline}
        onJoin={respondJoin}
      />
    </>
  )
}
