import { useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { DelegateDialog } from './DelegateDialog.jsx'
import { AgentDock } from './AgentDock.jsx'
import { BriefingPrompt } from './BriefingPrompt.jsx'
import { CreateProjectDialog } from './CreateProjectDialog.jsx'
import { fetchHome, setMeetingFavorite } from './home.api.js'
import { navigate } from '../../app/navigation.js'
import { useResource } from '../../lib/useResource.js'
import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

const starIcons = {
  active: '/icons/Staractive.svg',
  inactive: '/icons/Starunactive.svg',
}

function isModifiedClick(event) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    || (event.button !== undefined && event.button !== 0)
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
  const [delegateFor, setDelegateFor] = useState(null)
  const [addingProject, setAddingProject] = useState(false)
  // 브리핑 팝업은 한 번만 뜬다. `homeData` 를 다시 읽을 때마다 뜨면, 별 하나
  // 눌렀다고 팝업이 다시 올라온다.
  const [briefingSeen, setBriefingSeen] = useState(false)
  // 자동 열기는 상태가 아니라 ref 다. 상태로 두면 effect 안에서 setState 를
  // 부르게 되고 렌더가 한 번 더 돈다 — 어차피 화면에 아무것도 안 그리는 값이다.
  const autoOpenedRef = useRef(false)

  /** 저장한 결과를 목록에 반영한다. 전체를 다시 읽으면 스크롤이 튄다. */
  const applyDelegation = (meetingId, saved) => setData((current) => (current ? {
    ...current,
    today_schedule: current.today_schedule.map((s) => (
      s.meeting_id === meetingId
        ? { ...s, delegation: { delegated: saved.delegated, prompt: saved.prompt, sources: saved.sources } }
        : s
    )),
  } : current))

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
    navigate(`/flow-board?meeting=${briefing.meeting_id}&source=bordo-briefing`,
      { replace: true })
  }, [autoOpenBriefing, briefing.meeting_id])

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

  // 전역 레일은 **읽는 중에도 실패해도 자리에 있어야 한다.** 홈이 안 불러와졌다고
  // 채팅·설정으로 갈 길까지 사라지면, 사용자는 새로고침 말고 할 수 있는 것이 없다.
  if (loading && !homeData) {
    return (
      <div className="home-layout">
        <GlobalSidebar active="home" />
        <Sidebar favoriteProjects={[]} recentProjects={[]} />
        <main className="home-main"><Loading label="홈을 불러오는 중입니다…" /></main>
      </div>
    )
  }

  if (error && !homeData) {
    return (
      <div className="home-layout">
        <GlobalSidebar active="home" />
        <Sidebar favoriteProjects={[]} recentProjects={[]} />
        <main className="home-main"><LoadError error={error} onRetry={reload} /></main>
      </div>
    )
  }

  const recentMeetings = homeData.recent_meetings ?? []
  const todaySchedule = homeData.today_schedule ?? []
  const summary = homeData.recent_meeting_summary
  const briefingHref = briefing.exists
    ? `/flow-board?meeting=${briefing.meeting_id}&source=bordo-briefing`
    : null

  return (
    <div className="home-layout">
      <GlobalSidebar active="home" user={{ name: homeData.user_name }} />
      <Sidebar
        favoriteProjects={homeData.favorite_projects ?? []}
        recentProjects={homeData.recent_projects ?? []}
        shortcuts={homeData.shortcuts}
        userName={homeData.user_name}
        avatarUrl={homeData.user_avatar_url}
        meetingIdByProject={meetingIdByProject}
        onAddProject={() => setAddingProject(true)}
      />

      <main className="home-main">
        {favoriteMessage ? (
          <div className="favorite-toast" role="status" aria-live="polite">
            {favoriteMessage}
          </div>
        ) : null}

        <div className="home-content">
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
                  onClick={(event) => goInApp(event, briefingHref)}
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
                      <a
                        className="project-card-link"
                        href={href}
                        onClick={(event) => {
                          setSelectedMeetingId(meeting.meeting_id)
                          goInApp(event, href)
                        }}
                      >
                        {/* 회의가 자기 프로젝트 이름을 들고 온다. 프로젝트 목록에서
                            찾을 필요가 없다 — 목록에 없는 프로젝트의 회의도 있다. */}
                        <span className="meeting-company">{meeting.project_name}</span>
                        <strong>{meeting.title}</strong>

                        {/*
                          이 서비스가 답하려는 질문이 "내가 없는 동안 무슨 일이
                          있었지" 다. **그 질문에 해당하는 회의를 골라내는 표시가
                          이 뱃지**인데 서버(`recent_meetings[].missed`)만 주고
                          화면이 그리지 않았다. 다섯 장이 전부 똑같아 보였다.
                        */}
                        <span className="card-foot">
                          {meeting.missed ? (
                            <span className="missed-badge">불참한 회의</span>
                          ) : null}
                          <time>{meeting.displayed_at}</time>
                        </span>
                      </a>
                      <button
                        className={meeting.is_favorite ? 'favorite-mark active' : 'favorite-mark'}
                        type="button"
                        aria-label={meeting.is_favorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
                        disabled={pendingFavorites.includes(meeting.meeting_id)}
                        onClick={(event) => toggleFavorite(event, meeting.meeting_id)}
                      >
                        <img src={meeting.is_favorite ? starIcons.active : starIcons.inactive} alt="" />
                      </button>
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
                  전체 일정 화면이 아직 없다. `href="/"` 짜리 화살표를 두면
                  눌렀을 때 홈이 다시 뜨는데, 그건 "없다" 가 아니라 "고장" 으로
                  읽힌다. 갈 곳이 생기면 그때 붙인다.
                */}
              </div>
              <div className="schedule-content">
                {todaySchedule.length === 0 ? (
                  <Empty>오늘 잡힌 일정이 없습니다.</Empty>
                ) : todaySchedule.map((schedule) => {
                  const scheduleKey = schedule.meeting_id ?? `${schedule.at}-${schedule.project_id}`

                  return (
                    <div className="schedule-item" key={scheduleKey}>
                      <button
                        className={selectedScheduleKey === scheduleKey ? 'schedule-info selected' : 'schedule-info'}
                        type="button"
                        onClick={() => setSelectedScheduleKey(scheduleKey)}
                      >
                        {/* `time_range` 는 참여자 시간대로 서버가 계산해 준다.
                            브라우저 시간대로 다시 찍으면 같은 회의를 사람마다
                            다른 시각으로 본다. */}
                        <time>{schedule.time_range}</time>
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
                          onClick={() => setDelegateFor(schedule)}
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

      {delegateFor ? (
        <DelegateDialog
          schedule={delegateFor}
          onClose={() => setDelegateFor(null)}
          onSaved={applyDelegation}
        />
      ) : null}

      {addingProject ? (
        <CreateProjectDialog
          onClose={() => setAddingProject(false)}
          // 만든 프로젝트를 목록 맨 위에 얹는다. 홈 전체를 다시 읽으면 방금
          // 만든 것을 찾으려고 사용자가 목록을 훑어야 한다.
          onCreated={(project) => setData((current) => (current ? {
            ...current,
            recent_projects: [project, ...(current.recent_projects ?? [])],
          } : current))}
        />
      ) : null}

      {briefing.exists && !briefing.always_open && !briefingSeen ? (
        <BriefingPrompt briefing={briefing} onClose={() => setBriefingSeen(true)} />
      ) : null}
    </div>
  )
}
