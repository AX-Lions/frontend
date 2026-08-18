import { Component } from 'react'

/**
 * 화면 하나가 터졌을 때 앱 전체가 사라지지 않게 막는다.
 *
 * ## 왜 지금 필요해졌나
 *
 * 화면을 경로별로 나눠 받기 시작하면서, **화면을 여는 일이 네트워크에
 * 의존하게 됐다.** 정적 import 였을 때는 앱이 떠 있으면 이동은 그냥 됐다.
 * 지금은 지하철에서 와이파이가 끊기거나 세션 중에 새로 배포돼 조각 이름이
 * 바뀌면 `import()` 가 거절된다.
 *
 * 그 거절은 `Suspense` 가 못 잡는다. `Suspense` 는 **기다리는 것**을 다루지
 * **실패한 것**을 다루지 않는다. 잡아 주는 것이 없으면 React 는 루트를 통째로
 * 언마운트한다 — 스피너도 오류 문구도 없는 **완전한 흰 화면**이고, 새로고침
 * 말고는 빠져나갈 길이 없다.
 *
 * ## 왜 훅이 아니라 클래스인가
 *
 * `getDerivedStateFromError` 에 해당하는 훅이 아직 없다. React 팀도 이것
 * 하나만은 클래스로 두라고 안내한다.
 *
 * ## 다시 시도는 새로고침이다
 *
 * 브라우저는 **실패한 동적 import 를 실패로 기억한다.** 같은 주소로 다시
 * 불러도 요청조차 나가지 않는다. 그래서 여기서는 상태만 되돌리는 시늉을 하지
 * 않고 문서를 다시 읽는다 — 그것만이 실제로 통한다.
 */
export class ScreenBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    // 조각을 못 받은 것인지 화면 코드가 터진 것인지는 콘솔에서 갈린다.
    // 사용자에게는 둘 다 "열지 못했다" 로 같지만, 고치는 쪽에는 다르다.
    console.error('화면을 여는 중 오류', error)
  }

  render() {
    if (!this.state.failed) {
      return this.props.children
    }

    return (
      <div className="load-state-page">
        <div className="load-state load-state-error" role="alert">
          <p className="load-message">화면을 열지 못했습니다. 연결을 확인해 주십시오.</p>
          <button type="button" onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      </div>
    )
  }
}
