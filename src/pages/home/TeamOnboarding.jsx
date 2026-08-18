import { useEffect, useState } from 'react'

import { Loading } from '../../shared/components/LoadState.jsx'
import { createTeam, fetchTeams, joinTeam } from './home.api.js'
import './teamOnboarding.css'

/**
 * 아무 데도 속하지 않은 사람이 보는 화면.
 *
 * ## 왜 필요한가
 *
 * 가입만 하고 팀이 없으면 홈이 **전부 0** 으로 뜬다. 최근 회의 0, 오늘 일정 0,
 * 프로젝트 0. 그런데 팀을 만들 버튼도 초대 코드를 넣을 칸도 화면에 없어서
 * **빠져나갈 길이 없었다.** 서버에는 처음부터 다 있던 기능이다.
 *
 * 시연 중에 계정을 하나 새로 만들면 바로 드러나는 자리다.
 *
 * ## 빈 화면을 "아무 일도 없었다" 로 두지 않는다
 *
 * 이 서비스가 묻는 질문이 "내가 없는 동안 무슨 일이 있었지" 다. 그 답이 빈
 * 화면이면 사용자는 **기록이 없는 것**과 **내가 아무 데도 안 붙어 있는 것**을
 * 구별하지 못한다. 무엇이 없어서 비어 있는지 말해 준다.
 *
 * ## 팀이 없는 것과 프로젝트가 없는 것은 다르다
 *
 * 홈만 보면 둘 다 0 이라 같아 보이지만 해야 할 일이 다르다. 팀이 없으면 팀부터,
 * 팀은 있는데 프로젝트가 없으면 프로젝트부터다. 잘못 안내하면 이미 팀에 속한
 * 사람에게 팀을 하나 더 만들게 한다 — 그러면 **동료들과 다른 팀에 앉게 된다.**
 * 그래서 여기서 팀 목록을 한 번 읽는다. 홈이 비어 있을 때만 나가는 요청이다.
 */

export function TeamOnboarding({ onDone, onAddProject }) {
  const [teams, setTeams] = useState(null)
  const [mode, setMode] = useState('join')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    fetchTeams(controller.signal)
      .then((data) => { if (alive) setTeams(data?.results ?? []) })
      // 팀 목록을 못 읽었다고 이 화면을 오류로 덮지 않는다. 팀이 없다고 보고
      // 두 버튼을 다 보여 주는 편이 낫다 — 어느 쪽이든 사용자가 고를 수 있다.
      .catch(() => { if (alive) setTeams([]) })
    return () => { alive = false; controller.abort() }
  }, [])

  if (teams === null) {
    return <Loading label="확인하는 중입니다…" />
  }

  /*
    팀은 있는데 프로젝트가 없는 경우.

    이미 있는 `프로젝트 추가` 팝업을 그대로 연다. 여기서 따로 만들면 같은 일을
    하는 화면이 둘이 되고, 한쪽만 고쳐지는 일이 생긴다.
  */
  if (teams.length > 0) {
    return (
      <section className="onboarding" aria-labelledby="onboarding-title">
        <h1 id="onboarding-title">아직 참여 중인 프로젝트가 없습니다</h1>
        <p className="onboarding-lead">
          <strong>{teams[0].name}</strong> 팀에 들어와 있습니다.
          {' '}
          {/*
            "프로젝트가 없다" 와 "프로젝트에 안 들어가 있다" 를 뭉뚱그리지
            않는다. 팀에 나중에 합류하면 **이미 있는 프로젝트에는 자동으로
            들어가지 않는다.** 팀에 프로젝트가 여럿 돌아가고 있는데 화면이
            "프로젝트를 만드십시오" 라고만 하면, 사용자는 동료들이 쓰는 판
            옆에 빈 판을 하나 더 만들게 된다.
          */}
          팀에 이미 있는 프로젝트는 초대를 받아야 보입니다. 새로 시작할
          프로젝트가 있다면 직접 만들 수도 있습니다.
        </p>
        <button type="button" className="onboarding-primary" onClick={onAddProject}>
          프로젝트 만들기
        </button>
      </section>
    )
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (mode === 'join') {
        const joined = await joinTeam(code.trim())
        // **여기서 팀 목록을 같이 고친다.** 홈만 다시 읽으면 이 화면은 계속
        // `속한 팀이 없습니다` 로 남는다 — 팀 목록은 처음 한 번만 읽었기
        // 때문이다. 참여에 성공했는데 화면이 그대로면 사용자는 실패한 줄 알고
        // 같은 코드를 다시 넣는다(그러면 `이미 그 팀에 속해 있습니다` 가 뜬다).
        setTeams([{ id: joined.team_id, name: joined.team_name }])
      } else {
        const team = await createTeam(name.trim())
        setTeams([team])
      }
      // 홈도 다시 읽는다. 팀이 생기면 사이드바·프로젝트·일정이 전부 달라진다.
      onDone()
    } catch (caught) {
      // 상태 코드가 아니라 `error.code` 로 가른다. 셋 다 400 이지만 사용자가
      // 해야 할 일이 다르다 — 코드를 다시 받아야 하는가, 이미 들어와 있는가.
      setError(joinMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = (mode === 'join' ? code.trim() : name.trim()).length > 0

  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <h1 id="onboarding-title">아직 속한 팀이 없습니다</h1>
      <p className="onboarding-lead">
        Bordo 는 팀 단위로 움직입니다. 팀에 들어가면 회의·대리인·작업 흐름이
        여기에 모입니다.
      </p>

      <div className="onboarding-tabs" role="tablist" aria-label="참여 방법">
        <button
          type="button" role="tab" aria-selected={mode === 'join'}
          className={mode === 'join' ? 'is-active' : ''}
          onClick={() => { setMode('join'); setError('') }}
        >
          초대 코드로 참여
        </button>
        <button
          type="button" role="tab" aria-selected={mode === 'create'}
          className={mode === 'create' ? 'is-active' : ''}
          onClick={() => { setMode('create'); setError('') }}
        >
          팀 만들기
        </button>
      </div>

      <form className="onboarding-form" onSubmit={submit}>
        {mode === 'join' ? (
          <>
            <label htmlFor="onboarding-code">초대 코드</label>
            <input
              id="onboarding-code" value={code} disabled={busy}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="BRD-A1B2-C3D4" autoComplete="off" spellCheck={false}
            />
            <p className="onboarding-hint">팀 관리자에게 받은 코드를 넣으십시오.</p>
          </>
        ) : (
          <>
            <label htmlFor="onboarding-name">팀 이름</label>
            <input
              id="onboarding-name" value={name} disabled={busy} maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 멋쟁이사자처럼 12기"
            />
            <p className="onboarding-hint">
              만들면 소유자가 됩니다. 이후 초대 코드로 동료를 부를 수 있습니다.
            </p>
          </>
        )}

        {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
        {notice ? <p className="onboarding-notice" role="status">{notice}</p> : null}

        <button type="submit" className="onboarding-primary" disabled={busy || !canSubmit}>
          {busy ? '처리 중입니다…' : mode === 'join' ? '참여하기' : '팀 만들기'}
        </button>
      </form>
    </section>
  )
}

/**
 * 서버가 준 코드를 사용자가 할 일로 옮긴다.
 *
 * 서버 문구를 그대로 써도 되지만, 이 셋은 **다음에 무엇을 해야 하는지**가
 * 서로 달라서 그것까지 적어 준다.
 */
function joinMessage(error) {
  switch (error?.code) {
    case 'TEAM_INVITE_INVALID':
      return '그런 초대 코드가 없습니다. 코드를 다시 확인해 주십시오.'
    case 'TEAM_INVITE_EXPIRED':
      return '만료된 초대 코드입니다. 팀 관리자에게 새 코드를 받아 주십시오.'
    case 'TEAM_ALREADY_MEMBER':
      return '이미 그 팀에 속해 있습니다. 새로고침해 주십시오.'
    default:
      return error?.message || '처리하지 못했습니다. 잠시 후 다시 시도해 주십시오.'
  }
}
