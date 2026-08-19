import { useEffect, useState } from 'react'

import { navigate } from '../../app/navigation.js'
import { fetchMeetingParticipants, fetchMeetingPrepHeader } from './home.api.js'
import { useEscapeToClose } from '../../shared/hooks/useEscapeToClose.js'
import './confirmedSchedule.css'

/**
 * 확정된 일정 확인 팝업(시안 `697:9393`).
 *
 * 홈 「오늘 일정」에서 회의 한 줄을 누르면 뜬다. 지금까지 그 클릭은 줄을
 * 골라 표시만 하고 아무 데도 안 이어졌다 — 이 팝업이 그 자리를 채운다.
 *
 * `header`(`GET /meetings/{id}/prep`)와 참여자(`GET /meetings/{id}`)를 따로
 * 부른다. 팝업 하나에 쓸 값 전부를 주는 자리가 없어서다 — 준비 화면 전체를
 * 부르면 예상 논쟁점까지 함께 오는데 이 팝업은 헤더만 쓴다.
 */
export function ConfirmedScheduleDialog({ meetingId, onClose }) {
  const [header, setHeader] = useState(null)
  const [participants, setParticipants] = useState(null)
  const [error, setError] = useState('')

  useEscapeToClose(onClose)

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    Promise.all([
      fetchMeetingPrepHeader(meetingId, controller.signal),
      fetchMeetingParticipants(meetingId, controller.signal),
    ])
      .then(([headerBody, participantRows]) => {
        if (alive) {
          setHeader(headerBody)
          setParticipants(participantRows)
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setError(err?.message || '일정을 불러오지 못했습니다.')
        }
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [meetingId])

  const names = (participants ?? []).map((p) => p.name)
  const shownNames = names.slice(0, 3)
  const restCount = names.length - shownNames.length

  return (
    <div
      className="cs-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="cs-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmed-schedule-title">
        {error ? (
          <p className="cs-error" role="alert">{error}</p>
        ) : !header ? (
          <p className="cs-loading">불러오는 중…</p>
        ) : (
          <div className="cs-body">
            <div className="cs-head">
              <h2 className="cs-title" id="confirmed-schedule-title">{header.title}</h2>
              <img className="cs-edit" src="/icons/ChangeMark.svg" alt="" aria-hidden="true" />
            </div>

            <div className="cs-info">
              <div className="cs-meta">
                <strong>{header.team_name} · {header.project_name}</strong>
                <span>{header.when}</span>
              </div>

              {shownNames.length > 0 || header.delegated ? (
                <div className="cs-chips">
                  {shownNames.length > 0 ? (
                    <span className="cs-chip">
                      <span>{shownNames.join(' ')}</span>
                      {restCount > 0 ? <span>+ {restCount}</span> : null}
                    </span>
                  ) : null}
                  {header.delegated ? <span className="cs-badge">{header.badge}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="cs-actions">
          <button className="cs-cancel" type="button" onClick={onClose}>취소</button>
          <button
            className="cs-view"
            type="button"
            onClick={() => { navigate(`/flow-board?meeting=${meetingId}`); onClose() }}
          >
            회의 보기
          </button>
        </div>
      </div>
    </div>
  )
}
