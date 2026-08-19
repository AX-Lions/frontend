import { useEffect } from 'react'

/**
 * 팝업이 열려 있는 동안 Escape 로 닫는다.
 *
 * `pages/home` 의 팝업(새 프로젝트 · 팀 전환 · 회의 일정)과 `pages/inbox` 의
 * 승인 팝업이 함께 쓴다 — 화면 하나에 묶어 두면 다른 화면이 페이지 경계를
 * 넘어 가져다 써야 한다.
 */
export function useEscapeToClose(onClose) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
}
