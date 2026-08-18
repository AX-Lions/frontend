import { useEffect, useState } from 'react'

import { clearTokens } from '../lib/auth.js'
import { isMockMode, onMockChange, setMockMode } from './enabled.js'
import { currentViewer } from './session.js'
import './mockBanner.css'

/**
 * 가상 데이터로 돌고 있다는 것을 화면에 남긴다.
 *
 * ## 왜 감추면 안 되는가
 *
 * **진짜와 구별되지 않는 가짜가 제일 위험하다.** 시연 중에 가짜인 줄 모르고
 * 보여 주거나, 가짜 데이터를 보고 없는 버그를 잡거나, 반대로 진짜 버그를
 * "가짜라서 그렇겠지" 하고 넘긴다.
 *
 * 이 프로젝트가 "근거가 부족하면 지어내지 말고 유보한다" 를 원칙으로 두는
 * 것과 같은 이유다. 지어낸 것은 지어냈다고 말한다.
 *
 * ## 끄는 버튼을 같이 둔다
 *
 * 켠 자리(로그인 화면)와 쓰는 자리(모든 화면)가 다르다. 끄려고 로그아웃까지
 * 해야 하면 **켜 둔 채로 잊어버린다** — 그게 바로 위에서 말한 위험이다.
 */

export function MockBanner() {
  const [on, setOn] = useState(isMockMode)

  useEffect(() => onMockChange(setOn), [])

  if (!on) {
    return null
  }

  // 누구로 보고 있는지 같이 적는다. 계정을 갈아 가며 보게 되는데, 지금 누구
  // 눈으로 보고 있는지 모르면 **브리핑이 없는 것이 계정 탓인지 화면 탓인지**
  // 구별할 수 없다. 그 구별이 이 모드를 쓰는 이유의 절반이다.
  const viewer = currentViewer()

  return (
    <div className="mock-banner" role="status">
      <span className="mock-banner-dot" aria-hidden="true" />
      <span>
        <strong>가상 데이터</strong> · <strong>{viewer.name}</strong>님 눈으로 보고 있습니다.
      </span>
      <button
        type="button"
        onClick={() => {
          setMockMode(false)
          // 가짜 토큰도 함께 버린다. 남겨 두면 진짜 서버가 그것을 거절하고,
          // 갱신까지 실패한 끝에야 로그인 화면에 닿는다 — 사용자에게는
          // 그 사이가 "껐더니 오류가 났다" 로 보인다.
          clearTokens()
          // 통째로 다시 읽는다. 담아 둔 가짜 응답이 화면에 남아 있으면
          // 껐는데도 가짜가 보여, 껐다는 사실 자체를 못 믿게 된다.
          window.location.assign('/')
        }}
      >
        끄기
      </button>
    </div>
  )
}
