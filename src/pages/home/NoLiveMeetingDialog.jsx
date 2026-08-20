// `LiveMeetingPrompt` 와 같은 바탕·카드 모양을 그대로 쓴다(`LiveMeetingPrompt.css`).
// 마이크 자리가 나중에 실제 회의를 잇게 되면, 지금 이 자리는 그 팝업으로
// 바뀔 것이다 — 미리 같은 모양을 써 두면 그때 바탕색만 남기고 안쪽만
// 갈아 끼우면 된다.
import '../../shared/components/LiveMeetingPrompt.css'

/**
 * 마이크를 눌렀을 때 뜨는 안내(시안 `576:4400` · `576:4855`).
 *
 * 지금은 이 자리가 실제 진행 중인 회의를 확인하지 않는다 — 눌러도 항상
 * 이 문구다. 배경을 누르면 닫힌다: 참여할지 대리인을 보낼지 답해야 하는
 * `LiveMeetingPrompt` 와 달리 이건 알려 주기만 하는 안내라, 답을 강제할
 * 이유가 없다.
 */
export function NoLiveMeetingDialog({ open, onClose }) {
  if (!open) {
    return null
  }

  return (
    <div
      className="live-meeting-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="live-meeting-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="no-live-meeting-title"
      >
        <div className="live-meeting-body">
          <h2 id="no-live-meeting-title">아직 진행 중인 회의가 없습니다.</h2>
        </div>

        <div className="live-meeting-actions">
          <button type="button" className="live-meeting-join" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
