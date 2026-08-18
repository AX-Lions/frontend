import { useEffect, useMemo, useRef, useState } from 'react'

import { getCurrentTeamId, setCurrentTeamId } from '../../lib/currentTeam.js'
import { useEscapeToClose } from './useEscapeToClose.js'
import { fetchTeams } from './home.api.js'
import './newProject.css'
import './teamSwitch.css'

/**
 * 팀 전환하기(시안 `692:8230`, 여는 자리는 `576:4862`).
 *
 * ## "프로젝트 N개" 대신 인원 수를 보여준다
 *
 * 시안은 팀마다 "팀이 진행하는 프로젝트 N개" 를 나열하는데, `GET /teams` 는
 * 그 목록을 안 준다 — 프로젝트 개수는 오직 `GET /home` 에만 있고, 그건
 * **지금 로그인한 내 관점**의 프로젝트만 센다(다른 팀에 내가 없는 프로젝트가
 * 있으면 안 잡힌다). 그래서 여기서는 `GET /teams` 가 실제로 주는 값 —
 * 인원 수 — 를 대신 보여준다. 억지로 맞추면 숫자가 실제와 달라진다.
 *
 * ## 고르면 무엇이 바뀌는가
 *
 * 서버에는 "지금 보고 있는 팀" 이라는 개념이 없다(`lib/currentTeam.js`).
 * 고른 팀 id 를 저장해 두면 홈이 그 팀 프로젝트만 보여준다 — `HomePage` 가
 * `onCurrentTeamChange` 를 구독해 다시 그린다.
 */
export function TeamSwitchDialog({ onClose }) {
  const [teams, setTeams] = useState(null)
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
        if (alive) {
          setTeams(body?.results ?? [])
        }
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
              <span className="team-switch-meta">{team.member_count}명</span>
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
