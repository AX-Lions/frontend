import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { AgentDock } from './AgentDock.jsx'
import { BriefingPrompt } from './BriefingPrompt.jsx'
import { ConfirmedScheduleDialog } from './ConfirmedScheduleDialog.jsx'
import { NewProjectDialog } from './NewProjectDialog.jsx'
import { fetchHome, setMeetingFavorite } from './home.api.js'
import { navigate } from '../../app/navigation.js'
import { NEW_EVENT_PARAM } from '../meetingSchedule/meetingSchedule.data.js'
import { getCurrentTeamId, onCurrentTeamChange } from '../../lib/currentTeam.js'
import { cacheKeyFor, evict } from '../../lib/resourceCache.js'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { TeamOnboarding } from './TeamOnboarding.jsx'

const starIcons = {
  active: '/icons/Staractive.svg',
  inactive: '/icons/Starunactive.svg',
}

/*
  「나중에 보기」로 닫은 브리핑은 `localStorage` 에 남긴다.

  전에는 모듈 스코프 변수 하나였다 — 같은 탭 안에서 다른 화면에 갔다가
  돌아오는 것까지는 버텼지만(그 사이엔 `HomePage` 가 다시 마운트돼도 이
  변수는 그대로다), **새로고침하거나 다시 들어오면 초기화됐다.** 서버는
  사람이 브리핑을 실제로 열기 전까진 `briefing_pending.exists` 를 계속
  주므로(그쪽이 맞다 — 진짜 안 읽었으니까), 그 값만 보면 새로고침마다
  같은 팝업이 다시 떴다.

  `meeting_id` 로 저장해 둔다 — 통째로 "브리핑은 다시 안 띄운다" 를 저장하면
  나중에 진짜 새로 생긴 브리핑까지 영영 안 뜬다. 지금 뜬 이 브리핑만
  다시 안 뜨면 된다.
*/
const DISMISSED_BRIEFING_KEY = 'bordo.dismissedBriefingMeetingId'

function getDismissedBriefingMeetingId() {
  try {
    return window.localStorage.getItem(DISMISSED_BRIEFING_KEY)
  } catch {
    return null
  }
}

function setDismissedBriefingMeetingId(meetingId) {
  try {
    window.localStorage.setItem(DISMISSED_BRIEFING_KEY, meetingId)
  } catch {
    // 저장이 안 돼도(시크릿 모드 등) 팝업 자체는 떠야 한다 — 여기서 막지 않는다.
  }
}

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || (event.button !== undefined && event.button !== 0)
}

/**
 * 브리핑으로 가기 전에 담아 둔 홈을 버린다.
 *
 * 브리핑을 열면 서버가 그 자리에서 읽음으로 표시한다 — `GET /meetings/{id}/
 * ai-briefing` 이 `read_at` 을 찍는다. 담아 둔 홈에는 `briefing_pending.exists`
 * 가 아직 참으로 남아 있어, 30초 안에 홈으로 돌아오면 **방금 읽은 브리핑이 다시
 * 대기 중으로 뜬다.** 자동 열기를 켜 둔 사람은 더 나쁘다 — 그 값 때문에 홈에
 * 들어오는 족족 브리핑으로 밀려나 홈을 못 본다.
 */
function dropHomeCache() {
  evict(cacheKeyFor('home', []))
}

/** 앱 안 링크는 문서를 다시 받지 않는다. 새 탭으로 여는 클릭은 그대로 둔다. */
function goInApp(event, href) {
  if (isModifiedClick(event)) {
    return
  }
  event.preventDefault()
  navigate(href)
}

export function HomePage() {
  const { data: homeData, error, loading, reload, setData } = useResource(fetchHome, [], { cacheKey: 'home' })
  const [favoriteMessage, setFavoriteMessage] = useState('')
  const [selectedMeetingId, setSelectedMeetingId] = useState(null)
  const [selectedScheduleKey, setSelectedScheduleKey] = useState(null)
  const [pendingFavorites, setPendingFavorites] = useState([])
  const [addingProject, setAddingProject] = useState(false)
  // 「오늘 일정」 한 줄을 눌렀을 때 뜨는 확정된 일정 확인 팝업의 대상 회의.
  const [confirmingMeetingId, setConfirmingMeetingId] = useState(null)
  /*
    사이드바 접힘은 **레일과 프로젝트 목록이 함께 본다.** 접었을 때 레일만
    남으면 왼쪽이 여전히 두 칸이라 접힌 것으로 보이지 않는다. 값을 둘의 공통
    부모인 여기에 두고 양쪽에 내려 준다.
  */
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const toggleSidebar = () => setIsSidebarCollapsed((collapsed) => !collapsed)
  // `팀 전환하기`(`TeamSwitchDialog`)가 고른 팀. `null` 이면 전체 보기다.
  // `localStorage` 값이라 리액트 상태로 옮겨 받아야 바뀌었을 때 다시 그린다.
  const [currentTeamId, setCurrentTeamIdState] = useState(getCurrentTeamId)
  useEffect(() => onCurrentTeamChange(setCurrentTeamIdState), [])
  /*
    브리핑 팝업은 한 번만 뜬다. `homeData` 를 다시 읽을 때마다 뜨면, 별 하나
    눌렀다고 팝업이 다시 올라온다.

    이 상태 자체은 "이번 렌더 트리에서 방금 닫았다" 만 즉시 반영하는 자리다
    — `localStorage` 에 쓴 값은 리액트가 모르므로, 쓰자마자 곧장 렌더에
    반영하려면 이 상태가 따로 있어야 한다. 그보다 오래가는 기억(다른
    화면에 갔다 왔을 때·새로고침했을 때)은 아래 렌더 조건에서
    `getDismissedBriefingMeetingId()` 로 직접 확인한다.
  */
  const [briefingSeen, setBriefingSeen] = useState(false)
  // 자동 열기는 상태가 아니라 ref 다. 상태로 두면 effect 안에서 setState 를
  // 부르게 되고 렌더가 한 번 더 돈다 — 어차피 화면에 아무것도 안 그리는 값이다.
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    if (!favoriteMessage) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setFavoriteMessage('')
    }, 1800)

    return () => window.clearTimeout(timerId)
  }, [favoriteMessage])

  const briefing = homeData?.briefing_pending ?? {}
  const autoOpenBriefing = Boolean(briefing.exists && briefing.always_open && briefing.meeting_id)

  /*
    `홈 진입 시 자동 열기` 를 켠 사람은 팝업을 볼 이유가 없다. 이미 답을 해
    둔 질문이므로 그대로 브리핑으로 보낸다.

    `replace: true` 로 보낸다. push 로 쌓으면 브리핑에서 뒤로 가기를 눌렀을 때
    홈이 다시 자동으로 브리핑을 열어 **뒤로 가기가 막힌다.**
  */
  useEffect(() => {
    if (!autoOpenBriefing || autoOpenedRef.current) {
      return
    }
    autoOpenedRef.current = true
    dropHomeCache()
    navigate(`/flow-board?meeting=${briefing.meeting_id}&source=bordo-briefing`,
      { replace: true })
  }, [autoOpenBriefing, briefing.meeting_id])

  /*
    팝업이 닫힌 뒤 홈이 할 일.

    `result` 는 **서버에 저장이 끝났을 때만** 온다(`POST /me/briefing-dismiss`).
    X·Esc·바깥 클릭으로 그냥 닫은 것은 서버에 아무것도 안 보내므로 아래
    `dropHomeCache`·`always_open` 처리는 안 탄다 — 담아 둔 홈은 그대로 둔다.

    다시 뜨는 것을 막는 것은 다르다. **닫는 방법과 상관없이** 사람이 이
    팝업을 치웠다는 사실 자체는 남긴다 — X 로 닫든 「나중에 보기」를
    누르든, 사용자에게는 똑같이 "이건 봤고 지금은 됐다" 는 뜻이다. 여기서
    갈리면 X 로 닫은 사람만 계속 같은 팝업을 본다.

    `briefing_pending.exists` 는 건드리지 않는다. 그 요청이 서버에서 바꾸는
    것은 `always_open` 하나뿐이고, 대기 표시는 브리핑을 실제로 열었을 때만
    꺼진다. 화면에서 미리 꺼 버리면 상단 버튼이 `새 브리핑 없음` 으로 바뀌어
    **아직 안 읽은 브리핑으로 가는 길이 사라진다.** 대신 이 팝업 자체를
    다시 안 띄우는 것으로 "귀찮게 굴지 않는다" 를 지킨다.
  */
  const closeBriefing = (result) => {
    setBriefingSeen(true)
    if (briefing.meeting_id) {
      setDismissedBriefingMeetingId(briefing.meeting_id)
    }
    if (!result) {
      return
    }

    // 이번 방문에서는 자동 열기가 발동하면 안 된다. 방금 닫은 사람을 뒤늦게
    // 도착한 값으로 브리핑에 밀어 넣으면, **닫았을 뿐인데 화면이 튄다.**
    autoOpenedRef.current = true

    if (result.opened) {
      // 브리핑을 보러 가는 길이면 곧 읽음이 된다. 설정 저장이 실패했더라도
      // 그건 마찬가지라, 담아 둔 홈은 고쳐 쓰지 않고 버린다.
      dropHomeCache()
      return
    }

    setData((current) => (current ? {
      ...current,
      briefing_pending: { ...current.briefing_pending, always_open: result.alwaysOpen },
    } : current))
  }

  /*
    프로젝트 하나가 어느 회의로 열리는지.

    플로우 화면이 지금 읽는 것은 `?meeting` 뿐이라, 사이드바 프로젝트 링크에
    회의 id 를 실어 줘야 그 프로젝트 화면이 뜬다. 최근 회의 목록이 이미
    `project_id` 를 들고 있으므로 추가 요청 없이 짝을 지을 수 있다.

    목록은 최신순이라 먼저 나온 것을 남긴다.
  */
  const meetingIdByProject = useMemo(() => {
    const map = {}
    ;(homeData?.recent_meetings ?? []).forEach((m) => {
      if (m.project_id && !map[m.project_id]) {
        map[m.project_id] = m.meeting_id
      }
    })
    return map
  }, [homeData])

  /**
   * 별을 먼저 칠하고 서버에 보낸다.
   *
   * 응답을 기다렸다 칠하면 누른 뒤 잠깐 아무 일도 안 일어난 것처럼 보여 두 번
   * 누르게 된다. 실패하면 되돌리고 **왜 안 됐는지** 말한다 — 조용히 되돌리면
   * 사용자는 자기가 잘못 눌렀다고 생각한다.
   */
  const toggleFavorite = async (event, meetingId) => {
    event.preventDefault()
    event.stopPropagation()

    // 보내는 중인 것은 다시 받지 않는다.
    //
    // 빠르게 두 번 누르면 두 요청이 순서 없이 오간다. `PUT` 이 `DELETE` 보다
    // 늦게 도착하면 **서버는 즐겨찾기인데 화면은 아니다.** 성공 경로에서는
    // 서버 값과 다시 맞춰 보지 않으므로 그 어긋남이 새로고침 전까지 남는다.
    if (pendingFavorites.includes(meetingId)) {
      return
    }

    const target = homeData?.recent_meetings?.find((m) => m.meeting_id === meetingId)
    if (!target) {
      return
    }
    const next = !target.is_favorite

    const paint = (on) => setData((current) => (current ? {
      ...current,
      recent_meetings: current.recent_meetings.map((m) =>
        m.meeting_id === meetingId ? { ...m, is_favorite: on } : m),
    } : current))

    paint(next)
    setFavoriteMessage(next ? '즐겨찾기에 추가했습니다' : '즐겨찾기에서 제거했습니다')
    setPendingFavorites((c) => [...c, meetingId])

    try {
      await setMeetingFavorite(meetingId, next)
    } catch (err) {
      paint(!next)
      setFavoriteMessage(err?.message || '즐겨찾기를 바꾸지 못했습니다')
    } finally {
      setPendingFavorites((c) => c.filter((id) => id !== meetingId))
    }
  }

  // 사이드바 상단(로고+아이콘 줄)은 **읽는 중에도 실패해도 자리에 있어야 한다.**
  // 홈이 안 불러와졌다고 채팅·설정으로 갈 길까지 사라지면, 사용자는 새로고침
  // 말고 할 수 있는 것이 없다. 아이콘 줄은 `homeData` 가 아니라 자기 훅으로
  // 따로 읽으므로 여기서도 그대로 뜬다.
  if (loading && !homeData) {
    return (
      <div className="home-layout">
        <Sidebar
          favoriteProjects={[]}
          recentProjects={[]}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <main className="home-main"><Loading label="홈을 불러오는 중입니다…" /></main>
      </div>
    )
  }

  if (error && !homeData) {
    return (
      <div className="home-layout">
        <Sidebar
          favoriteProjects={[]}
          recentProjects={[]}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <main className="home-main"><LoadError error={error} onRetry={reload} /></main>
      </div>
    )
  }

  const recentMeetings = homeData.recent_meetings ?? []
  const todaySchedule = homeData.today_schedule ?? []
  const summary = homeData.recent_meeting_summary

  /*
    팀 전환하기가 고른 팀만 남긴다.

    회의·오늘 일정은 안 거른다 — 저 둘은 이미 지나갔거나 오늘 잡힌
    **참석 대상**이지 "지금 보는 팀" 과 무관하다. 팀을 바꿔도 오늘 회의가
    없어지면 정작 봐야 할 것을 놓친다. 거르는 것은 프로젝트 목록뿐이다.
  */
  const inCurrentTeam = (project) => !currentTeamId || project.team_id === currentTeamId
  const favoriteProjects = (homeData.favorite_projects ?? []).filter(inCurrentTeam)
  const recentProjects = (homeData.recent_projects ?? []).filter(inCurrentTeam)

  /*
    아무 데도 안 붙어 있는 사람.

    가입만 하고 팀이 없으면 홈이 **전부 0** 으로 뜨는데, 팀을 만들 버튼도 초대
    코드를 넣을 칸도 화면에 없어서 빠져나갈 길이 없었다. 서버에는 처음부터 다
    있던 기능이다.

    비어 있는 것만으로 판정한다 — `/home` 은 "이 사람이 팀이 있는가" 를 직접
    말해 주지 않는다. 팀이 있는데 프로젝트만 없는 경우와는 해야 할 일이 다르므로
    그 구별은 아래 화면이 팀 목록을 한 번 읽어서 한다. **홈이 비어 있을 때만**
    나가는 요청이다.

    프로젝트가 있는지는 **`project_progress` 로 본다.** `recent_projects` 는
    `RecentProject.opened_at` 기준이라 *내가 열어 본* 것만 들어오고,
    `favorite_projects` 는 즐겨찾기다. 둘 다 `project_progress` 의 부분집합이라
    (`flowBoard.data.js` 의 `projectNameIn` 도 같은 순서로 읽는다), 이것들로
    판정하면 **프로젝트에 소속돼 있지만 아직 한 번도 열어 보지 않은 사람**이
    걸린다. 프로젝트를 만들면 팀 전원이 `ProjectMember` 로 들어가므로 새로
    합류한 팀원이 곧장 이 상태다. 그 사람에게 `프로젝트 만들기` 를 권하면
    동료들이 쓰는 판 옆에 빈 판을 하나 더 만들게 된다 — 이 화면이 막으려던
    바로 그 사고다.
  */
  // 팀 전환하기로 고른 팀에 프로젝트가 없다고 해서 온보딩(첫 팀·프로젝트 만들기)을
  // 다시 띄우면 안 된다 — 다른 팀엔 있을 수 있다. 판정은 거르기 전 값으로 한다.
  const nothingYet = recentMeetings.length === 0
    && (homeData.project_progress ?? []).length === 0
    && todaySchedule.length === 0
  const briefingHref = briefing.exists
    ? `/flow-board?meeting=${briefing.meeting_id}&source=bordo-briefing`
    : null

  return (
    <div className="home-layout">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        favoriteProjects={favoriteProjects}
        recentProjects={recentProjects}
        userName={homeData.user_name}
        avatarUrl={homeData.user_avatar_url}
        meetingIdByProject={meetingIdByProject}
        onAddProject={() => setAddingProject(true)}
      />

      <main className="home-main">
        {nothingYet ? (
          <TeamOnboarding
            onDone={reload}
            onAddProject={() => setAddingProject(true)}
          />
        ) : null}

        {favoriteMessage ? (
          <div className="favorite-toast" role="status" aria-live="polite">
            {favoriteMessage}
          </div>
        ) : null}

        <div className="home-content" hidden={nothingYet}>
          <section className="welcome-section">
            <div className="welcome-row">
              <h1>
                {/* 서버는 이름만 준다. 호칭은 화면이 붙인다. */}
                안녕하세요, {homeData.user_name}님
                <br />
                Bordo에 오신 것을 환영합니다.
              </h1>
              {briefingHref ? (
                <a
                  className="ai-brief-button"
                  href={briefingHref}
                  onClick={(event) => {
                    dropHomeCache()
                    goInApp(event, briefingHref)
                  }}
                >
                  Bordo 브리핑 보러가기
                </a>
              ) : (
                // 브리핑이 없을 때 `href="/"` 인 버튼을 두면 눌러서 홈이 다시
                // 뜬다. 갈 곳이 없으면 링크가 아니라 안내다.
                <span className="ai-brief-button disabled" aria-disabled="true">
                  새 브리핑 없음
                </span>
              )}
            </div>
          </section>

          <section className="recent-section" aria-labelledby="recent-title">
            <div className="section-heading">
              <h2 id="recent-title">최근 회의</h2>
              {/* 회의 목록 화면이 따로 없다. 회의 화면으로 보낸다 — 전역
                  레일의 `회의` 와 같은 자리다. */}
              <a
                className="section-arrow"
                href="/flow-board"
                aria-label="회의 화면으로"
                data-tip="회의 화면으로"
                onClick={(event) => goInApp(event, '/flow-board')}
              >
                <img src="/icons/Expandright.svg" alt="" aria-hidden="true" />
              </a>
            </div>

            {recentMeetings.length === 0 ? (
              <Empty>아직 참여한 회의가 없습니다.</Empty>
            ) : (
              <div className="project-strip">
                {recentMeetings.slice(0, 5).map((meeting) => {
                  const href = `/flow-board?meeting=${meeting.meeting_id}`

                  return (
                    <article
                      className={
                        selectedMeetingId === meeting.meeting_id ? 'project-card selected' : 'project-card'
                      }
                      key={meeting.meeting_id}
                    >
                      {/*
                        회사 이름과 즐겨찾기 별은 **한 줄에 나란히 선 형제**다.

                        별을 링크(`<a>`) 안에 넣으면 앵커 안에 단추가 들어가 HTML
                        규칙에 어긋난다 — 스크린리더가 둘을 하나로 읽거나 키보드
                        차례가 브라우저마다 갈린다. 대신 줄을 따로 두고, 카드 전체를
                        누르는 것은 아래 링크가 덮개(`::after`)로 맡는다.

                        폭도 이 줄이 정한다. 예전에는 별이 절대 위치라 이름 쪽에
                        `max-width: 108px` 를 손으로 박아 비켜 갔는데, 그 숫자가
                        별 크기·여백과 따로 놀아서 한쪽만 바뀌면 겹쳤다.
                      */}
                      <div className="project-card-head">
                        {/* 회의가 자기 프로젝트 이름을 들고 온다. 프로젝트 목록에서
                            찾을 필요가 없다 — 목록에 없는 프로젝트의 회의도 있다. */}
                        <span className="meeting-company">{meeting.project_name}</span>
                        <button
                          className={meeting.is_favorite ? 'favorite-mark active' : 'favorite-mark'}
                          type="button"
                          aria-label={meeting.is_favorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
                          data-tip={meeting.is_favorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
                          disabled={pendingFavorites.includes(meeting.meeting_id)}
                          onClick={(event) => toggleFavorite(event, meeting.meeting_id)}
                        >
                          <img src={meeting.is_favorite ? starIcons.active : starIcons.inactive} alt="" />
                        </button>
                      </div>

                      <a
                        className="project-card-link"
                        href={href}
                        onClick={(event) => {
                          setSelectedMeetingId(meeting.meeting_id)
                          goInApp(event, href)
                        }}
                      >
                        <strong><span>{meeting.title}</span></strong>

                        {/*
                          이 서비스가 답하려는 질문이 "내가 없는 동안 무슨 일이
                          있었지" 다. **그 질문에 해당하는 회의를 골라내는 표시가
                          이 뱃지**인데 서버(`recent_meetings[].missed`)만 주고
                          화면이 그리지 않았다. 다섯 장이 전부 똑같아 보였다.

                          시각이 뱃지보다 **위**다. 카드 바닥에 붙는 두 줄
                          중에서 아래쪽이 눈에 먼저 걸리는데, 다섯 장을 훑을 때
                          찾는 것은 언제 열린 회의인지가 아니라 **어느 것이
                          내가 빠진 회의인지**다.
                        */}
                        <span className="card-foot">
                          <time>{meeting.displayed_at}</time>
                          {meeting.missed ? (
                            <span className="missed-badge">불참한 회의</span>
                          ) : null}
                        </span>
                      </a>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="dashboard-grid">
            <article className="schedule-panel">
              <div className="section-heading">
                <h2>오늘 일정</h2>
                {/*
                  `+` 는 회의 일정 화면으로 보내고 거기서 `일정 추가하기`
                  팝업을 연다.

                  홈에서 바로 팝업을 띄우던 자리였다. 그런데 만들고 나면
                  **방금 잡은 일정이 어디에 놓였는지 볼 수 없었다** — 오늘이
                  아닌 날로 잡으면 홈 「오늘 일정」에는 아예 안 나타난다.
                  달력 위에서 만들면 만든 자리가 곧 결과라 그 자리에서 확인된다.
                */}
                <button
                  className="icon-button"
                  type="button"
                  aria-label="회의 일정 추가"
                  data-tip="회의 일정 추가"
                  onClick={() => navigate(`/meeting-schedule?${NEW_EVENT_PARAM}=1`)}
                >
                  <img src="/icons/AddIcon.svg" alt="" />
                </button>
              </div>
              <div className="schedule-content">
                {todaySchedule.length === 0 ? (
                  <Empty>오늘 잡힌 일정이 없습니다.</Empty>
                ) : todaySchedule.map((schedule, index) => {
                  const scheduleKey = schedule.meeting_id ?? `${schedule.at}-${schedule.project_id}`

                  return (
                    <Fragment key={scheduleKey}>
                      {index > 0 ? <hr className="summary-divider" /> : null}
                      <div className="schedule-item">
                        {/*
                          시각은 회의 이름 **바깥**에 둔다.

                          좁아지면 시각이 제 줄로 빠지고 이름과 버튼이 그 아래 한
                          줄에 선다(시안 `754:5742`). 이름 상자 안에 있으면 그
                          상자 밖으로 나갈 수 없어 이 배치가 안 나온다.

                          `time_range` 는 참여자 시간대로 서버가 계산해 준다.
                          브라우저 시간대로 다시 찍으면 같은 회의를 사람마다 다른
                          시각으로 본다.
                        */}
                        <time className="schedule-time">{schedule.time_range}</time>
                        <button
                          className={selectedScheduleKey === scheduleKey ? 'schedule-info selected' : 'schedule-info'}
                          type="button"
                          onClick={() => {
                            setSelectedScheduleKey(scheduleKey)
                            // 상세가 있는 회의만 확인 팝업을 연다 — 회의 없이 시각만
                            // 잡힌 일정(`meeting_id: null`)은 보여 줄 회의가 없다.
                            if (schedule.meeting_id) {
                              setConfirmingMeetingId(schedule.meeting_id)
                            }
                          }}
                        >
                          <div>
                            <strong>{schedule.title}</strong>
                            <span>
                              {schedule.project_name} · {schedule.location}
                            </span>
                          </div>
                        </button>
                        {/*
                          `참여하기` 가 아니라 **불참 등록** 버튼이다.

                          회의에 들어갈 사람은 Discord 를 이미 열어 두고 있다.
                          이 화면에서 눌러야 하는 것은 오히려 그 반대 —
                          "못 간다, 대리인이 대신 가라" 다. 이 서비스가 답하려는
                          질문이 "내가 없는 동안 무슨 일이 있었지" 이므로,
                          **없을 것을 미리 등록하는 자리**가 첫 화면에 있어야 한다.

                          참석자가 아닌 회의는 `delegation` 이 `null` 이라 버튼을
                          내리지 않고 회의로 가는 링크만 남긴다.
                        */}
                        {schedule.delegation ? (
                          <button
                            className={schedule.delegation.delegated ? 'is-delegated' : ''}
                            type="button"
                            /*
                              팝업이 아니라 화면으로 보낸다.

                              회의 전에 해야 하는 준비가 자료 범위 네 칸에서
                              **예상 논쟁점 · 내 입장 · Bordo 활동 설정**까지
                              늘었다. 회의를 주소에 실어 보내므로 새로고침하거나
                              링크를 복사해도 같은 회의가 열린다.
                            */
                            onClick={() => navigate(
                              `/delegate-prep?meeting=${schedule.meeting_id}`)}
                          >
                            {schedule.delegation.delegated ? '대리 참석 중' : '회의에 참여하지 않아요'}
                          </button>
                        ) : schedule.action?.url ? (
                          <button
                            type="button"
                            onClick={() => window.open(schedule.action.url, '_blank', 'noopener')}
                          >
                            {schedule.action.label ?? '회의 참여하기'}
                          </button>
                        ) : (
                          // 링크가 없는 회의는 서비스 안에서 연다. 비활성 버튼을
                          // 두면 그 회의만 갈 데가 없어 보인다.
                          <button
                            type="button"
                            onClick={() => navigate(`/flow-board?meeting=${schedule.meeting_id}`)}
                          >
                            {schedule.action?.label ?? '보러가기'}
                          </button>
                        )}
                      </div>
                    </Fragment>
                  )
                })}
              </div>
            </article>

            <article className="summary-panel">
              <div className="section-heading">
                <h2>최근 회의</h2>
                {summary ? (
                  <a
                    className="section-arrow"
                    href={`/flow-board?meeting=${summary.meeting_id}`}
                    aria-label={`${summary.title} 자세히 보기`}
                    data-tip="회의 자세히 보기"
                    onClick={(event) => goInApp(event, `/flow-board?meeting=${summary.meeting_id}`)}
                  >
                    <img src="/icons/Expandright.svg" alt="" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              {/* 회의를 한 번도 안 한 팀은 요약이 없다. 카드를 빈 채로 두면
                  못 불러온 것처럼 보인다. */}
              {!summary ? (
                <Empty>아직 정리된 회의가 없습니다.</Empty>
              ) : (
                <div className="summary-content">
                  <div className="summary-topline">
                    <div className="summary-title-stack">
                      <span>{summary.project_name}</span>
                      <h3>{summary.title}</h3>
                    </div>
                    <div className="summary-state">
                      <time>{summary.displayed_at}</time>
                      {/* 뱃지 문구는 서버가 정한다. 참석/불참에 따라 색이
                          갈려야 하므로 상태만 클래스로 옮긴다. */}
                      <span className={summary.missed ? 'summary-badge' : 'summary-badge attended'}>
                        {summary.status}
                      </span>
                    </div>
                  </div>

                  <hr className="summary-divider" />

                  <div className="summary-block">
                    <strong>주요 결정</strong>
                    {(summary.main_decisions ?? []).length === 0 ? (
                      <p className="summary-none">정해진 것이 없습니다.</p>
                    ) : (
                      <ul>
                        {summary.main_decisions.map((decision, i) => (
                          // 결정 문구는 중복될 수 있다. 문구를 key 로 쓰면
                          // 같은 말이 두 번 나올 때 하나가 사라진다.
                          <li key={`${i}-${decision}`}>{decision}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="summary-block zero-summary">
                    <strong>Zero 요약</strong>
                    <p>{summary.zero_summary ? `“${summary.zero_summary}”` : '요약이 아직 없습니다.'}</p>
                  </div>
                </div>
              )}
            </article>
          </section>
        </div>

        <AgentDock />
      </main>

      {addingProject ? (
        <NewProjectDialog
          onClose={() => setAddingProject(false)}
          // 만든 프로젝트를 목록 맨 위에 얹는다. 홈 전체를 다시 읽으면 방금
          // 만든 것을 찾으려고 사용자가 목록을 훑어야 한다.
          // `project_progress` 에도 넣는다. 온보딩 화면이 뜰지 말지를 이걸로
          // 판정하므로, 여기 안 넣으면 프로젝트를 만들고도 화면이 `아직 참여
          // 중인 프로젝트가 없습니다` 로 남아 사용자가 또 만들게 된다.
          onCreated={(project) => {
            /*
              담아 둔 홈 응답을 버린다.

              화면 안의 값만 얹으면 **이 화면을 떠나는 순간 방금 만든
              프로젝트가 사라진다** — 다른 데 갔다 돌아오면 캐시에 있던
              옛 응답이 그대로 다시 그려지기 때문이다. 사용자는 프로젝트가
              안 만들어진 줄 알고 또 만든다.
            */
            evict(cacheKeyFor('home', []))
            setData((current) => (current ? {
              ...current,
              recent_projects: [project, ...(current.recent_projects ?? [])],
              project_progress: [project, ...(current.project_progress ?? [])],
            } : current))
          }}
        />
      ) : null}

      {confirmingMeetingId ? (
        <ConfirmedScheduleDialog
          meetingId={confirmingMeetingId}
          onClose={() => setConfirmingMeetingId(null)}
        />
      ) : null}

      {briefing.exists && !briefing.always_open && !briefingSeen
        && getDismissedBriefingMeetingId() !== briefing.meeting_id ? (
        <BriefingPrompt briefing={briefing} onClose={closeBriefing} />
      ) : null}
    </div>
  )
}
