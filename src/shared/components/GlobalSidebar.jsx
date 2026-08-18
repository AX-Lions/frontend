import { useCallback, useEffect, useRef, useState } from 'react'

import { AppLink } from '../../app/AppLink.jsx'
import { navigate } from '../../app/navigation.js'
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

/**
 * 지금 이 순간 진행 중인 회의 하나.
 *
 * `delegation` 이 있는 것만 본다 — 대리인을 보낼 수 있는 회의(내가 참석자인
 * 회의)에서만 "참여할까, 대리인을 보낼까" 를 물을 수 있다. 초대만 받은 회의
 * (`delegation: null`)는 이 팝업의 질문 자체가 성립하지 않는다.
 */
function findLiveMeeting(home, now) {
  const schedule = home?.today_schedule ?? []
  return schedule.find((item) => {
    if (!item.meeting_id || !item.at || !item.ends_at || !item.delegation) {
      return false
    }
    const start = new Date(item.at).getTime()
    const end = new Date(item.ends_at).getTime()
    return now >= start && now <= end
  }) ?? null
}

const RESPONSE_SECONDS = 10

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

  /*
    실시간 회의 팝업(시안 `666:4920` · `666:5231`).

    `HomePage` 와 같은 캐시 키(`home`)를 쓴다 — 이유는 요청함 뱃지와 같다.
    `today_schedule` 은 이미 `/home` 에 있으므로 새 주소를 만들지 않는다.

    지금 진행 중인 회의가 있으면 `회의` 아이콘이 실시간 아이콘으로 바뀐다.
    30초마다 `now` 를 다시 재서, 회의가 끝나면 아이콘도 스스로 돌아온다 —
    새로고침해야만 없어지면 회의가 끝난 뒤에도 한참 눌리게 된다.
  */
  const { data: home } = useResource(
    (signal) => api.get('/home', undefined, { signal }), [], { cacheKey: 'home' })

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const liveMeeting = findLiveMeeting(home, now)

  const [meetingPromptOpen, setMeetingPromptOpen] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(RESPONSE_SECONDS)
  const [responding, setResponding] = useState(false)
  // `useCallback` 의 `responding` 을 굳이 의존성에 넣지 않으려고 판정은
  // ref 로 한다 — 상태로 넣으면 응답 중일 때마다 아래 카운트다운 effect 가
  // 새 함수를 받아 다시 돈다.
  const respondingRef = useRef(false)

  const openMeetingPrompt = () => {
    setSecondsLeft(RESPONSE_SECONDS)
    setMeetingPromptOpen(true)
  }

  /**
   * 대리인에게 맡긴다.
   *
   * 10초 동안 응답이 없을 때와 `불참하기` 를 누를 때가 같은 일이다 — 둘 다
   * "이 회의는 내가 아니라 Bordo 가 간다" 는 결정이다. 이미 손봐 둔 자료
   * 범위·사전 지시(`liveMeeting.delegation`)가 있으면 그대로 쓴다. 없으면
   * 빈 값으로 켠다 — 대리인은 보내되 범위는 나중에 개인 설정에서 정할 수 있다.
   */
  const respondDecline = useCallback(async () => {
    if (!liveMeeting || respondingRef.current) {
      return
    }
    respondingRef.current = true
    setResponding(true)
    try {
      await api.post(`/meetings/${liveMeeting.meeting_id}/delegate`, {
        enabled: true,
        sources: liveMeeting.delegation?.sources ?? [],
        prompt: liveMeeting.delegation?.prompt ?? '',
      })
    } catch {
      // 팝업의 목적은 "지금 어떻게 할지" 를 정하는 것이지 이 요청의 성패를
      // 다루는 것이 아니다. 실패해도 닫는다 — 대리인 설정은 개인 설정에서
      // 다시 손볼 수 있다.
    } finally {
      respondingRef.current = false
      setResponding(false)
      setMeetingPromptOpen(false)
    }
  }, [liveMeeting])

  const respondJoin = () => {
    if (liveMeeting?.action?.url) {
      window.open(liveMeeting.action.url, '_blank', 'noopener')
    } else if (liveMeeting) {
      navigate(`/flow-board?meeting=${liveMeeting.meeting_id}`)
    }
    setMeetingPromptOpen(false)
  }

  /*
    매초 줄이고, 0 에 닿으면 `불참하기` 와 같은 일을 한다.

    타이머 콜백 안에서만 `setState` 를 부른다 — effect 본문에서 곧장 부르면
    "effect 안에서 동기적으로 상태를 바꾼다" 는 린트 규칙에 걸린다
    (`useResource.js` 의 같은 사연 참고).
  */
  useEffect(() => {
    if (!meetingPromptOpen) {
      return undefined
    }

    let remaining = RESPONSE_SECONDS
    const id = window.setInterval(() => {
      remaining -= 1
      setSecondsLeft(Math.max(0, remaining))
      if (remaining <= 0) {
        window.clearInterval(id)
        respondDecline()
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [meetingPromptOpen, respondDecline])

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
                onClick={openMeetingPrompt}
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

      {meetingPromptOpen && liveMeeting ? (
        <div className="live-meeting-backdrop" role="presentation">
          <div
            className="live-meeting-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="live-meeting-title"
          >
            <div className="live-meeting-body">
              <h2 id="live-meeting-title">
                Discord에서 회의가 시작됐어요.
                <br />
                참여하시겠습니까?
              </h2>
              <p>응답이 없으면 {RESPONSE_SECONDS}초 후 당신의 Bordo가 대신 참여해요.</p>
              <div className="live-meeting-countdown" aria-hidden="true">{secondsLeft}</div>
            </div>

            <div className="live-meeting-actions">
              <button
                type="button"
                className="live-meeting-decline"
                disabled={responding}
                onClick={respondDecline}
              >
                불참하기
              </button>
              <button type="button" className="live-meeting-join" onClick={respondJoin}>
                참여하기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
