import './LoadState.css'

/**
 * 읽는 중 · 실패 · 비어 있음.
 *
 * 세 상태를 화면마다 따로 만들면 같은 상황에 다른 문구가 생긴다. 특히 실패는
 * **화면이 자기 문구를 지어내기 쉬운 자리**인데, 백엔드의 `error.message` 는
 * 규약상 사용자에게 그대로 보여줄 한국어이고 무엇을 해야 하는지까지 담고 있다.
 * 여기서 그것을 쓴다.
 *
 * ## 빈 화면을 그냥 두지 않는다
 *
 * 데이터가 없을 때 아무것도 안 그리면 사용자는 **아직 읽는 중인지, 없는 건지,
 * 고장 난 건지** 구별하지 못한다. 이 서비스의 질문이 "내가 없는 동안 무슨 일이
 * 있었지" 인데, 빈 화면은 "아무 일도 없었다" 와 "못 불러왔다" 를 같게 만든다.
 */

export function Loading({ label = '불러오는 중입니다…' }) {
  return (
    <div className="load-state" role="status" aria-live="polite">
      <span className="load-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function LoadError({ error, onRetry }) {
  // 네트워크 오류와 서버가 준 오류는 안내가 달라야 한다. 앞은 다시 시도하면
  // 되는 것이고, 뒤는 사용자가 무언가를 해야 하는 것일 수 있다.
  const retryable = error?.retryable !== false

  return (
    <div className="load-state load-state-error" role="alert">
      <p className="load-message">{error?.message || '불러오지 못했습니다.'}</p>
      {onRetry && retryable ? (
        <button type="button" onClick={onRetry}>다시 시도</button>
      ) : null}
    </div>
  )
}

export function Empty({ children }) {
  return (
    <div className="load-state load-state-empty">
      <p>{children}</p>
    </div>
  )
}
