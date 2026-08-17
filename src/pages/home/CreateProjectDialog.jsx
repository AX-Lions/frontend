import { useEffect, useRef, useState } from 'react'

import { createProject, fetchTeams } from './home.api.js'

/**
 * 사이드바 `프로젝트 추가`.
 *
 * ## 팀을 고르게 하는 이유
 *
 * 프로젝트는 팀 밑에만 생긴다(`POST /teams/{team_id}/projects`). 팀이 하나면
 * 고를 것이 없으니 미리 골라 두고, 여럿이면 물어본다 — 잘못된 팀에 만들면
 * 그 팀 사람 전원이 프로젝트 멤버로 들어간다(서버가 팀 전원을 넣는다).
 *
 * ## 팀 목록을 팝업에서 읽는다
 *
 * `GET /home` 에는 **프로젝트가 있는 팀**만 실려 온다. 이 버튼을 누르는 가장
 * 흔한 상황이 "새로 만든 팀에 첫 프로젝트" 라, 홈 응답만 보면 정작 필요한
 * 팀이 목록에 없다.
 */

export function CreateProjectDialog({ onClose, onCreated }) {
  const [teams, setTeams] = useState(null)
  const [teamId, setTeamId] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const closeRef = useRef(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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
        setTeamId(rows.length === 1 ? rows[0].id : '')
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

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || !teamId || busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const project = await createProject(teamId, trimmed)
      onCreated(project)
      onClose()
    } catch (err) {
      setError(err?.message || '프로젝트를 만들지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <div
      className="delegate-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="delegate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
      >
        <header className="delegate-header">
          <div>
            <h2 id="create-project-title">프로젝트 추가</h2>
            <p>팀 안에 새 프로젝트를 만듭니다.</p>
          </div>
          <button ref={closeRef} type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>

        <div className="delegate-body">
          {teams === null ? (
            <p className="delegate-note">팀 목록을 불러오는 중입니다…</p>
          ) : teams.length === 0 ? (
            // 팀이 없으면 프로젝트를 만들 자리가 없다. 빈 select 를 띄워
            // 누르게 두면 무엇이 잘못됐는지 알 수 없다.
            <p className="delegate-warn">
              속한 팀이 없습니다. <strong>팀에 먼저 참여해야</strong> 프로젝트를 만들 수 있습니다.
            </p>
          ) : (
            <>
              <label className="dialog-field">
                <strong>팀</strong>
                <select
                  value={teamId}
                  disabled={busy || teams.length === 1}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">팀을 고르십시오</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </label>

              <label className="dialog-field">
                <strong>프로젝트 이름</strong>
                <input
                  type="text"
                  value={name}
                  disabled={busy}
                  maxLength={80}
                  placeholder="예) Bordo 프론트엔드"
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      save()
                    }
                  }}
                />
              </label>

              <p className="delegate-note">
                만들면 그 팀 사람 모두가 프로젝트 멤버로 들어갑니다.
              </p>
            </>
          )}

          {error ? <p className="delegate-error" role="alert">{error}</p> : null}
        </div>

        <footer className="delegate-footer">
          <button className="delegate-cancel" type="button" disabled={busy} onClick={onClose}>
            닫기
          </button>
          <button
            className="delegate-save"
            type="button"
            disabled={busy || !teamId || !name.trim()}
            onClick={save}
          >
            {busy ? '만드는 중…' : '만들기'}
          </button>
        </footer>
      </div>
    </div>
  )
}
