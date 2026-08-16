import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { getMockHomeData } from './home.mock.js'

const starIcons = {
  active: '/icons/Staractive.svg',
  inactive: '/icons/Starunactive.svg',
}

const chatIcons = {
  add: '/chat-icons/add-round.svg',
  filter: '/chat-icons/filter-alt.svg',
  send: '/chat-icons/send-hor.svg',
}

function formatScheduleTime(value) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date)
}

function getProjectName(projectId, homeData) {
  const projects = [...homeData.project_progress, ...homeData.recent_projects, ...homeData.favorite_projects]
  return projects.find((project) => project.id === projectId)?.name ?? '프로젝트'
}

function updateProjectFavorite(projects, projectId, isFavorite) {
  return projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          is_favorite: isFavorite,
        }
      : project,
  )
}

export function HomePage() {
  const [homeData, setHomeData] = useState(() => getMockHomeData())
  const [recentMeetings, setRecentMeetings] = useState(() => getMockHomeData().recent_meetings)
  const [favoriteMessage, setFavoriteMessage] = useState('')
  const [selectedMeetingId, setSelectedMeetingId] = useState('mtg_88')
  const [selectedScheduleKey, setSelectedScheduleKey] = useState(null)

  useEffect(() => {
    if (!favoriteMessage) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setFavoriteMessage('')
    }, 1800)

    return () => window.clearTimeout(timerId)
  }, [favoriteMessage])

  const setProjectFavoriteState = (projectId, isFavorite) => {
    setHomeData((current) => {
      const projectPool = [
        ...current.project_progress,
        ...current.recent_projects,
        ...current.favorite_projects,
      ]
      const targetProject = projectPool.find((project) => project.id === projectId) ?? {
        id: projectId,
        name: getProjectName(projectId, current),
        progress: 0,
        is_favorite: isFavorite,
      }
      const favoriteProjects = isFavorite
        ? [
            ...current.favorite_projects.filter((project) => project.id !== projectId),
            {
              ...targetProject,
              is_favorite: true,
            },
          ]
        : current.favorite_projects.filter((project) => project.id !== projectId)

      return {
        ...current,
        project_progress: updateProjectFavorite(current.project_progress, projectId, isFavorite),
        recent_projects: updateProjectFavorite(current.recent_projects, projectId, isFavorite),
        favorite_projects: favoriteProjects,
      }
    })
  }

  const toggleFavorite = (event, meetingId) => {
    event.preventDefault()
    event.stopPropagation()
    const selectedMeeting = recentMeetings.find((meeting) => meeting.meeting_id === meetingId)

    if (!selectedMeeting) {
      return
    }

    const nextFavorite = !selectedMeeting.is_favorite

    setRecentMeetings((meetings) =>
      meetings.map((meeting) =>
        meeting.meeting_id === meetingId
          ? {
              ...meeting,
              is_favorite: nextFavorite,
            }
          : meeting,
      ),
    )
    setProjectFavoriteState(selectedMeeting.project_id, nextFavorite)
    setFavoriteMessage(nextFavorite ? '즐겨찾기에 추가했습니다' : '즐겨찾기에서 제거했습니다')
  }

  return (
    <div className="home-layout">
      <Sidebar
        favoriteProjects={homeData.favorite_projects}
        recentProjects={homeData.recent_projects}
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
                안녕하세요, {homeData.user_name}
                <br />
                Bordo에 오신 것을 환영합니다.
              </h1>
              <a
                className={homeData.briefing_pending.exists ? 'ai-brief-button' : 'ai-brief-button disabled'}
                href={
                  homeData.briefing_pending.exists
                    ? `/flow-board?meeting=${homeData.briefing_pending.meeting_id}&source=bordo-briefing`
                    : '/'
                }
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
                    <span className="meeting-company">{getProjectName(meeting.project_id, homeData)}</span>
                    <strong>{meeting.title}</strong>
                    <time>{meeting.displayed_at}</time>
                  </a>
                  <button
                    className={meeting.is_favorite ? 'favorite-mark active' : 'favorite-mark'}
                    type="button"
                    aria-label={meeting.is_favorite ? '즐겨찾기에서 제거' : '즐겨찾기에 추가'}
                    onClick={(event) => toggleFavorite(event, meeting.meeting_id)}
                  >
                    <img src={meeting.is_favorite ? starIcons.active : starIcons.inactive} alt="" />
                  </button>
                </article>
              ))}
            </div>
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
                {homeData.today_schedule.map((schedule) => {
                  const scheduleKey = `${schedule.at}-${schedule.project_id}`

                  return (
                    <div className="schedule-item" key={scheduleKey}>
                      <button
                        className={selectedScheduleKey === scheduleKey ? 'schedule-info selected' : 'schedule-info'}
                        type="button"
                        onClick={() => setSelectedScheduleKey(scheduleKey)}
                      >
                        <time>{schedule.time_range ?? formatScheduleTime(schedule.at)}</time>
                        <div>
                          <strong>{schedule.title}</strong>
                          <span>
                            {schedule.project_name} · {schedule.location}
                          </span>
                        </div>
                      </button>
                      <button type="button">회의 참여하기</button>
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
              <div className="summary-content">
                <div className="summary-topline">
                  <div className="summary-title-stack">
                    <span>{homeData.recent_meeting_summary.project_name}</span>
                    <h3>{homeData.recent_meeting_summary.title}</h3>
                  </div>
                  <div className="summary-state">
                    <time>{homeData.recent_meeting_summary.displayed_at}</time>
                    <span className="summary-badge">{homeData.recent_meeting_summary.status}</span>
                  </div>
                </div>

                <hr className="summary-divider" />

                <div className="summary-block">
                  <strong>주요 결정</strong>
                  <ul>
                    {homeData.recent_meeting_summary.main_decisions.map((decision) => (
                      <li key={decision}>{decision}</li>
                    ))}
                  </ul>
                </div>

                <div className="summary-block zero-summary">
                  <strong>Zero 요약</strong>
                  <p>“{homeData.recent_meeting_summary.zero_summary}”</p>
                </div>
              </div>
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
    </div>
  )
}
