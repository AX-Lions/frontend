import { useRef, useState } from 'react'

import { createInviteCode, createTeam } from './home.api.js'
import { TextBox } from './newProjectBits.jsx'
import { useEscapeToClose } from '../../shared/hooks/useEscapeToClose.js'
import { TIME_ZONES, currentTimeZone, matchesZone, offsetLabel, zoneOf } from './timezones.js'

/**
 * 새 팀 (Figma `707:6045`).
 *
 * 새 프로젝트 팝업의 `+ 새로운 팀 생성하기` 에서 **모달이 바뀌어** 들어온다.
 * 만들고 나면 그 팀을 들고 프로젝트 팝업으로 돌아간다 — 팀을 만든 사람이
 * 원래 하려던 일이 프로젝트를 만드는 것이기 때문이다.
 *
 * ## 초대 코드는 만든 뒤에야 있다
 *
 * 시안은 만들기 **전에** 코드를 보여 준다. 그런데 코드는
 * `POST /teams/{team_id}/invite-codes` 로 나오므로 팀 id 가 있어야 생긴다.
 * 만들기 전에 그럴듯한 문자열을 띄우면, 복사해서 팀원에게 보낸 코드가 아무
 * 데도 안 닿는다 — **가짜 코드는 빈 칸보다 나쁘다.**
 *
 * 그래서 만들기 전에는 무엇을 기다리는지 적어 두고, 만든 직후 같은 자리에
 * 진짜 코드를 채운다. 그때 단추가 `완료` 로 바뀌어 프로젝트 팝업으로 돌아간다.
 */

export function NewTeamDialog({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [zoneId, setZoneId] = useState(currentTimeZone())
  const [zoneOpen, setZoneOpen] = useState(false)
  const [zoneQuery, setZoneQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  const descriptionRef = useRef(null)
  useEscapeToClose(onClose)

  const here = currentTimeZone()
  // 목록이 열여덟 줄이라 걸러 내는 값을 기억해 둘 것이 없다. `offsetLabel` 이
  // 지금 시각을 보므로(서머타임) 기억해 두면 오히려 철 지난 값이 남는다.
  const shown = TIME_ZONES.filter((zone) => matchesZone(zone, zoneQuery))
  const hereZone = zoneOf(here)
  const selected = zoneOf(zoneId)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy || created) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const team = await createTeam(trimmed, {
        description: description.trim(),
        timezone: zoneId,
      })
      setCreated(team)
      /*
        코드 발급은 **팀 생성과 따로 실패할 수 있다.** 코드가 안 나왔다고 팀이
        안 만들어진 것처럼 굴면, 사용자는 이미 있는 팀을 또 만든다. 팀은 만든
        것으로 확정하고 코드 자리에만 사정을 적는다.
      */
      try {
        const invite = await createInviteCode(team.id)
        setInviteCode(invite?.code ?? '')
      } catch {
        setInviteCode('')
      }
    } catch (err) {
      setError(err?.message || '팀을 만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!inviteCode) {
      return
    }
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
    } catch {
      // 클립보드를 막아 둔 브라우저가 있다. 코드는 화면에 그대로 있으니
      // 손으로 골라 복사할 수 있다 — 실패했다는 말만 남긴다.
      setCopied(false)
      setError('복사하지 못했습니다. 코드를 직접 선택해 복사해 주십시오.')
    }
  }

  return (
    <div
      className="np-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="np-dialog" role="dialog" aria-modal="true" aria-labelledby="new-team-title">
        <h2 className="np-title" id="new-team-title">새 팀</h2>

        <div className="np-body">
          <div className="np-fields">
            <div className="np-field">
              <span className="np-label">팀 이름</span>
              <TextBox
                value={name}
                onChange={setName}
                onSubmit={() => descriptionRef.current?.focus()}
                disabled={busy || !!created}
                placeholder="팀 이름을 입력해주세요."
                ariaLabel="팀 이름"
                maxLength={60}
              />
            </div>

            <div className="np-field">
              <span className="np-label">팀 설명</span>
              <TextBox
                value={description}
                onChange={setDescription}
                onSubmit={save}
                inputRef={descriptionRef}
                disabled={busy || !!created}
                placeholder="팀 설명을 입력해주세요."
                ariaLabel="팀 설명"
              />
            </div>

            <div className="np-field">
              <span className="np-label">기준 시간대</span>
              <div className="np-team">
                <button
                  className={zoneOpen ? 'np-team-head is-open' : 'np-team-head'}
                  type="button"
                  aria-expanded={zoneOpen}
                  disabled={busy || !!created}
                  onClick={() => setZoneOpen((open) => !open)}
                >
                  <span className="np-team-head-label">
                    {offsetLabel(selected.id)} {selected.cities}
                  </span>
                  <img src="/icons/ExpandDown.svg" alt="" />
                </button>

                {zoneOpen ? (
                  <div className="np-team-panel">
                    <label className="np-search">
                      <img src="/icons/Search.svg" alt="" aria-hidden="true" />
                      <input
                        type="search"
                        value={zoneQuery}
                        aria-label="시간대 검색"
                        placeholder="도시 또는 시간대 검색 - 예: 서울, New York, GMT + 9"
                        onChange={(event) => setZoneQuery(event.target.value)}
                      />
                    </label>

                    <div className="np-list">
                      <p className="np-list-group">현재 위치</p>
                      <ZoneRow
                        zone={hereZone}
                        selected={zoneId === hereZone.id}
                        onPick={() => { setZoneId(hereZone.id); setZoneOpen(false) }}
                      />

                      <p className="np-list-group">시간대</p>
                      {shown.length === 0 ? (
                        <p className="np-list-empty">찾는 시간대가 없습니다.</p>
                      ) : shown.map((zone) => (
                        <ZoneRow
                          key={zone.id}
                          zone={zone}
                          selected={zoneId === zone.id}
                          onPick={() => { setZoneId(zone.id); setZoneOpen(false) }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="np-field">
              <span className="np-label">
                팀원 초대 <span className="np-label-hint">아래 코드를 복사해서 공유해주세요.</span>
              </span>
              {inviteCode ? (
                <div className="np-code">
                  <span>{inviteCode}</span>
                  <button type="button" aria-label="초대 코드 복사" onClick={copy}>
                    <img src="/icons/Copy.svg" alt="" />
                  </button>
                </div>
              ) : (
                <div className="np-code is-empty">
                  {created
                    ? '초대 코드를 받지 못했습니다. 팀 설정에서 다시 발급할 수 있습니다.'
                    : '팀을 만들면 초대 코드가 나옵니다.'}
                </div>
              )}
              {copied ? <p className="np-note" role="status">복사했습니다.</p> : null}
            </div>

            {created ? (
              <p className="np-note" role="status">
                팀을 만들었습니다. 이어서 <strong>{created.name}</strong>에 프로젝트를 만들 수 있습니다.
              </p>
            ) : null}
            {error ? <p className="np-error" role="alert">{error}</p> : null}
          </div>

          <div className="np-actions">
            <button className="np-cancel" type="button" disabled={busy} onClick={onClose}>
              {created ? '닫기' : '취소'}
            </button>
            {created ? (
              <button className="np-submit" type="button" onClick={() => onCreated(created)}>
                완료
              </button>
            ) : (
              <button
                className="np-submit"
                type="button"
                disabled={busy || !name.trim()}
                onClick={save}
              >
                {busy ? '만드는 중…' : '팀 생성하기'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ZoneRow({ zone, selected, onPick }) {
  return (
    <button
      className="np-list-item np-zone-row"
      type="button"
      aria-pressed={selected}
      onClick={onPick}
    >
      <span className="np-zone-check">
        {selected ? <img src="/icons/CheckMark.svg" alt="선택됨" /> : null}
      </span>
      <span className="np-zone-body">
        <span className="np-zone-offset">{offsetLabel(zone.id)}</span>
        <span className="np-zone-cities">{zone.cities}</span>
      </span>
    </button>
  )
}
