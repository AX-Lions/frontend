import { useMemo, useState } from 'react'

import { Empty } from '../../shared/components/LoadState.jsx'

/**
 * 우측 `Bordo 브리핑` 패널.
 *
 * 통째로 목이었다 — 파일 맨 위에 `bordoBriefing` 상수가 있었고, 받아 온
 * `GET /meetings/{id}/ai-briefing` 은 읽고 **버렸다.** 회의가 무엇이든 같은
 * 문장이 떴다.
 *
 * ## 태그가 무엇인가
 *
 * 서버의 `location_chips` 다. `{content_type, label, count, edge_ids}` 로,
 * 요약을 읽다가 "그게 회의 어디였지" 로 건너뛰라고 **화살표 id 까지 실어 준다.**
 * 그래서 태그를 고르면 목록만 걸러지는 것이 아니라 캔버스의 그 화살표가 함께
 * 강조된다. 눌러도 색만 바뀌면 태그는 장식이다.
 *
 * ## 왜 단일 선택인가
 *
 * 기본은 **전체**(아무것도 안 고른 상태)이고, 하나를 고르면 그 종류만 남는다.
 * 다시 누르면 전체로 돌아온다. 다중 선택으로 두면 "전체" 와 "전부 골랐다" 가
 * 화면에서 구별되지 않는다.
 */

function matchesSearch(card, keyword) {
  if (!keyword) {
    return true
  }
  const haystack = `${card.title ?? ''} ${card.body ?? ''} ${card.note ?? ''}`.toLowerCase()
  return haystack.includes(keyword)
}

function BriefSection({ cards, emptyText, renderCard, title }) {
  return (
    <section className="bordo-section">
      <h3>{title}</h3>
      {cards.length === 0 ? (
        <Empty>{emptyText}</Empty>
      ) : (
        <div className="bordo-card-list">{cards.map(renderCard)}</div>
      )}
    </section>
  )
}

export function FlowBriefingSidebar({
  activeChip,
  briefing,
  icons,
  isScrolled,
  onChipToggle,
  onClose,
  onScroll,
}) {
  const [keyword, setKeyword] = useState('')
  const trimmed = keyword.trim().toLowerCase()

  // `?? []` 를 렌더 안에서 만들면 매번 새 배열이라 아래 useMemo 가 늘 다시 돈다.
  const chips = useMemo(() => briefing?.location_chips ?? [], [briefing])
  const chipEdgeIds = useMemo(() => {
    const picked = chips.find((chip) => chip.content_type === activeChip)
    return picked ? new Set(picked.edge_ids ?? []) : null
  }, [chips, activeChip])

  /*
    태그로 거를 때 `edge_id` 가 없는 카드는 남긴다.

    `답변이 필요해요` 는 화살표가 아니라 유보된 질문이라 종류를 붙일 수 없다.
    없다고 숨기면 태그를 하나 누르는 순간 **반드시 답해야 하는 것이 사라진다.**
    유보는 이 서비스의 차별점이라 필터에 휩쓸리면 안 된다.
  */
  const keep = (card) => matchesSearch(card, trimmed)
    && (!chipEdgeIds || !card.edge_id || chipEdgeIds.has(card.edge_id))

  const confirmations = (briefing?.needs_confirmation ?? []).filter(keep)
  const requests = (briefing?.requests_to_me ?? []).filter(keep)
  const answers = (briefing?.needs_answer ?? []).filter(keep)

  return (
    <aside
      className={isScrolled ? 'briefing-panel bordo-panel is-record-scrolled' : 'briefing-panel bordo-panel'}
      aria-label="Bordo 브리핑"
    >
      <header className={isScrolled ? 'briefing-header is-scrolled' : 'briefing-header'}>
        <h2>Bordo 브리핑</h2>
        <button className="panel-close" type="button" aria-label="패널 닫기" onClick={onClose}>
          ×
        </button>
        <label className={trimmed ? 'brief-search is-active' : 'brief-search'}>
          <img src={icons.search} alt="" />
          {/*
            `value`·`onChange` 가 아예 없어 타이핑이 상태로 들어오지 않았다.
            검색창이 있는데 무엇을 쳐도 목록이 그대로였다.
          */}
          <input
            type="search"
            aria-label="브리핑 검색"
            placeholder="검색어를 입력하세요..."
            value={keyword}
            onChange={(event) => setKeyword(event.currentTarget.value)}
          />
        </label>
      </header>

      <div className="briefing-scroll bordo-scroll" onScroll={onScroll}>
        <section className="bordo-section bordo-overview">
          <h3>회의 한눈에 보기</h3>
          {briefing?.narrative
            ? <p>{briefing.narrative}</p>
            : <Empty>아직 요약이 준비되지 않았습니다.</Empty>}

          {chips.length > 0 ? (
            <div className="brief-tags bordo-tags">
              {chips.map((chip) => (
                <button
                  // 아무것도 안 고른 상태가 곧 전체 선택이라, 그때는 전부 켜 보인다.
                  className={!activeChip || activeChip === chip.content_type ? 'is-active' : ''}
                  type="button"
                  key={chip.content_type}
                  aria-pressed={activeChip === chip.content_type}
                  onClick={() => onChipToggle(chip.content_type)}
                >
                  {chip.label}
                  <b>{chip.count}</b>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <BriefSection
          title="확인이 필요해요"
          cards={confirmations}
          emptyText="확인할 변경이 없습니다."
          renderCard={(card) => (
            <article className="bordo-action-card" key={card.id}>
              <span>
                <strong>{card.title}</strong>
                <small>{card.body}</small>
              </span>
              <img src={icons.expandRight} alt="" />
            </article>
          )}
        />

        <BriefSection
          title="나에게 요청한 내용"
          cards={requests}
          emptyText="나에게 온 요청이 없습니다."
          renderCard={(card) => (
            <article className="bordo-request-card" key={card.id}>
              <strong>{card.title}</strong>
              {/* `body` 는 서버가 조사까지 붙여 완성해 준다(`서재민님이 요청했어요`). */}
              <small>{card.body}</small>
            </article>
          )}
        />

        <BriefSection
          title="답변이 필요해요"
          cards={answers}
          emptyText="대리인이 유보한 질문이 없습니다."
          renderCard={(card) => (
            <article className="bordo-request-card" key={card.question_id}>
              <strong>{card.title}</strong>
              <small>{card.body}</small>
              {/* `임수연 · 14:32`. 시각 환산은 서버가 끝냈다 — 여기서 다시 만들면
                  시간대가 다른 팀원끼리 같은 질문을 다른 시각으로 본다. */}
              <em>{card.meta}</em>
            </article>
          )}
        />
      </div>
    </aside>
  )
}
