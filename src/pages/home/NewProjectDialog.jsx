import { useEffect, useMemo, useRef, useState } from 'react'

import { createProject, fetchTeamMembers, fetchTeams } from './home.api.js'
import { NewTeamDialog } from './NewTeamDialog.jsx'
import { NumberBox, TextBox, TimeBox } from './newProjectBits.jsx'
import { useEscapeToClose } from '../../shared/hooks/useEscapeToClose.js'
import './newProject.css'

/**
 * 사이드바 `프로젝트` 옆 `+` 팝업 (Figma `707:5617` · `707:5739`).
 *
 * ## 두 단계인 이유
 *
 * 시안이 그렇게 갈라 놨다. 1단계는 **어디에 · 무엇을 · 언제까지 · 누구와**,
 * 2단계는 **왜**(목표·설명)다. 앞의 넷이 없으면 프로젝트가 성립하지 않고,
 * 뒤의 둘은 나중에 고치는 값이라 한 판에 몰아 넣으면 첫 화면이 길어진다.
 *
 * ## 팀을 먼저 고르게 하는 이유
 *
 * 프로젝트는 팀 밑에만 생긴다(`POST /teams/{team_id}/projects`). 참여자
 * 후보도 그 팀의 팀원이라, 팀이 정해지기 전에는 아래 칸들이 가리키는 대상이
 * 없다. 그래서 팀 없이 다른 칸을 건드리면 시안대로 경고를 띄운다.
 *
 * ## 팀 목록을 팝업에서 읽는다
 *
 * `GET /home` 에는 **프로젝트가 있는 팀**만 실려 온다. 이 버튼을 누르는 가장
 * 흔한 상황이 "새로 만든 팀에 첫 프로젝트" 라, 홈 응답만 보면 정작 필요한
 * 팀이 목록에 없다.
 */

const STEP_BASICS = 1
const STEP_ABOUT = 2

/**
 * 시안의 `2026년 [ ]월 [ ]일 00:00`.
 *
 * 셋 다 비어 있으면 **기간을 안 정한 것**이고, 하나라도 차 있으면 끝까지
 * 받아야 한다. 반만 채워 보내면 서버는 시작만 있고 끝이 없는 기간을 받는다.
 */
function toIso(year, month, day, time) {
  if (!year || !month || !day) {
    return null
  }
  const [hour, minute] = (time || '00:00').split(':')
  const at = new Date(Number(year), Number(month) - 1, Number(day), Number(hour) || 0, Number(minute) || 0)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

export function NewProjectDialog({ onClose, onCreated }) {
  const [step, setStep] = useState(STEP_BASICS)
  const [makingTeam, setMakingTeam] = useState(false)

  const [teams, setTeams] = useState(null)
  const [teamId, setTeamId] = useState('')
  const [teamOpen, setTeamOpen] = useState(true)
  const [teamQuery, setTeamQuery] = useState('')
  const [teamWarn, setTeamWarn] = useState(false)

  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [start, setStart] = useState({ month: '', day: '', time: '' })
  const [end, setEnd] = useState({ month: '', day: '', time: '' })

  const [candidates, setCandidates] = useState([])
  const [memberQuery, setMemberQuery] = useState('')
  const [members, setMembers] = useState([])

  const [goal, setGoal] = useState('')
  const [description, setDescription] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const nameRef = useRef(null)
  const memberRef = useRef(null)
  const descriptionRef = useRef(null)

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
        // 팀이 하나뿐이면 고를 것이 없다. 미리 골라 두고 목록을 접는다.
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
    참여자 후보는 **고른 팀의 팀원**이다.

    팀을 바꾸면 후보도 골라 둔 사람도 버려야 한다 — 다른 팀 사람을 실어
    보내면 서버가 409 로 막는다(`팀 멤버만 넣을 수 있습니다`). 그 비우는
    일은 팀을 고르는 자리(`pickTeam`)에서 한다. 여기(효과)에서 하면 렌더가
    한 번 더 돌고, 팀이 없을 때도 매번 빈 배열을 새로 넣게 된다.
  */
  useEffect(() => {
    if (!teamId) {
      return undefined
    }

    const controller = new AbortController()
    let alive = true

    fetchTeamMembers(teamId, controller.signal)
      .then((body) => {
        if (alive) {
          setCandidates(body?.results ?? [])
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          // 후보를 못 읽어도 프로젝트는 만들 수 있다. 참여자를 안 실으면
          // 팀 전원이 들어간다(서버 기본값).
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

  /** 팀 없이 아래 칸을 건드렸을 때. 시안 `707:5957` 의 빨간 한 줄이 이것이다. */
  const needsTeam = () => {
    if (teamId) {
      return false
    }
    setTeamWarn(true)
    setTeamOpen(true)
    return true
  }

  const pickTeam = (id) => {
    setTeamId(id)
    setTeamOpen(false)
    setTeamWarn(false)
    setError('')
    // 이전 팀에서 고른 사람과 후보를 버린다. 위 효과가 새 팀의 팀원을 다시
    // 읽어 채운다.
    setCandidates([])
    setMembers([])
  }

  const addMember = () => {
    if (needsTeam()) {
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

  const periodTouched = Boolean(year || start.month || start.day || start.time
    || end.month || end.day || end.time)
  const startedAt = toIso(year, start.month, start.day, start.time)
  const endedAt = toIso(year, end.month, end.day, end.time)

  const periodProblem = () => {
    if (!periodTouched) {
      return ''
    }
    if (!startedAt || !endedAt) {
      return '진행기간은 연 · 월 · 일을 양쪽 다 채우거나, 비워 두십시오.'
    }
    if (new Date(endedAt) < new Date(startedAt)) {
      return '끝나는 날이 시작하는 날보다 앞섭니다.'
    }
    return ''
  }

  const goNext = () => {
    if (needsTeam()) {
      return
    }
    if (!name.trim()) {
      setError('프로젝트 이름을 입력해 주십시오.')
      nameRef.current?.focus()
      return
    }
    const problem = periodProblem()
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setStep(STEP_ABOUT)
  }

  const save = async () => {
    if (busy || !teamId || !name.trim()) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const project = await createProject(teamId, {
        name: name.trim(),
        description: description.trim(),
        goal: goal.trim(),
        memberIds: members.map((person) => person.user_id),
        periodStart: startedAt,
        periodEnd: endedAt,
      })
      onCreated(project)
      onClose()
    } catch (err) {
      setError(err?.message || '프로젝트를 만들지 못했습니다.')
      setBusy(false)
    }
  }

  if (makingTeam) {
    return (
      <NewTeamDialog
        onClose={() => setMakingTeam(false)}
        onCreated={(team) => {
          // 만든 팀을 목록에 얹고 골라 둔다. 다시 고르게 하면 방금 만든 팀을
          // 목록에서 찾아야 한다.
          setTeams((current) => [...(current ?? []), team])
          pickTeam(team.id)
          setMakingTeam(false)
        }}
      />
    )
  }

  return (
    <div
      className="np-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="np-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
        <h2 className="np-title" id="new-project-title">새 프로젝트</h2>

        {step === STEP_BASICS ? (
          <div className="np-body">
            <div className="np-fields">
              <div className="np-team">
                <button
                  className="np-link np-link-right"
                  type="button"
                  onClick={() => setMakingTeam(true)}
                >
                  + 새로운 팀 생성하기
                </button>

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
                        /*
                          속한 팀이 없으면 프로젝트를 만들 자리가 없다. 위의
                          `+ 새로운 팀 생성하기` 가 유일한 출구라 그것을 가리킨다.
                        */
                        <p className="np-list-empty">
                          {teamQuery.trim()
                            ? '찾는 팀이 없습니다.'
                            : '속한 팀이 없습니다. 위에서 팀을 먼저 만드십시오.'}
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

              <div className="np-field">
                <span className="np-label">프로젝트 이름</span>
                <TextBox
                  value={name}
                  inputRef={nameRef}
                  onChange={(next) => { if (!needsTeam()) setName(next) }}
                  onSubmit={() => memberRef.current?.focus()}
                  placeholder="프로젝트 이름을 입력해주세요."
                  ariaLabel="프로젝트 이름"
                  maxLength={80}
                />
              </div>

              <div className="np-field">
                <span className="np-label">진행기간</span>
                <div className="np-period">
                  <NumberBox
                    value={year}
                    onChange={(next) => { if (!needsTeam()) setYear(next) }}
                    unit="년"
                    width="np-year"
                    maxLength={4}
                    placeholder="2026"
                    ariaLabel="진행기간 연도"
                  />
                  <NumberBox
                    value={start.month}
                    onChange={(next) => { if (!needsTeam()) setStart((c) => ({ ...c, month: next })) }}
                    unit="월"
                    width="np-small"
                    ariaLabel="시작 월"
                  />
                  <NumberBox
                    value={start.day}
                    onChange={(next) => { if (!needsTeam()) setStart((c) => ({ ...c, day: next })) }}
                    unit="일"
                    width="np-small"
                    ariaLabel="시작 일"
                  />
                  <TimeBox
                    value={start.time}
                    onChange={(next) => { if (!needsTeam()) setStart((c) => ({ ...c, time: next })) }}
                    ariaLabel="시작 시각"
                  />

                  <span className="np-tilde" aria-hidden="true">~</span>

                  <NumberBox
                    value={end.month}
                    onChange={(next) => { if (!needsTeam()) setEnd((c) => ({ ...c, month: next })) }}
                    unit="월"
                    width="np-small"
                    ariaLabel="종료 월"
                  />
                  <NumberBox
                    value={end.day}
                    onChange={(next) => { if (!needsTeam()) setEnd((c) => ({ ...c, day: next })) }}
                    unit="일"
                    width="np-small"
                    ariaLabel="종료 일"
                  />
                  <TimeBox
                    value={end.time}
                    onChange={(next) => { if (!needsTeam()) setEnd((c) => ({ ...c, time: next })) }}
                    ariaLabel="종료 시각"
                  />
                </div>
              </div>

              <div className="np-field">
                <div className="np-label-row">
                  <span className="np-label">참여자 선택</span>
                  <button
                    className="np-link"
                    type="button"
                    onClick={() => { if (!needsTeam()) setMembers(candidates) }}
                  >
                    팀 멤버 불러오기
                  </button>
                </div>

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
                ) : (
                  // 안 고르면 팀 전원이 들어간다. 서버 기본값이라 화면이 말해
                  // 주지 않으면 아무도 안 들어간 줄 안다.
                  <p className="np-note">고르지 않으면 팀 전원이 참여자로 들어갑니다.</p>
                )}
              </div>

              {error ? <p className="np-error" role="alert">{error}</p> : null}
            </div>

            <div className="np-actions">
              <button className="np-cancel" type="button" onClick={onClose}>취소</button>
              <button className="np-submit" type="button" onClick={goNext}>다음</button>
            </div>
          </div>
        ) : (
          <div className="np-body">
            <div className="np-fields">
              <div className="np-field">
                <span className="np-label">프로젝트 목표</span>
                <TextBox
                  value={goal}
                  onChange={setGoal}
                  onSubmit={() => descriptionRef.current?.focus()}
                  disabled={busy}
                  placeholder="프로젝트 목표를 입력해주세요."
                  ariaLabel="프로젝트 목표"
                />
              </div>

              <div className="np-field">
                <span className="np-label">프로젝트 설명</span>
                <TextBox
                  value={description}
                  inputRef={descriptionRef}
                  onChange={setDescription}
                  onSubmit={save}
                  disabled={busy}
                  placeholder="프로젝트 설명을 입력해주세요."
                  ariaLabel="프로젝트 설명"
                />
              </div>

              <p className="np-note">
                <strong>{teamName}</strong>에 <strong>{name.trim()}</strong> 프로젝트를 만듭니다.
              </p>
              {error ? <p className="np-error" role="alert">{error}</p> : null}
            </div>

            <div className="np-actions">
              <button
                className="np-cancel"
                type="button"
                disabled={busy}
                onClick={() => { setError(''); setStep(STEP_BASICS) }}
              >
                이전
              </button>
              <button className="np-submit" type="button" disabled={busy} onClick={save}>
                {busy ? '만드는 중…' : '프로젝트 생성하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
