import { useEffect, useMemo, useRef, useState } from 'react'

import { createMeeting, fetchTeamMembers, fetchTeamProjects, fetchTeams } from './home.api.js'
import { NumberBox, TextBox, TimeBox } from './newProjectBits.jsx'
import { useEscapeToClose } from './useEscapeToClose.js'
import './newProject.css'

/**
 * 회의 일정 추가(시안 `692:8292`).
 *
 * ## 팀 → 프로젝트, 두 단계로 고른다
 *
 * 회의는 프로젝트 밑에 생긴다(`POST /projects/{project_id}/meetings`).
 * 참여자 후보도 팀원이라, `NewProjectDialog` 와 같은 순서다 — 팀 없이
 * 프로젝트를, 프로젝트 없이 참여자·일정을 건드리면 경고만 띄운다.
 *
 * ## "가능한 시간을 모두" 는 후보 목록이 아니다
 *
 * 서버는 고정 시각 하나만 받는다. 시안의 문구를 그 날짜의 **시작~끝 범위**로
 * 읽어 `duration_min` 을 계산한다 — 여러 후보를 모아 투표하는 기능은
 * 백엔드에 없다.
 */
export function NewMeetingDialog({ onClose, onCreated }) {
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

  /*
    프로젝트·참여자 후보는 고른 팀의 것이다. 팀을 바꾸면 아래 것을 전부
    버린다 — `NewProjectDialog` 와 같은 이유로, 다른 팀 프로젝트에 회의를
    묶으려 하면 서버가 막는다.
  */
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
    setTeamId(id)
    setTeamOpen(false)
    setTeamWarn(false)
    setError('')
    setProjectId('')
    setProjects([])
    setProjectOpen(true)
    setCandidates([])
    setMembers([])
  }

  const pickProject = (id) => {
    setProjectId(id)
    setProjectOpen(false)
    setProjectWarn(false)
    setError('')
  }

  const addMember = () => {
    if (needsProject()) {
      return
    }
    const needle = memberQuery.trim().toLowerCase()
    if (!needle) {
      return
    }
    const found = candidates.find((person) => (person.name || '').toLowerCase().includes(needle)
      && !members.some((picked) => picked.user_id === person.user_id))
    if (!found) {
      setError('그 이름의 팀원을 찾지 못했습니다.')
      return
    }
    setMembers((current) => [...current, found])
    setMemberQuery('')
    setError('')
  }

  /** 년·월·일·시각 넷이 다 있어야 유효한 시각이다. 하나라도 비면 `null`. */
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
      setError('회의 제목을 입력해 주십시오.')
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
      const meeting = await createMeeting(projectId, {
        title: title.trim(),
        scheduledAt: startAt.toISOString(),
        durationMin: Math.round((endAt.getTime() - startAt.getTime()) / 60000),
        participantIds: members.map((person) => person.user_id),
      })
      onCreated(meeting)
      onClose()
    } catch (err) {
      setError(err?.message || '회의 일정을 만들지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <div
      className="np-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="np-dialog" role="dialog" aria-modal="true" aria-labelledby="new-meeting-title">
        <h2 className="np-title" id="new-meeting-title">회의 일정 추가</h2>
        <p className="np-lead">회의 정보를 입력하고 팀원들과 일정을 조율해보세요.</p>

        <div className="np-body">
          <div className="np-fields">
            <span className="np-label">회의 정보</span>

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
              <span className="np-label">회의 제목</span>
              <TextBox
                value={title}
                inputRef={titleRef}
                onChange={(next) => { if (!needsProject()) setTitle(next) }}
                onSubmit={() => memberRef.current?.focus()}
                placeholder="회의 제목을 입력해주세요."
                ariaLabel="회의 제목"
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
                placeholder="원하는 참여자를 검색한 후 Enter를 누르면 등록돼요."
                ariaLabel="참여자 검색"
              />
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
              <p className="np-note">가능한 시간을 모두 입력해주세요.</p>
            </div>

            {error ? <p className="np-error" role="alert">{error}</p> : null}
          </div>

          <div className="np-actions">
            <button className="np-cancel" type="button" disabled={busy} onClick={onClose}>취소</button>
            <button className="np-submit" type="button" disabled={busy} onClick={save}>
              {busy ? '요청하는 중…' : '일정 조율 요청하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
