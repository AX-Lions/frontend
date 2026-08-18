import { navigateFromClick } from './navigation.js'

/**
 * 앱 안으로 가는 링크.
 *
 * ## 왜 `<a href>` 를 남기나
 *
 * `<button>` 으로 바꾸면 **가운데 클릭으로 새 탭 열기 · 주소 복사 · 링크로
 * 저장**이 전부 사라지고, 스크린 리더의 링크 목록에서 이 화면 이동이 통째로
 * 빠진다. 상태 표시줄에 목적지가 뜨지 않아 누르기 전에 어디로 가는지도 모른다.
 *
 * ## 왜 그러면서 클릭을 가로채나
 *
 * `href` 만 두면 브라우저가 문서를 다시 받는다. 홈 → 채팅 한 번에 번들 재파싱 ·
 * 전체 재마운트 · 데이터 전량 재조회가 일어나고 화면이 흰색으로 깜빡인다.
 * 그래서 **평범한 좌클릭만** 가로채 주소만 바꾸고, 수정 키를 누른 클릭과
 * 가운데 버튼은 브라우저에게 그대로 넘긴다(`navigateFromClick`).
 *
 * ## 쓰는 법
 *
 *     <AppLink className="project-link" href={`/flow-board?meeting=${id}`}>
 *       {meeting.title}
 *     </AppLink>
 *
 * `onClick` 을 같이 주면 **가로채기보다 먼저** 불린다. 거기서
 * `preventDefault()` 하면 이동하지 않는다 — 주소를 안 바꾸고 화면 안에서만
 * 처리하고 싶을 때 쓴다.
 *
 * 바깥으로 나가는 주소(Discord 등)에는 쓰지 않는다. 그건 그냥 `<a>` 다.
 */
export function AppLink({ href, onClick, children, ...rest }) {
  const handleClick = (event) => {
    onClick?.(event)
    navigateFromClick(event, href)
  }

  // `rest` 를 먼저 펼치고 `href`·`onClick` 을 뒤에 둔다. 순서를 바꾸면
  // 부르는 쪽이 실수로 넘긴 `onClick` 이 가로채기를 통째로 덮어써, 링크가
  // 조용히 전체 새로고침으로 되돌아간다.
  return (
    <a {...rest} href={href} onClick={handleClick}>
      {children}
    </a>
  )
}
