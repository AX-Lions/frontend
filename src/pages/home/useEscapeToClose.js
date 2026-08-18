import { useEffect } from 'react'

/**
 * 팝업이 열려 있는 동안 Escape 로 닫는다.
 *
 * 컴포넌트 파일(`newProjectBits.jsx`)에 같이 두면 그 파일이 컴포넌트 말고
 * 다른 것도 내보내게 되어 개발 중 빠른 새로고침이 통째로 꺼진다.
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
