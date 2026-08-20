import { useEffect, useMemo, useRef, useState } from 'react'

import { me as fetchMe } from '../../lib/api.js'
import { fetchTeamMembers, fetchTeamProjects, fetchTeams } from '../home/home.api.js'
import { NumberBox, TextBox, TimeBox } from '../home/newProjectBits.jsx'
import '../home/newProject.css'
import { useEscapeToClose } from '../../shared/hooks/useEscapeToClose.js'
import { createCalendarEvent } from './meetingSchedule.data.js'

/**
 * 일정 추가하기(시안 `692:7924`의 `일정 추가하기` 단추).
 *
 * `회의 일정 추가 팝업`(`NewMeetingDialog`)과 팀 → 프로젝트를 고르는 순서가
 * 같다 — 일정도 프로젝트 밑에 생긴다(`POST /projects/{id}/calendar/events`).
 * 다른 점은 끝나는 시각을 `duration_min` 이 아니라 `end_at` 그대로 보낸다는
 * 것뿐이다 — 회의와 달리 캘린더 일정은 계약이 시작·끝 시각을 각각 받는다.
 */
export function NewCalendarEventDialog({ onClose, onCreated }) {
  const [teams, setTeams] = useState(null)
  const [teamId, setTeamId] = useState('')
  const [teamOpen, setTeamOpen] = useState(true)
  const [teamQuery, setTeamQuery] = useState('')
  const [teamWarn, setTeamWarn] = useState(false)

  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [projectOpen, setProjectOpen] = useState(true)
  const [projectQuery, setProjectQuery] = useState('')
  const [projectWarn, setProjectWarn] = useState(false)

  const [title, setTitle] = useState('')

  const [candidates, setCandidates] = useState([])
  /*
    만든 사람은 서버가 참여자로 넣어 준다(`apps/calendars/views.py`). 후보 목록에
    나까지 두면 이미 들어가 있는 사람을 다시 고르는 칸이 되고, 고르지 않으면
    빠지는 줄 알고 매번 나를 먼저 누르게 된다.
  */
  const [myId, setMyId] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState([])

  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const titleRef = useRef(null)
  const memberRef = useRef(null)

  useEscapeToClose(onClose)

  useEffect(() => {
    let alive = true
    fetchMe()
      .then((body) => { if (alive) setMyId(body?.id || '') })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    fetchTeams(controller.signal)
      .then((body) => {
        if (!alive) {
          return
        }
        const rows = body?.results ?? []
        setTeams(rows)
        if (rows.length === 1) {
          setTeamId(rows[0].id)
          setTeamOpen(false)
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setTeams([])
          setError(err?.message || '팀 목록을 불러오지 못했습니다.')
        }
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (!teamId) {
      return undefined
    }
    const controller = new AbortController()
    let alive = true

    fetchTeamProjects(teamId, controller.signal)
      .then((body) => {
        if (alive) {
          setProjects(body?.results ?? [])
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setProjects([])
        }
      })

    fetchTeamMembers(teamId, controller.signal)
      .then((body) => {
        if (alive) {
          setCandidates(body?.results ?? [])
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setCandidates([])
        }
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [teamId])

  const teamName = teams?.find((team) => team.id === teamId)?.name ?? ''
  const shownTeams = useMemo(() => {
    const needle = teamQuery.trim().toLowerCase()
    return (teams ?? []).filter((team) => (!needle || (team.name || '').toLowerCase().includes(needle)))
  }, [teams, teamQuery])

  const projectName = projects.find((project) => project.id === projectId)?.name ?? ''
  const shownProjects = useMemo(() => {
    const needle = projectQuery.trim().toLowerCase()
    return projects.filter((project) => (!needle || (project.name || '').toLowerCase().includes(needle)))
  }, [projects, projectQuery])

  const needsTeam = () => {
    if (teamId) {
      return false
    }
    setTeamWarn(true)
    setTeamOpen(true)
    return true
  }

  const needsProject = () => {
    if (needsTeam()) {
      return true
    }
    if (projectId) {
      return false
    }
    setProjectWarn(true)
    setProjectOpen(true)
    return true
  }

  const pickTeam = (id) => {
    setTeamOpen(false)
    setTeamWarn(false)
    setError('')
    setProjectOpen(true)

    /*
      같은 팀을 다시 고른 것이면 **아무것도 비우지 않는다.**

      아래에서 목록을 비우고 다시 채우는 것은 `useEffect([teamId])` 인데, 값이
      그대로면 그 effect 가 안 돈다. 팀이 하나뿐인 사용자는 팝업이 열릴 때
      자동으로 그 팀이 골라져 있어서, 팀 칸을 눌러 같은 팀을 고르는 순간
      프로젝트 목록만 비워진 채 다시 채워지지 않았다 —
      화면에는 `이 팀에는 프로젝트가 없습니다` 가 뜨고, 팝업을 닫았다 열기
      전까지 회의를 만들 수가 없다.
    */
    if (id === teamId) {
      return
    }

    setTeamId(id)
    setProjectId('')
    setProjects([])
    setCandidates([])
    setMembers([])
  }

  const pickProject = (id) => {
    setProjectId(id)
    setProjectOpen(false)
    setProjectWarn(false)
    setError('')
  }

  /*
    아직 안 고른 팀원. **검색어가 없어도 전부 보여 준다.**

    입력 칸만 있고 목록이 없으면 "누가 있는지 모르는 채 이름을 적으라" 는 화면이
    된다 — 팀에 누가 있는지는 서버가 이미 내려주고 있는데(`fetchTeamMembers`)
    화면이 감춰 두고 있었을 뿐이다. 이름을 정확히 기억하지 못하면 회의를 만들 수
    없고, 오타 하나에 `그 이름의 팀원을 찾지 못했습니다` 만 돌아온다.
  */
  const memberMatches = useMemo(() => {
    const needle = memberQuery.trim().toLowerCase()
    return candidates
      .filter((person) => person.user_id !== myId)
      .filter((person) => !members.some((picked) => picked.user_id === person.user_id))
      .filter((person) => !needle || (person.name || '').toLowerCase().includes(needle))
  }, [candidates, members, memberQuery, myId])

  const pickMember = (person) => {
    setMembers((current) => (current.some((picked) => picked.user_id === person.user_id)
      ? current
      : [...current, person]))
    setMemberQuery('')
    setError('')
  }

  const addMember = () => {
    if (needsProject()) {
      return
    }
    // Enter 는 **목록의 첫 줄**을 고른다. 검색어가 비어 있으면 남은 첫 사람이라
    // 세 명짜리 팀에서는 Enter 세 번으로 끝난다.
    const found = memberMatches[0]
    if (!found) {
      setError(memberQuery.trim()
        ? '그 이름의 팀원을 찾지 못했습니다.'
        : '더 넣을 팀원이 없습니다.')
      return
    }
    pickMember(found)
  }

  const at = (time) => {
    if (!year || !month || !day || !time) {
      return null
    }
    const [hour, minute] = time.split(':')
    const value = new Date(Number(year), Number(month) - 1, Number(day), Number(hour) || 0, Number(minute) || 0)
    return Number.isNaN(value.getTime()) ? null : value
  }
  const startAt = at(startTime)
  const endAt = at(endTime)

  const save = async () => {
    if (needsProject()) {
      return
    }
    if (!title.trim()) {
      setError('일정 제목을 입력해 주십시오.')
      titleRef.current?.focus()
      return
    }
    if (!startAt || !endAt) {
      setError('날짜와 시간을 모두 입력해 주십시오.')
      return
    }
    if (endAt <= startAt) {
      setError('끝나는 시각이 시작 시각보다 앞섭니다.')
      return
    }
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const created = await createCalendarEvent(projectId, {
        title: title.trim(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        participantIds: members.map((person) => person.user_id),
      })
      onCreated(created)
      onClose()
    } catch (err) {
      setError(err?.message || '일정을 만들지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <div
      className="np-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="np-dialog" role="dialog" aria-modal="true" aria-labelledby="new-event-title">
        <h2 className="np-title" id="new-event-title">일정 추가하기</h2>
        <p className="np-lead">일정 정보를 입력하고 팀원들과 공유해보세요.</p>

        <div className="np-body">
          <div className="np-fields">
            <span className="np-label">일정 정보</span>

            <div className="np-row">
              <div className="np-team">
                <button
                  className={teamOpen ? 'np-team-head is-open' : 'np-team-head'}
                  type="button"
                  aria-expanded={teamOpen}
                  onClick={() => setTeamOpen((open) => !open)}
                >
                  <span className="np-team-head-label">
                    {teamName || '팀 선택'}
                    {teamWarn && !teamId ? (
                      <span className="np-warn">* 팀을 먼저 선택해주세요.</span>
                    ) : null}
                  </span>
                  <img src="/icons/ExpandDown.svg" alt="" />
                </button>

                {teamOpen ? (
                  <div className="np-team-panel">
                    <label className="np-search">
                      <img src="/icons/Search.svg" alt="" aria-hidden="true" />
                      <input
                        type="search"
                        value={teamQuery}
                        aria-label="팀 검색"
                        placeholder="검색어를 입력하세요..."
                        onChange={(event) => setTeamQuery(event.target.value)}
                      />
                    </label>
                    <div className="np-list">
                      {teams === null ? (
                        <p className="np-list-empty">팀 목록을 불러오는 중입니다…</p>
                      ) : shownTeams.length === 0 ? (
                        <p className="np-list-empty">
                          {teamQuery.trim() ? '찾는 팀이 없습니다.' : '속한 팀이 없습니다.'}
                        </p>
                      ) : shownTeams.map((team) => (
                        <button
                          className="np-list-item"
                          type="button"
                          key={team.id}
                          aria-pressed={team.id === teamId}
                          onClick={() => pickTeam(team.id)}
                        >
                          <span>{team.name}</span>
                          {team.id === teamId ? <img src="/icons/CheckMark.svg" alt="선택됨" /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="np-team">
                <button
                  className={projectOpen ? 'np-team-head is-open' : 'np-team-head'}
                  type="button"
                  aria-expanded={projectOpen}
                  onClick={() => { if (!needsTeam()) setProjectOpen((open) => !open) }}
                >
                  <span className="np-team-head-label">
                    {projectName || '프로젝트 선택'}
                    {projectWarn && !projectId ? (
                      <span className="np-warn">* 프로젝트를 먼저 선택해주세요.</span>
                    ) : null}
                  </span>
                  <img src="/icons/ExpandDown.svg" alt="" />
                </button>

                {projectOpen && teamId ? (
                  <div className="np-team-panel">
                    <label className="np-search">
                      <img src="/icons/Search.svg" alt="" aria-hidden="true" />
                      <input
                        type="search"
                        value={projectQuery}
                        aria-label="프로젝트 검색"
                        placeholder="검색어를 입력하세요..."
                        onChange={(event) => setProjectQuery(event.target.value)}
                      />
                    </label>
                    <div className="np-list">
                      {shownProjects.length === 0 ? (
                        <p className="np-list-empty">
                          {projectQuery.trim() ? '찾는 프로젝트가 없습니다.' : '이 팀에는 프로젝트가 없습니다.'}
                        </p>
                      ) : shownProjects.map((project) => (
                        <button
                          className="np-list-item"
                          type="button"
                          key={project.id}
                          aria-pressed={project.id === projectId}
                          onClick={() => pickProject(project.id)}
                        >
                          <span>{project.name}</span>
                          {project.id === projectId ? <img src="/icons/CheckMark.svg" alt="선택됨" /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="np-field">
              <span className="np-label">일정 제목</span>
              <TextBox
                value={title}
                inputRef={titleRef}
                onChange={(next) => { if (!needsProject()) setTitle(next) }}
                onSubmit={() => memberRef.current?.focus()}
                placeholder="일정 제목을 입력해주세요."
                ariaLabel="일정 제목"
                maxLength={120}
              />
            </div>

            <div className="np-field">
              <span className="np-label">참여자 선택</span>
              <TextBox
                value={memberQuery}
                inputRef={memberRef}
                onChange={setMemberQuery}
                onSubmit={addMember}
                placeholder="이름을 누르거나, 검색 후 Enter 를 누르면 등록돼요."
                ariaLabel="참여자 검색"
              />
              {teamId && memberMatches.length > 0 ? (
                <div className="np-list np-member-list">
                  {memberMatches.map((person) => (
                    <button
                      className="np-list-item"
                      type="button"
                      key={person.user_id}
                      onClick={() => { if (!needsProject()) pickMember(person) }}
                    >
                      <span>{person.name}</span>
                      {person.role && person.role !== 'MEMBER'
                        ? <span className="np-member-role">{person.role}</span>
                        : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {members.length > 0 ? (
                <div className="np-chips">
                  {members.map((person) => (
                    <span className="np-chip" key={person.user_id}>
                      {person.name}
                      <button
                        type="button"
                        aria-label={`${person.name} 빼기`}
                        onClick={() => setMembers((current) => current
                          .filter((picked) => picked.user_id !== person.user_id))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="np-field">
              <span className="np-label">일정</span>
              <div className="np-period">
                <NumberBox
                  value={year}
                  onChange={(next) => { if (!needsProject()) setYear(next) }}
                  unit="년"
                  width="np-year"
                  maxLength={4}
                  placeholder="2026"
                  ariaLabel="날짜 연도"
                />
                <NumberBox
                  value={month}
                  onChange={(next) => { if (!needsProject()) setMonth(next) }}
                  unit="월"
                  width="np-small"
                  ariaLabel="날짜 월"
                />
                <NumberBox
                  value={day}
                  onChange={(next) => { if (!needsProject()) setDay(next) }}
                  unit="일"
                  width="np-small"
                  ariaLabel="날짜 일"
                />

                <TimeBox
                  value={startTime}
                  onChange={(next) => { if (!needsProject()) setStartTime(next) }}
                  ariaLabel="시작 시각"
                />
                <span className="np-tilde" aria-hidden="true">~</span>
                <TimeBox
                  value={endTime}
                  onChange={(next) => { if (!needsProject()) setEndTime(next) }}
                  ariaLabel="종료 시각"
                />
              </div>
            </div>

            {error ? <p className="np-error" role="alert">{error}</p> : null}
          </div>

          <div className="np-actions">
            <button className="np-cancel" type="button" disabled={busy} onClick={onClose}>취소</button>
            <button className="np-submit" type="button" disabled={busy} onClick={save}>
              {busy ? '만드는 중…' : '일정 추가하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
