import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 화면 하나가 API 하나를 읽는 흐름.
 *
 * ## 왜 훅으로 묶는가
 *
 * 화면마다 `useEffect` + `useState` 세 개(데이터·로딩·오류)를 따로 쓰면 같은
 * 코드가 화면 수만큼 생기고, 그중 몇 개는 **취소 처리를 빼먹는다.** 화면을 빠르게
 * 오갈 때 늦게 도착한 응답이 새 화면의 데이터를 덮어쓰는 것이 그렇게 생긴다.
 *
 * 라이브러리(react-query 등)를 넣지 않은 이유는 지금 필요한 것이 캐시나 무효화가
 * 아니라 **한 번 읽고 다시 읽기**뿐이기 때문이다. 목록 캐시나 낙관적 갱신이
 * 필요해지면 그때 논의한다.
 *
 * ## 로딩을 상태로 따로 두지 않는다
 *
 * `setLoading(true)` 를 effect 안에서 부르면 렌더가 한 번 더 돌고, React 19 의
 * 린트 규칙이 이것을 막는다. 대신 **"지금 필요한 요청"과 "마지막으로 담은 결과"가
 * 같은지**로 로딩을 판정한다. 상태가 하나뿐이라 셋이 어긋나는 경우가 없다.
 *
 * ## 취소를 두 겹으로 막는다
 *
 * `AbortController` 로 요청 자체를 끊고, `alive` 로 이미 끝난 요청의 `setState`
 * 도 막는다. 앞엣것만으로는 부족하다 — 취소 직전에 도착한 응답은 이미 처리 중이라
 * 그대로 상태에 들어간다.
 *
 * @param load `(signal) => Promise<T>` — 실제 호출
 * @param deps 이 값들이 바뀌면 다시 읽는다
 */
export function useResource(load, deps = []) {
  // 배열을 그대로 의존성에 넣으면 매 렌더마다 새 배열이라 계속 다시 읽는다.
  const key = JSON.stringify(deps)
  const [nonce, setNonce] = useState(0)
  const [result, setResult] = useState({ key: null, nonce: -1, data: null, error: null })

  // `load` 를 의존성에 넣지 않는다. 화면에서 인라인 화살표 함수로 넘기는 것이
  // 자연스러운데, 그러면 매 렌더마다 새 함수가 되어 무한히 다시 읽는다.
  // 렌더 도중에 ref 를 고치면 같은 렌더를 두 번 그릴 때 값이 갈리므로 effect 에서 옮긴다.
  const latest = useRef(load)
  useEffect(() => {
    latest.current = load
  })

  useEffect(() => {
    const controller = new AbortController()
    let alive = true

    latest.current(controller.signal)
      .then((data) => {
        if (alive) {
          setResult({ key, nonce, data, error: null })
        }
      })
      .catch((error) => {
        // 화면을 떠나 취소된 것은 오류가 아니다. 오류로 두면 뒤로 가기를 할
        // 때마다 "서버에 연결할 수 없습니다" 가 스친다.
        if (alive && error?.name !== 'AbortError') {
          setResult({ key, nonce, data: null, error })
        }
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [key, nonce])

  const sameKey = result.key === key
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const setData = useCallback((update) => {
    setResult((current) => ({
      ...current,
      data: typeof update === 'function' ? update(current.data) : update,
    }))
  }, [])

  return {
    // 다시 읽는 동안에도 **이미 보여 주던 것은 남긴다.** 화면이 잠깐 비었다가
    // 다시 차면 사용자는 무언가 사라진 줄 안다. 다만 조회 조건(`deps`)이 바뀌면
    // 그건 다른 것이므로 비운다.
    data: sameKey ? result.data : null,
    error: sameKey ? result.error : null,
    loading: !(sameKey && result.nonce === nonce),
    reload,
    setData,
  }
}
