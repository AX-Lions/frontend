import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { DelegateDialog } from './DelegateDialog.jsx'
import { fetchHome, setMeetingFavorite } from './home.api.js'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

const starIcons = {
  active: '/icons/Staractive.svg',
  inactive: '/icons/Starunactive.svg',
}

const chatIcons = {
  add: '/chat-icons/add-round.svg',
  filter: '/chat-icons/filter-alt.svg',
  send: '/chat-icons/send-hor.svg',
}

export function HomePage() {
  const { data: homeData, error, loading, reload, setData } = useResource(fetchHome)
  const [favoriteMessage, setFavoriteMessage] = useState('')
  const [selectedMeetingId, setSelectedMeetingId] = useState(null)
  const [selectedScheduleKey, setSelectedScheduleKey] = useState(null)
  const [pendingFavorites, setPendingFavorites] = useState([])
  const [delegateFor, setDelegateFor] = useState(null)

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

  if (loading && !homeData) {
    return (
      <div className="home-layout">
        <Sidebar favoriteProjects={[]} recentProjects={[]} />
        <main className="home-main"><Loading label="홈을 불러오는 중입니다…" /></main>
      </div>
    )
  }

  if (error && !homeData) {
    return (
      <div className="home-layout">
        <Sidebar favoriteProjects={[]} recentProjects={[]} />
        <main className="home-main"><LoadError error={error} onRetry={reload} /></main>
      </div>
    )
  }

  const recentMeetings = homeData.recent_meetings ?? []
  const todaySchedule = homeData.today_schedule ?? []
  const summary = homeData.recent_meeting_summary
  const briefing = homeData.briefing_pending ?? {}

  return (
    <div className="home-layout">
      <Sidebar
        favoriteProjects={homeData.favorite_projects ?? []}
        recentProjects={homeData.recent_projects ?? []}
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
              <a
                className={briefing.exists ? 'ai-brief-button' : 'ai-brief-button disabled'}
                href={
                  briefing.exists
                    ? `/flow-board?meeting=${briefing.meeting_id}&source=bordo-briefing`
                    : '/'
                }
                aria-disabled={briefing.exists ? undefined : 'true'}
              >
                Bordo 브리핑 보러가기
              </a>
            </div>
          </section>

          <section className="recent-section" aria-labelledby="recent-title">
            <div className="section-heading">
              <h2 id="recent-title">최근 회의</h2>
              <a className="section-arrow" href="/" aria-label="최근 회의 더보기">
                <img src="/icons/Expandright.svg" alt="" aria-hidden="true" />
              </a>
            </div>

            {recentMeetings.length === 0 ? (
              <Empty>아직 참여한 회의가 없습니다.</Empty>
            ) : (
              <div className="project-strip">
                {recentMeetings.slice(0, 5).map((meeting) => (
                  <article
                    className={
                      selectedMeetingId === meeting.meeting_id ? 'project-card selected' : 'project-card'
                    }
                    key={meeting.meeting_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedMeetingId(meeting.meeting_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedMeetingId(meeting.meeting_id)
                      }
                    }}
                  >
                    <a className="project-card-link" href={`/flow-board?meeting=${meeting.meeting_id}`}>
                      {/* 회의가 자기 프로젝트 이름을 들고 온다. 프로젝트 목록에서
                          찾을 필요가 없다 — 목록에 없는 프로젝트의 회의도 있다. */}
                      <span className="meeting-company">{meeting.project_name}</span>
                      <strong>{meeting.title}</strong>
                      <time>{meeting.displayed_at}</time>
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
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-grid">
            <article className="schedule-panel">
              <div className="section-heading">
                <h2>오늘 일정</h2>
                <a className="section-arrow" href="/" aria-label="오늘 일정 더보기">
                  <img src="/icons/Expandright.svg" alt="" aria-hidden="true" />
                </a>
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
                      ) : (
                        <button
                          type="button"
                          disabled={!schedule.action?.url}
                          onClick={() => window.open(schedule.action.url, '_blank', 'noopener')}
                        >
                          {schedule.action?.label ?? '회의 참여하기'}
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
                <a className="section-arrow" href="/" aria-label="최근 회의 더보기">
                  <img src="/icons/Expandright.svg" alt="" aria-hidden="true" />
                </a>
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
                      <span className="summary-badge">{summary.status}</span>
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

        <div className="chat-dock" role="group" aria-label="Bordo 채팅">
          <div className="chat-tools">
            <button type="button" aria-label="추가">
              <img src={chatIcons.add} alt="" />
            </button>
            <button type="button" aria-label="필터">
              <img src={chatIcons.filter} alt="" />
            </button>
          </div>
          <button className="chat-input" type="button">
            Bordo에게 물어보세요...
          </button>
          <button className="chat-send" type="button" aria-label="전송">
            <img src={chatIcons.send} alt="" />
          </button>
        </div>
      </main>

      {delegateFor ? (
        <DelegateDialog
          schedule={delegateFor}
          onClose={() => setDelegateFor(null)}
          onSaved={applyDelegation}
        />
      ) : null}
    </div>
  )
}
