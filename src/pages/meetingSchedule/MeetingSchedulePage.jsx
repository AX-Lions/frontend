import { useEffect, useMemo, useState } from 'react'

import { getCurrentTeamId, onCurrentTeamChange } from '../../lib/currentTeam.js'
import { useResource } from '../../lib/useResource.js'
import { Loading, LoadError } from '../../shared/components/LoadState.jsx'
import { ConfirmedScheduleDialog } from '../home/ConfirmedScheduleDialog.jsx'
import { NewProjectDialog } from '../home/NewProjectDialog.jsx'
import { Sidebar } from '../home/Sidebar.jsx'
import { fetchHome, fetchTeamMembers } from '../home/home.api.js'
// `Sidebar` 는 자기 스타일을 안 갖고 다닌다(`.sidebar` · `.home-layout` 이
// 전부 `home.css` 에 있다) — 홈 화면이 부르는 대로 여기서도 함께 가져온다.
import '../home/home.css'
import { fetchCalendarEvents } from './meetingSchedule.data.js'
import { NewCalendarEventDialog } from './NewCalendarEventDialog.jsx'
import './meetingSchedule.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const pad2 = (n) => String(n).padStart(2, '0')
const ymd = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
const monthLabel = (date) => `${date.getFullYear()}년 ${date.getMonth() + 1}월`
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
const addMonths = (date, delta) => new Date(date.getFullYear(), date.getMonth() + delta, 1)
const hhmm = (iso) => {
  const at = new Date(iso)
  return `${pad2(at.getHours())}:${pad2(at.getMinutes())}`
}
const isToday = (date, day) => {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && day === now.getDate()
}

/**
 * 회의 일정(시안 `692:7910`).
 *
 * 홈 사이드바가 여는 「회의 일정 보기」의 목적지다 — 팀장이 회의 아이콘을
 * 눌렀을 때 뜨는 드롭다운(`Sidebar.jsx`)에서 온다. 사이드바는 그 화면
 * 것을 그대로 다시 쓴다 — 시안이 로고 밑 아이콘 줄까지 같은 모양이고,
 * 화면마다 따로 두면 프로젝트 목록·바로가기가 둘로 갈린다.
 *
 * ## 한 화면에 여러 프로젝트를 모은다
 *
 * `GET /projects/{id}/calendar/events` 는 프로젝트 하나만 준다 — 팀·계정을
 * 가로지르는 자리가 명세에 없다. 그래서 보이는 달의 프로젝트마다 한 번씩
 * 불러 합친다. 「팀 전환하기」로 고른 팀이 있으면 그 팀 프로젝트만, 없으면
 * (전체 보기) 홈이 이미 아는 프로젝트 전부를 부른다.
 */
export function MeetingSchedulePage() {
  const home = useResource((signal) => fetchHome(signal), [], { cacheKey: 'home' })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [currentTeamId, setCurrentTeamIdState] = useState(getCurrentTeamId)
  useEffect(() => onCurrentTeamChange(setCurrentTeamIdState), [])

  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()))
  const [eventsByProject, setEventsByProject] = useState({})
  const [addingProject, setAddingProject] = useState(false)
  const [addingEvent, setAddingEvent] = useState(false)
  /*
    달력의 일정 한 칸을 눌렀을 때 뜨는 「확정된 일정 확인」 팝업(시안
    `697:9393`)이 보여 줄 일정.

    예전에는 누르면 곧장 플로우 화면으로 넘어갔다 — 그것도 `related_meeting`
    이 있을 때만이고, 서버가 주는 값은 거의 전부 `null` 이라 **실제로는 눌러도
    아무 일도 일어나지 않았다.** 홈 「오늘 일정」은 같은 클릭에 이 팝업을
    띄우는데 달력만 달랐다. 확인은 팝업이 하고, 이동은 팝업 안의 `회의 보기`
    가 한다.
  */
  const [confirming, setConfirming] = useState(null)

  /*
    참여자 id → 이름.

    달력 한 칸(`CalendarEvent`)은 `participant_ids` 만 준다. 팝업은 이름을
    보여 줘야 하는데, 회의가 안 걸린 일정은 이름을 물어볼 회의도 없다. 팀
    구성원 목록이 그 답을 갖고 있으므로 보이는 프로젝트들의 팀만 한 번씩
    읽어 표를 만든다.
  */
  const [nameById, setNameById] = useState({})

  const homeData = home.data

  const inCurrentTeam = (project) => !currentTeamId || project.team_id === currentTeamId
  /*
    `project_progress` 가 소속 프로젝트 전부다 — `recent_projects` ·
    `favorite_projects` 는 그 부분집합이라 여기 쓰면 한 번도 안 연 프로젝트의
    일정을 놓친다.

    `useMemo` 로 참조를 고정한다. 안 하면 매 렌더 새 배열이 되어 아래 달력
    조회 effect 가 `setEventsByProject` 뒤에도 계속 다시 돈다 — 목록 내용은
    같은데 참조만 달라 무한히 같은 요청을 반복하게 된다.
  */
  const projects = useMemo(
    () => (homeData?.project_progress ?? []).filter(
      (project) => !currentTeamId || project.team_id === currentTeamId,
    ),
    [homeData, currentTeamId],
  )

  const from = ymd(visibleMonth)
  const to = ymd(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), daysInMonth(visibleMonth)))

  useEffect(() => {
    let alive = true
    projects.forEach((project) => {
      fetchCalendarEvents(project.id, { from, to })
        .then((body) => {
          if (alive) {
            setEventsByProject((current) => ({ ...current, [project.id]: body?.results ?? [] }))
          }
        })
        .catch(() => {
          if (alive) {
            setEventsByProject((current) => ({ ...current, [project.id]: [] }))
          }
        })
    })
    return () => { alive = false }
  }, [projects, from, to])

  const teamIds = useMemo(
    () => [...new Set(projects.map((project) => project.team_id).filter(Boolean))],
    [projects],
  )

  useEffect(() => {
    let alive = true
    teamIds.forEach((teamId) => {
      fetchTeamMembers(teamId)
        .then((body) => {
          if (!alive) {
            return
          }
          // `GET /teams/{id}/members` 는 `{ count, results }` 로 감싸 준다.
          const members = Array.isArray(body) ? body : (body?.results ?? [])
          setNameById((current) => {
            const next = { ...current }
            members.forEach((member) => {
              // 팀마다 응답 모양이 조금씩 다르다(`user_id` 또는 `id`).
              const id = member.user_id ?? member.id
              if (id && member.name) {
                next[id] = member.name
              }
            })
            return next
          })
        })
        // 이름을 못 읽어도 팝업은 떠야 한다. 참여자 줄만 비운다.
        .catch(() => {})
    })
    return () => { alive = false }
  }, [teamIds])

  const monthEvents = useMemo(() => {
    const list = []
    projects.forEach((project) => {
      (eventsByProject[project.id] ?? []).forEach((row) => {
        list.push({ ...row, project_name: project.name, team_name: project.team_name })
      })
    })
    return list
  }, [projects, eventsByProject])

  const eventsByDay = useMemo(() => {
    const map = {}
    monthEvents.forEach((row) => {
      const day = Number(row.start_at.slice(8, 10))
      ;(map[day] ??= []).push(row)
    })
    Object.values(map).forEach((rows) => rows.sort((a, b) => a.start_at.localeCompare(b.start_at)))
    return map
  }, [monthEvents])

  /*
    「새로 확정된 일정」은 시안 문구 그대로다 — 서버가 확정 시각을 안 주므로
    (`CalendarEvent` 에 `confirmed_at` 이 없다) **이번 달에 확정 상태인 일정
    수**로 대신한다. `언제 확정됐는지` 는 백엔드가 그 값을 내려줘야 정확해진다.
  */
  const confirmedCount = monthEvents.filter((row) => row.status === 'CONFIRMED').length

  const firstWeekday = visibleMonth.getDay()
  const totalDays = daysInMonth(visibleMonth)
  const cells = Array.from({ length: 42 }, (_, index) => index - firstWeekday + 1)

  /** `8월 18일 14:00 ~ 15:00` — 시안 `697:9393` 의 둘째 줄. */
  const whenLabel = (row) => {
    const at = new Date(row.start_at)
    const day = `${at.getMonth() + 1}월 ${at.getDate()}일`
    return `${day} ${hhmm(row.start_at)} ~ ${hhmm(row.end_at ?? row.start_at)}`
  }

  const openEvent = (row) => {
    setConfirming({
      meetingId: row.related_meeting ?? null,
      schedule: {
        title: row.title,
        teamName: row.team_name,
        projectName: row.project_name,
        when: whenLabel(row),
        participantNames: (row.participant_ids ?? [])
          .map((id) => nameById[id])
          .filter(Boolean),
      },
    })
  }

  if (home.loading && !homeData) {
    return (
      <div className="home-layout">
        <Sidebar favoriteProjects={[]} recentProjects={[]} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)} />
        <main className="msched-main"><Loading label="회의 일정을 불러오는 중입니다…" /></main>
      </div>
    )
  }

  if (home.error && !homeData) {
    return (
      <div className="home-layout">
        <Sidebar favoriteProjects={[]} recentProjects={[]} isCollapsed={isSidebarCollapsed} onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)} />
        <main className="msched-main"><LoadError error={home.error} onRetry={home.reload} /></main>
      </div>
    )
  }

  return (
    <div className="home-layout">
      <Sidebar
        active="meeting"
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((c) => !c)}
        favoriteProjects={(homeData.favorite_projects ?? []).filter(inCurrentTeam)}
        recentProjects={(homeData.recent_projects ?? []).filter(inCurrentTeam)}
        shortcuts={homeData.shortcuts}
        userName={homeData.user_name}
        avatarUrl={homeData.user_avatar_url}
        onAddProject={() => setAddingProject(true)}
      />

      <main className="msched-main">
        <div className="msched-head">
          <h1>회의 일정</h1>
          <button type="button" className="msched-add" onClick={() => setAddingEvent(true)}>
            일정 추가하기
          </button>
        </div>

        <div className="msched-toolbar">
          <div className="msched-month-nav">
            <button
              type="button"
              className="msched-chevron is-prev"
              aria-label="이전 달"
              data-tip="이전 달"
              onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
            >
              <img src="/icons/Expandright.svg" alt="" />
            </button>
            <strong>{monthLabel(visibleMonth)}</strong>
            <button
              type="button"
              className="msched-chevron"
              aria-label="다음 달"
              data-tip="다음 달"
              onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
            >
              <img src="/icons/Expandright.svg" alt="" />
            </button>
          </div>

          <div className="msched-confirmed">
            <span className="msched-dot" aria-hidden="true" />
            <span>새로 확정된 일정</span>
            <span>{confirmedCount}</span>
          </div>
        </div>

        <div className="msched-calendar">
          <div className="msched-weekdays">
            {WEEKDAYS.map((label) => (
              <div className="msched-weekday" key={label}>{label}</div>
            ))}
          </div>

          <div className="msched-grid">
            {cells.map((day, index) => {
              const inMonth = day >= 1 && day <= totalDays
              const rows = inMonth ? (eventsByDay[day] ?? []) : []

              return (
                <div
                  className={inMonth ? 'msched-cell' : 'msched-cell is-outside'}
                  key={index}
                >
                  {inMonth ? (
                    <>
                      <span className={isToday(visibleMonth, day) ? 'msched-day is-today' : 'msched-day'}>
                        {day}
                      </span>
                      {rows.map((row) => (
                        <button
                          type="button"
                          className={row.status === 'CONFIRMED' ? 'msched-event is-confirmed' : 'msched-event'}
                          key={row.id}
                          onClick={() => openEvent(row)}
                        >
                          <strong>{row.team_name ?? row.project_name}</strong>
                          <span>
                            <em>{hhmm(row.start_at)}</em>
                            {row.title}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {addingProject ? (
        <NewProjectDialog
          onClose={() => setAddingProject(false)}
          onCreated={(project) => home.setData((current) => (current ? {
            ...current,
            recent_projects: [project, ...(current.recent_projects ?? [])],
            project_progress: [project, ...(current.project_progress ?? [])],
          } : current))}
        />
      ) : null}

      {confirming ? (
        <ConfirmedScheduleDialog
          meetingId={confirming.meetingId}
          schedule={confirming.schedule}
          onClose={() => setConfirming(null)}
        />
      ) : null}

      {addingEvent ? (
        <NewCalendarEventDialog
          onClose={() => setAddingEvent(false)}
          // 만든 프로젝트의 일정 목록을 다시 읽는다. 어느 프로젝트인지는
          // 응답의 `project_id` 로 안다 — 새로 고른 팀·프로젝트일 수도 있어
          // 화면 전체를 다시 읽는 것보다 그 한 칸만 바꾸는 편이 낫다.
          onCreated={(created) => setEventsByProject((current) => ({
            ...current,
            [created.project_id]: [...(current[created.project_id] ?? []), created],
          }))}
        />
      ) : null}
    </div>
  )
}
