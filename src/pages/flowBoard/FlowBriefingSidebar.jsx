import { useMemo, useState } from 'react'

import { AppLink } from '../../app/AppLink.jsx'
import { AgentDock } from '../home/AgentDock.jsx'
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
  const haystack = `${card.title ?? ''} ${card.body ?? ''} ${card.note ?? ''} ${card.excerpt ?? ''}`.toLowerCase()
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

/** 서버가 남기는 유보 사유 코드를 사람이 읽을 한 줄로 바꾼다. */
const DEFER_REASON_LABEL = {
  'allow_schedule_change=false': '일정 변경은 대리인 권한 밖이라 유보',
  no_saved_answer: '저장된 답이 없어 유보',
  no_evidence: '근거가 없어 유보',
}

function deferReasonLabel(reason) {
  return DEFER_REASON_LABEL[reason] ?? '근거가 부족해 유보'
}

export function FlowBriefingSidebar({
  activeChip,
  briefing,
  icons,
  isScrolled,
  onChipToggle,
  onClose,
  onOpenEdge,
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
  const used = (briefing?.used_answers ?? []).filter(keep)
  const deferred = (briefing?.deferred_answers ?? []).filter(keep)

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
            <div className="bordo-action-card-wrap" key={card.id}>
              <button
                type="button"
                className="bordo-action-card"
                disabled={!card.edge_id}
                onClick={() => onOpenEdge?.(card.edge_id)}
              >
                <span>
                  <strong>{card.title}</strong>
                  <small>{card.body}</small>
                </span>
                <img src={icons.expandRight} alt="" />
              </button>
              {/* 이 변경이 실제로 바꾼 일정. 없는 카드도 있다 — 모든 확인
                  사항이 달력 일정으로 이어지는 것은 아니다(예: 톤 규칙 정리). */}
              {card.calendar_event_id ? (
                <AppLink
                  className="bordo-action-card-schedule"
                  href={`/meeting-schedule?event=${card.calendar_event_id}`}
                >
                  실제 일정에서 보기
                </AppLink>
              ) : null}
            </div>
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

        {/*
          대리인이 실제로 무엇에 근거해 답했는지, 무엇을 유보했는지.

          데이터는 처음부터 있었지만 이 화면이 한 번도 그리지 않았다 — 근거
          없이 답했다는 오해를 남기지 않으려면, 이 서비스의 차별점인 "유보"가
          결론 목록만큼 눈에 띄어야 한다.
        */}
        <BriefSection
          title="무엇에 근거해 답했는지"
          cards={used}
          emptyText="이번 회의에서 대신 답한 것이 없습니다."
          renderCard={(card, index) => (
            <button
              type="button"
              className="bordo-evidence-card is-used"
              key={`${card.edge_id ?? 'used'}-${index}`}
              disabled={!card.edge_id}
              onClick={() => onOpenEdge?.(card.edge_id)}
            >
              <small>“{card.excerpt}”</small>
              {card.edge_id ? <em>플로우에서 보기 →</em> : null}
            </button>
          )}
        />

        <BriefSection
          title="무엇을 유보했는지"
          cards={deferred}
          emptyText="유보한 답이 없습니다."
          renderCard={(card, index) => (
            <button
              type="button"
              className="bordo-evidence-card is-deferred"
              key={`${card.edge_id ?? 'deferred'}-${index}`}
              disabled={!card.edge_id}
              onClick={() => onOpenEdge?.(card.edge_id)}
            >
              <small>“{card.excerpt}”</small>
              {/* `reason` 은 서버 코드다(예: `allow_schedule_change=false`).
                  화면에 그대로 찍지 않고 사람이 읽을 문장으로 바꾼다. */}
              <em>{deferReasonLabel(card.reason)}</em>
            </button>
          )}
        />
      </div>

      {/*
        시안 `576:5781` — 패널 맨 아래에 붙는 Bordo 입력창.

        스크롤 칸(`.briefing-scroll`) 뒤에 형제로 둔다. 안에 넣으면 브리핑을
        끝까지 내려야 입력창이 나타나서, **묻고 싶을 때마다 스크롤해야 한다.**
        `.briefing-panel` 이 세로 flex 라 이 자리에 두면 아래에 붙어 남고 위
        칸만 줄어든다.

        홈 화면의 그것과 같은 컴포넌트다 — 대화 목록·전송·답 기다리기가 이미
        붙어 있어서, 여기서 껍데기 입력창을 새로 만들면 **누르면 아무 일도 안
        나는 칸**이 하나 더 생긴다.
      */}
      <AgentDock inline />
    </aside>
  )
}
