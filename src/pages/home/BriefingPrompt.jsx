import { useEffect, useRef, useState } from 'react'

import { navigate } from '../../app/navigation.js'
import { dismissBriefing } from './home.api.js'

/**
 * 읽지 않은 브리핑이 있을 때 홈에서 뜨는 팝업.
 *
 * ## 이 서비스가 처음 묻는 질문이 여기 있다
 *
 * "내가 없는 동안 무슨 일이 있었지" 의 답은 브리핑이다. 그런데 홈에는 그것이
 * 있다는 표시가 상단 버튼 하나뿐이라, 자리를 비웠던 사람이 홈을 열고도
 * 그냥 지나칠 수 있었다.
 *
 * ## `always_open` 은 서버가 이미 들고 있었는데 아무도 안 읽었다
 *
 * `GET /home` 의 `briefing_pending.always_open` 과 `POST /me/briefing-dismiss`
 * 가 짝인데 프론트에 경로가 없었다. 켜 둔 사람은 **자기가 켠 설정이 아무
 * 일도 안 하는 것**을 보고 있었던 셈이다.
 *
 * 켜져 있으면 팝업을 띄우지 않고 바로 브리핑으로 보낸다 (부모가 판단한다).
 * 여기서는 꺼져 있을 때의 팝업만 그린다.
 */

export function BriefingPrompt({ briefing, onClose }) {
  const [always, setAlways] = useState(Boolean(briefing.always_open))
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

  /*
    체크박스 값은 **어느 버튼을 누르든** 저장한다.

    `취소` 는 "지금은 안 본다" 이고 체크박스는 "다음부터 어떻게 할까" 라
    서로 다른 결정이다. 취소할 때 버리면, 자동 열기를 켜 두고 이번만 미룬
    사람의 설정이 사라진다.

    저장에 실패해도 이동은 막지 않는다. 브리핑을 보러 가는 것이 이 팝업의
    본래 목적이고, 실패한 것은 다음 방문 동작일 뿐이다.
  */
  const finish = async (go) => {
    if (busy) {
      return
    }
    setBusy(true)
    try {
      await dismissBriefing(always)
    } catch (err) {
      if (!go) {
        setError(err?.message || '설정을 저장하지 못했습니다.')
        setBusy(false)
        return
      }
    }

    if (go) {
      navigate(`/flow-board?meeting=${briefing.meeting_id}&source=bordo-briefing`)
    }
    onClose()
  }

  return (
    <div
      className="delegate-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="delegate-dialog briefing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="briefing-title"
      >
        <header className="delegate-header">
          <div>
            <h2 id="briefing-title">확인하지 않은 브리핑이 있습니다</h2>
            <p>자리를 비운 사이 회의에서 무슨 일이 있었는지 정리해 두었습니다.</p>
          </div>
          <button ref={closeRef} type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>

        <div className="delegate-body">
          <label className="briefing-always">
            <input
              type="checkbox"
              checked={always}
              disabled={busy}
              onChange={(event) => setAlways(event.target.checked)}
            />
            <span>홈에 들어오면 브리핑을 바로 엽니다</span>
          </label>

          {error ? <p className="delegate-error" role="alert">{error}</p> : null}
        </div>

        <footer className="delegate-footer">
          <button className="delegate-cancel" type="button" disabled={busy} onClick={() => finish(false)}>
            나중에 보기
          </button>
          <button className="delegate-save" type="button" disabled={busy} onClick={() => finish(true)}>
            브리핑 보러가기
          </button>
        </footer>
      </div>
    </div>
  )
}
