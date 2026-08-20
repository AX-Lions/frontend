import { useEffect, useRef, useState } from 'react'

import { AppLink } from '../../app/AppLink.jsx'
import { useEscapeToClose } from '../../shared/hooks/useEscapeToClose.js'
import { approveTask, fetchTask, rejectTask } from './inbox.data.js'
import './approval.css'

/**
 * 승인 필요 상세 내용 팝업(시안 `701:5558`).
 *
 * 요청함의 `승인 필요` 줄이 연다. `POST /tasks/{id}/approve` · `reject` 는
 * 실제로 동작하는 주소다 — Bordo 가 만든 태스크는 사람이 승인하기 전까지
 * `PENDING_APPROVAL` 로 남는다(설계 1원칙: 사람 최종 승인). "승인 보류 근거"
 * 는 태스크마다 다른 문구가 아니라 **이 규칙 자체**를 설명한다 — 서버가 그
 * 근거를 따로 필드로 주지 않는다.
 *
 * ## 거절 사유 입력은 시안에 없다
 *
 * 시안은 `거절하기` 를 누르면 바로 반려되는 것처럼 그려져 있지만, 서버는
 * `reason` 을 필수로 받는다(반려 사유가 다음 회의 보고서의 컨텍스트로
 * 쓰인다). 사유 없이 그대로 보내면 매번 실패하므로, 누르면 이유를 적는
 * 칸을 펼친다.
 */
export function ApprovalDialog({ taskId, onClose, onResolved }) {
  const [task, setTask] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const reasonRef = useRef(null)

  useEscapeToClose(onClose)

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    fetchTask(taskId, controller.signal)
      .then((body) => {
        if (alive) {
          setTask(body)
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setError(err?.message || '태스크를 불러오지 못했습니다.')
        }
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [taskId])

  useEffect(() => {
    if (rejecting) {
      reasonRef.current?.focus()
    }
  }, [rejecting])

  const approve = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await approveTask(taskId)
      onResolved(taskId, 'approved')
      onClose()
    } catch (err) {
      setError(err?.message || '승인하지 못했습니다.')
      setBusy(false)
    }
  }

  const reject = async () => {
    if (!reason.trim()) {
      setError('반려 사유를 입력해 주십시오.')
      reasonRef.current?.focus()
      return
    }
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await rejectTask(taskId, reason.trim())
      onResolved(taskId, 'rejected')
      onClose()
    } catch (err) {
      setError(err?.message || '반려하지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <div
      className="ap-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="ap-dialog" role="dialog" aria-modal="true" aria-labelledby="approval-title">
        {!task ? (
          <p className="ap-loading">불러오는 중…</p>
        ) : (
          <>
            <h2 className="ap-title" id="approval-title">승인이 필요해요</h2>

            <div className="ap-cards">
              <div className="ap-card">
                <h3>“{task.title}”</h3>
                {task.description ? <p>{task.description}</p> : null}
              </div>

              <div className="ap-divider" aria-hidden="true" />

              <div className="ap-card">
                <strong>승인 보류 근거</strong>
                <p>Bordo가 회의 중 대신 만든 항목이에요. 사람이 확인하기 전까지는 실행되지 않아요.</p>
              </div>

              {/*
                "왜 사람이 눌러야 하는가" 와 "왜 이 내용이 나왔는가" 는 다른
                질문이다. 위 카드는 전자(고정 문구)를, 이 카드는 후자(실제
                회의 발언)를 답한다. `evidence` 가 없는 태스크도 있다 — 근거
                없이 카드를 만들면 없는 인용을 지어내게 된다.
              */}
              {task.evidence ? (
                <div className="ap-card ap-evidence">
                  <strong>이 회의에서 나온 이야기예요</strong>
                  <p>“{task.evidence.quote}” — {task.evidence.speaker}</p>
                  <AppLink
                    className="ap-evidence-link"
                    href={`/flow-board?meeting=${task.source_meeting}&edge=${task.evidence.edgeId}`}
                    onClick={onClose}
                  >
                    플로우에서 보기
                  </AppLink>
                </div>
              ) : null}
            </div>

            {error ? <p className="ap-error" role="alert">{error}</p> : null}

            {rejecting ? (
              <div className="ap-reject-form">
                <label htmlFor="approval-reason">반려 사유</label>
                <textarea
                  id="approval-reason"
                  ref={reasonRef}
                  value={reason}
                  disabled={busy}
                  placeholder="다음 회의 보고서에 참고 자료로 남습니다."
                  onChange={(event) => setReason(event.target.value)}
                />
                <div className="ap-actions">
                  <button
                    className="ap-cancel"
                    type="button"
                    disabled={busy}
                    onClick={() => { setRejecting(false); setReason(''); setError('') }}
                  >
                    취소
                  </button>
                  <button className="ap-confirm-reject" type="button" disabled={busy} onClick={reject}>
                    {busy ? '반려하는 중…' : '반려 확정'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="ap-actions">
                <button className="ap-reject" type="button" disabled={busy} onClick={() => setRejecting(true)}>
                  거절하기
                </button>
                <button className="ap-approve" type="button" disabled={busy} onClick={approve}>
                  {busy ? '승인하는 중…' : '승인하기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
