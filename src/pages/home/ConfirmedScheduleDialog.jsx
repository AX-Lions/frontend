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
 *
 * ## 회의가 안 걸린 일정도 열려야 한다
 *
 * 달력(`회의 일정`)의 한 칸은 `CalendarEvent` 다. 거기 붙는 회의
 * (`related_meeting`)는 **있을 수도 없을 수도 있다** — 지금 서버가 주는 것은
 * 거의 전부 `null` 이다. 회의 id 로만 열게 두면 달력에서는 이 팝업이 아예
 * 안 뜨고, 눌러도 아무 일이 없는 칸만 남는다. 그래서 회의가 없으면 부르는
 * 쪽이 이미 들고 있는 값(`schedule`)으로 같은 화면을 그린다. 그때는 갈 회의가
 * 없으므로 `회의 보기` 도 내리지 않는다.
 *
 * @param meetingId 회의 id. 없으면 요청을 보내지 않는다.
 * @param relatedEdgeId 이 일정을 만든 그 발언(플로우 엣지) id. 있으면 「회의
 *                  보기」가 회의를 여는 데서 그치지 않고 그 발언까지 바로 연다.
 * @param schedule  회의가 없을 때 쓸 값
 *                  `{ title, teamName, projectName, when, participantNames }`
 */
export function ConfirmedScheduleDialog({ meetingId, relatedEdgeId, schedule, onClose }) {
  const [header, setHeader] = useState(null)
  const [participants, setParticipants] = useState(null)
  const [error, setError] = useState('')

  useEscapeToClose(onClose)

  useEffect(() => {
    if (!meetingId) {
      return undefined
    }
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

  /*
    회의에서 온 값이 우선이고, 없으면 부른 쪽이 준 값이다. 둘을 한 모양으로
    맞춰 두면 아래 그리는 코드가 어느 쪽인지 몰라도 된다.
  */
  const shown = meetingId
    ? header
    : (schedule ? {
      title: schedule.title,
      team_name: schedule.teamName,
      project_name: schedule.projectName,
      when: schedule.when,
      delegated: false,
    } : null)

  const names = meetingId
    ? (participants ?? []).map((p) => p.name)
    : (schedule?.participantNames ?? [])
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
        ) : !shown ? (
          <p className="cs-loading">불러오는 중…</p>
        ) : (
          <div className="cs-body">
            <div className="cs-head">
              <h2 className="cs-title" id="confirmed-schedule-title">{shown.title}</h2>
              <img className="cs-edit" src="/icons/ChangeMark.svg" alt="" aria-hidden="true" />
            </div>

            {/* 제목과 본문을 가르는 선. 홈 「오늘 일정」·요약 카드가 쓰는 것과
                같은 선이라, 이 팝업이 그 줄에서 열렸다는 것이 이어져 읽힌다. */}
            <hr className="summary-divider" />

            <div className="cs-info">
              <div className="cs-meta">
                <strong>{shown.team_name} · {shown.project_name}</strong>
                <span>{shown.when}</span>
              </div>

              {shownNames.length > 0 || shown.delegated ? (
                <div className="cs-chips">
                  {shownNames.length > 0 ? (
                    <span className="cs-chip">
                      <span>{shownNames.join(' ')}</span>
                      {restCount > 0 ? <span>+ {restCount}</span> : null}
                    </span>
                  ) : null}
                  {shown.delegated ? <span className="cs-badge">{shown.badge}</span> : null}
                </div>
              ) : null}
            </div>
          </div>
        )}

        <div className="cs-actions">
          <button className="cs-cancel" type="button" onClick={onClose}>취소</button>
          {/* 갈 회의가 없으면 단추도 없다. 눌러도 아무 데도 안 가는 단추를
              남기면 `회의 보기` 가 고장 난 것처럼 보인다. */}
          {/*
            불참 등록을 **여기서도** 할 수 있어야 한다.

            예전에는 이 버튼이 홈 「오늘 일정」에만 있었다. 그 목록은 보는
            사람의 시간대로 **오늘 하루만** 자르므로, 회의가 그 사람에게 내일
            이거나 이미 지난 날이면 **누를 자리가 아예 없었다** — 시차가 다른
            팀원일수록 그렇다. 이 서비스가 파는 것이 "자리를 비울 것을 미리
            등록한다" 인데, 회의를 언제로 잡았느냐에 따라 그 행위가 막히면 안
            된다. 달력에서 일정을 눌러 열리는 이 팝업이 날짜와 무관한 유일한
            진입점이다.
          */}
          {meetingId ? (
            <button
              className="cs-absence"
              type="button"
              onClick={() => {
                navigate(`/delegate-prep?meeting=${meetingId}`)
                onClose()
              }}
            >
              {shown?.delegated ? '대리 참석 중' : '회의에 참여하지 않아요'}
            </button>
          ) : null}
          {meetingId ? (
            <button
              className="cs-view"
              type="button"
              onClick={() => {
                const query = relatedEdgeId ? `${meetingId}&edge=${relatedEdgeId}` : meetingId
                navigate(`/flow-board?meeting=${query}`)
                onClose()
              }}
            >
              회의 보기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
