import { useEffect, useMemo, useRef, useState } from 'react'

import { getCurrentTeamId, setCurrentTeamId } from '../../lib/currentTeam.js'
import { useEscapeToClose } from '../../shared/hooks/useEscapeToClose.js'
import { fetchTeamProjects, fetchTeams } from './home.api.js'
import './newProject.css'
import './teamSwitch.css'

/**
 * 팀 전환하기(시안 `692:8230`, 여는 자리는 `576:4862`).
 *
 * ## 프로젝트 미리보기
 *
 * `GET /teams/{team_id}/projects` 가 바로 이 자리를 위해 있다 — 명세 설명에
 * "팀 변경 팝오버의 `팀 A → 프로젝트 1, 프로젝트 2` 도 이걸 씁니다" 라고
 * 적혀 있다. 팀 목록을 받은 뒤 팀마다 이 주소로 한 번씩 더 불러 이름을
 * 모은다 — 팀이 몇 개 안 되는 목록이라 왕복이 늘어도 눈에 띄지 않는다.
 *
 * ## 고르면 무엇이 바뀌는가
 *
 * 서버에는 "지금 보고 있는 팀" 이라는 개념이 없다(`lib/currentTeam.js`).
 * 고른 팀 id 를 저장해 두면 홈이 그 팀 프로젝트만 보여준다 — `HomePage` 가
 * `onCurrentTeamChange` 를 구독해 다시 그린다.
 */
export function TeamSwitchDialog({ onClose }) {
  const [teams, setTeams] = useState(null)
  const [projectsByTeam, setProjectsByTeam] = useState({})
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const current = getCurrentTeamId()
  const closeRef = useRef(null)

  useEscapeToClose(onClose)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    let alive = true
    fetchTeams()
      .then((body) => {
        const rows = body?.results ?? []
        if (!alive) {
          return
        }
        setTeams(rows)
        // 팀마다 프로젝트 미리보기를 따로 받는다. 하나가 늦거나 실패해도
        // 나머지 팀은 뜬다 — 서로 기다리게 두지 않는다.
        rows.forEach((team) => {
          fetchTeamProjects(team.id)
            .then((projects) => {
              if (alive) {
                setProjectsByTeam((c) => ({ ...c, [team.id]: projects?.results ?? [] }))
              }
            })
            .catch(() => {
              if (alive) {
                setProjectsByTeam((c) => ({ ...c, [team.id]: [] }))
              }
            })
        })
      })
      .catch((err) => {
        if (alive) {
          setError(err?.message || '팀 목록을 불러오지 못했습니다.')
        }
      })
    return () => {
      alive = false
    }
  }, [])

  const needle = query.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!teams) {
      return []
    }
    if (!needle) {
      return teams
    }
    return teams.filter((team) => team.name.toLowerCase().includes(needle))
  }, [teams, needle])

  const currentTeam = teams?.find((team) => team.id === current)

  const projectPreview = (teamId) => {
    const projects = projectsByTeam[teamId]
    if (projects === undefined) {
      return '불러오는 중…'
    }
    if (projects.length === 0) {
      return '진행 중인 프로젝트가 없습니다'
    }
    return projects.map((p) => p.name).join(', ')
  }

  const choose = (teamId) => {
    setCurrentTeamId(teamId)
    onClose()
  }

  return (
    <div className="np-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="team-switch-dialog" role="dialog" aria-modal="true" aria-labelledby="team-switch-title">
        <div className="team-switch-head">
          <h2 id="team-switch-title">팀 전환하기</h2>
          <span className="team-switch-current">
            현재 팀 <strong>{currentTeam?.name ?? '전체'}</strong>
          </span>
        </div>

        <label className="np-search">
          <img src="/icons/Search.svg" alt="" aria-hidden="true" />
          <input
            type="search"
            placeholder="검색어를 입력하세요..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="팀 검색"
          />
        </label>

        <div className="team-switch-list">
          {error ? <p className="team-switch-empty">{error}</p> : null}
          {!error && teams && shown.length === 0 ? (
            <p className="team-switch-empty">{needle ? '찾는 팀이 없습니다.' : '속한 팀이 없습니다.'}</p>
          ) : null}
          {shown.map((team) => (
            <button
              key={team.id}
              type="button"
              className={team.id === current ? 'team-switch-row is-current' : 'team-switch-row'}
              onClick={() => choose(team.id)}
            >
              <span className="team-switch-name">{team.name}</span>
              <span className="team-switch-meta">{projectPreview(team.id)}</span>
            </button>
          ))}
          {!error && current ? (
            <button type="button" className="team-switch-row team-switch-clear" onClick={() => choose(null)}>
              <span className="team-switch-name">전체 보기</span>
              <span className="team-switch-meta">모든 팀의 프로젝트</span>
            </button>
          ) : null}
        </div>

        <button ref={closeRef} type="button" className="team-switch-close" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  )
}
