import { LIVE_MEETING_RESPONSE_SECONDS } from '../hooks/useLiveMeeting.js'
import './LiveMeetingPrompt.css'

/**
 * 실시간 회의 팝업(시안 `666:5231`).
 *
 * 참여할지 대리인을 보낼지 묻는 자리라 배경을 눌러도 닫히지 않는다 — 답은
 * 버튼으로만, 아니면 카운트다운이 끝났을 때 자동으로 정해진다.
 *
 * 상태·타이머는 `useLiveMeeting` 이 들고 있다. 이 컴포넌트는 그것을 그리기만
 * 한다 — 전역 레일과 홈 사이드바 양쪽에서 같은 훅을 부르고 이 컴포넌트를
 * 함께 쓴다.
 */
export function LiveMeetingPrompt({ open, meeting, secondsLeft, responding, onDecline, onJoin }) {
  if (!open || !meeting) {
    return null
  }

  return (
    <div className="live-meeting-backdrop" role="presentation">
      <div
        className="live-meeting-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-meeting-title"
      >
        <div className="live-meeting-body">
          <h2 id="live-meeting-title">
            Discord에서 회의가 시작됐어요.
            <br />
            참여하시겠습니까?
          </h2>
          <p>응답이 없으면 {LIVE_MEETING_RESPONSE_SECONDS}초 후 당신의 Bordo가 대신 참여해요.</p>
          <div className="live-meeting-countdown" aria-hidden="true">{secondsLeft}</div>
        </div>

        <div className="live-meeting-actions">
          <button type="button" className="live-meeting-decline" disabled={responding} onClick={onDecline}>
            불참하기
          </button>
          <button type="button" className="live-meeting-join" onClick={onJoin}>
            참여하기
          </button>
        </div>
      </div>
    </div>
  )
}
