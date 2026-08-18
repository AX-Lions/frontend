import { toneIcons, toneLabels } from './flowBoard.api'

/**
 * 작업 모드 5종의 아이콘.
 *
 * 디자이너 에셋을 못 쓴다. `public/figma-icons/category-1..5.svg` 는 이름과
 * 달리 데이터베이스 아이콘을 쪼갠 조각들이라(원기둥 윗면·아랫면·체크) **다섯을
 * 나란히 놓으면 서로 구별되지 않는다.** 회의 모드 아이콘 여섯을 돌려쓰는 것도
 * 답이 아니다 — 같은 그림이 `의견` 도 되고 `작업` 도 되면 필터를 신뢰할 수 없다.
 *
 * 그래서 다섯 개를 여기서 그린다. 디자이너 에셋이 들어오면 `toneIcons` 에
 * 경로만 추가하면 이쪽은 저절로 안 쓰인다.
 */
const workGlyphs = {
  // 작업 — 처리한 일. 상자 안의 체크
  work: (
    <>
      <rect x="3.5" y="3.5" width="13" height="13" rx="3.5" />
      <path d="M6.8 10.2 9 12.4l4.2-4.6" />
    </>
  ),
  // 수정 — 연필
  revision: (
    <>
      <path d="M13.2 3.6 16.4 6.8 7.6 15.6l-4 .8.8-4z" />
      <path d="M11.2 5.6 14.4 8.8" />
    </>
  ),
  // 피드백 — 말풍선
  feedback: (
    <>
      <path d="M16.5 11.2a2.8 2.8 0 0 1-2.8 2.8H8.2L4.5 16.5v-3.1a2.8 2.8 0 0 1-1-2.2V6.3a2.8 2.8 0 0 1 2.8-2.8h7.4a2.8 2.8 0 0 1 2.8 2.8z" />
    </>
  ),
  // 공유 — 갈라져 나가는 세 점
  share: (
    <>
      <circle cx="5" cy="10" r="2" />
      <circle cx="14.6" cy="5.2" r="2" />
      <circle cx="14.6" cy="14.8" r="2" />
      <path d="M6.9 9.1 12.8 6.1M6.9 10.9l5.9 3" />
    </>
  ),
  // AI 조회 — 돋보기와 반짝임
  aiLookup: (
    <>
      <circle cx="8.8" cy="8.8" r="4.6" />
      <path d="M12.2 12.2 16.4 16.4" />
      <path d="M8.8 6.6v4.4M6.6 8.8h4.4" />
    </>
  ),
}

export function FlowMetricBadge({ tone }) {
  const label = toneLabels[tone] ?? tone
  const glyph = workGlyphs[tone]

  return (
    <span className={`metric-icon ${tone}`} aria-label={label}>
      {toneIcons[tone] ? (
        <img src={toneIcons[tone]} alt="" />
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          {glyph ?? <circle cx="10" cy="10" r="4.5" />}
        </svg>
      )}
    </span>
  )
}
