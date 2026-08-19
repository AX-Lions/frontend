import { useMemo, useState } from 'react'

import { AgentDock } from '../home/AgentDock.jsx'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { icons } from './flowBoard.api'
import { FlowMetricBadge } from './FlowMetricBadge'
import { toneOf } from './flowBoard.data'
import { useParticipantFlow } from './useFlowBoardData'

/**
 * 노드 하나 · 화살표 하나를 눌렀을 때 열리는 우측 패널.
 *
 * 두 시안이 같은 뼈대를 쓴다.
 *
 *     601:9055  사람 · 대리인 — 주요 발언 / 개수 알약 / 전달한 내용 / 전달받은 내용
 *     601:10010 화살표       — 전달된 내용 (개수 알약 + 종류별 카드)
 *
 * 그래서 알약 줄(`ContentChips`)과 종류별 카드 묶음(`ContentGroup`)을 한 벌만
 * 두고 양쪽이 나눠 쓴다. 따로 만들면 한쪽만 고쳐져 같은 화면 안에서 카드 모양이
 * 갈린다.
 *
 * ## 예전에는 사람 패널이 통째로 비어 있었다
 *
 * "사람 스코프 엔드포인트가 없다" 는 이유로 두 자리 다 `Empty` 였다. 그 판단
 * 자체는 옳았지만 — 가짜를 컴포넌트에 박아 두면 API 가 붙었을 때 아무도
 * 눈치채지 못한다 — 고칠 자리를 잘못 골랐다. **값은 목 서버가 만들고**
 * (`mocks/data/flow.js` 의 `buildParticipantFlows`), 화면은 그것을 그리기만
 * 한다. 실서버에는 아직 그 경로가 없으므로 404 가 나고, 그때는 지금처럼
 * "아직 서버에 없습니다" 가 그대로 뜬다. 가짜와 빈 자리가 섞이지 않는다.
 */

const ATTENDANCE_LABEL = {
  PENDING: '참석 미정',
  PRESENT: '참석',
  ABSENT: '불참',
  DELEGATED: '대리 참석',
}

const SURFACE_LABEL = {
  SERVICE: '서비스',
  DISCORD: 'Discord',
}

/**
 * 두 패널이 같이 쓰는 껍데기.
 *
 * `search` 를 주면 제목 밑에 검색 칸이 붙고, `composer` 를 켜면 맨 아래에
 * Bordo 입력창이 붙는다. 둘 다 `Bordo 브리핑` 패널(`FlowBriefingSidebar`)이
 * 이미 쓰는 것과 **같은 클래스**다 — 세 패널이 같은 자리에서 번갈아 뜨는데
 * 머리와 발이 제각각이면 패널이 바뀔 때마다 화면이 덜컹거린다.
 */
function PanelShell({ children, composer = false, onClose, search, subtitle, title }) {
  return (
    <aside className="briefing-panel inspector-panel" aria-label={title}>
      <header className="briefing-header">
        <h2>{title}</h2>
        <button className="panel-close" type="button" aria-label="패널 닫기" data-tip="닫기" onClick={onClose}>
          ×
        </button>
        {subtitle ? <p className="inspector-subtitle">{subtitle}</p> : null}

        {search ? (
          <label className={search.value ? 'brief-search is-active' : 'brief-search'}>
            <img src={icons.search} alt="" />
            <input
              type="search"
              aria-label={search.label}
              placeholder="검색어를 입력하세요..."
              value={search.value}
              onChange={(event) => search.onChange(event.currentTarget.value)}
            />
          </label>
        ) : null}
      </header>

      <div className="briefing-scroll inspector-scroll">{children}</div>

      {/*
        패널 맨 아래에 붙는 Bordo 입력창. 스크롤 칸 **뒤에 형제로** 둔다 —
        안에 넣으면 끝까지 내려야 나타나서 묻고 싶을 때마다 스크롤해야 한다.
      */}
      {composer ? <AgentDock inline /> : null}
    </aside>
  )
}

/**
 * 개수 알약 줄.
 *
 * 고른 알약은 남색으로 차고(시안 `622:7321`), 그 종류의 카드 묶음에 테두리가
 * 생긴다. 지우는 필터가 아니라 **가리키는 표시**다 — 나머지를 감추면 이
 * 화살표에 무엇이 함께 오갔는지가 화면에서 사라진다.
 */
function ContentChips({ counts, onSelect, selected }) {
  if (!counts?.length) {
    return null
  }

  return (
    <div className="inspector-chip-row">
      {counts.map((count) => {
        const key = count.key ?? count.content_type
        const isOn = selected === key

        return (
          <button
            className={isOn ? 'inspector-chip is-on' : 'inspector-chip'}
            type="button"
            key={key}
            aria-pressed={isOn}
            onClick={() => onSelect(isOn ? null : key)}
          >
            <span>{count.label}</span>
            <b>{count.count}</b>
          </button>
        )
      })}
    </div>
  )
}

/** 종류 하나의 카드 묶음. 머리에 그 종류의 아이콘과 이름이 붙는다. */
function ContentGroup({ group, isSelected }) {
  return (
    <section className={isSelected ? 'inspector-group is-selected' : 'inspector-group'}>
      <header className="inspector-group-head">
        <FlowMetricBadge tone={toneOf(group.content_type)} />
        <span>{group.label}</span>
      </header>

      {group.items.map((item) => (
        <article className="inspector-item" key={item.id}>
          <strong>{item.title}</strong>
          {item.quote ? <p className="inspector-quote">“{item.quote}”</p> : null}
          <small>
            {item.counterpart ? <span className="inspector-who">{item.counterpart}</span> : null}
            {item.at_label}
          </small>
          {item.trace ? <AgentTrace trace={item.trace} /> : null}
        </article>
      ))}
    </section>
  )
}

/**
 * 대리인이 답을 만들기까지의 진행(시안 `601:9055` 의 `Bordo 생각 중…`).
 *
 * 접어 둔다. 이 서비스가 파는 것은 "없는 동안 대리인이 **무엇을 근거로**
 * 말했나" 라 근거를 볼 길이 있어야 하지만, 카드마다 일곱 줄이 늘 펼쳐져 있으면
 * 정작 무슨 말을 했는지가 밀려난다.
 */
function AgentTrace({ trace }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={open ? 'agent-trace is-open' : 'agent-trace'}>
      <button
        className="agent-trace-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        <span>{trace.title}</span>
        <i aria-hidden="true" />
      </button>

      {open ? (
        <ol className="agent-trace-steps">
          {trace.steps.map((step) => (
            <li className={`agent-trace-step is-${step.state.toLowerCase()}`} key={step.key}>
              <span className="agent-trace-label">{step.label}</span>
              {step.detail ? <span className="agent-trace-detail">{step.detail}</span> : null}
              {step.bullets?.length ? (
                <ul>
                  {step.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
              {step.note ? <span className="agent-trace-note">{step.note}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

/**
 * 사람 · 대리인 패널 (시안 `601:9055`).
 *
 * 참석 여부는 회의 응답(`participant`)에서, 주고받은 내용은 참여자 스코프
 * 응답에서 온다. 둘을 합치지 않는 이유는 앞의 것이 **회의에 속한 사실**이고
 * 뒤의 것이 **이 판(필터 포함)에 속한 사실**이라 갱신 시점이 다르기 때문이다.
 */
export function FlowNodePanel({ meetingId, node, onClose, participant }) {
  const isAgent = node.kind === 'AGENT'
  const attendance = participant ? ATTENDANCE_LABEL[participant.attendance] : null
  const detail = useParticipantFlow(meetingId, node.id)
  const body = detail.data

  const [selected, setSelected] = useState(null)

  return (
    <PanelShell
      /*
        `서재민` 이 아니라 `서재민의 회의록`.

        이름만 적혀 있으면 그 사람의 프로필처럼 보인다 — 실제 내용은 **이
        회의에서** 그 사람이 주고받은 것이라, 회의가 바뀌면 통째로 달라진다.
        제목이 그 범위를 말해야 패널만 보고도 무엇을 읽는지 안다.

        대리인은 이름이 이미 `유수인의 Bordo` 라 `의` 를 한 번 더 붙이면
        `유수인의 Bordo의 회의록` 이 된다. 그쪽은 조사를 뺀다.
      */
      title={isAgent ? `${node.name} 회의록` : `${node.name}의 회의록`}
      subtitle={isAgent ? 'AI 대리인' : (attendance ?? '참여자')}
      onClose={onClose}
    >
      {detail.loading && !body ? <Loading label="사람별 내역을 여는 중입니다…" /> : null}

      {/*
        실서버에는 아직 이 경로가 없다. 오류 문구 대신 "없다" 로 말한다 —
        고장과 미구현은 사용자가 할 수 있는 일이 다르다.
      */}
      {!detail.loading && !body ? (
        <>
          <section className="inspector-section">
            <h3>작업 한눈에 보기</h3>
            <Empty>사람별 작업 요약은 아직 서버에 없습니다.</Empty>
          </section>
          <section className="inspector-section">
            <h3>전달한 내용</h3>
            <Empty>사람별 전달 내역은 아직 서버에 없습니다.</Empty>
          </section>
        </>
      ) : null}

      {body ? (
        <>
          <section className="inspector-section">
            <h3>주요 발언</h3>
            {body.headline ? (
              <p className="inspector-headline">{body.headline}</p>
            ) : (
              // 대리인만 말한 사람이 여기 온다. 그 자체가 이 화면이 답하는
              // 질문("내가 없는 동안…")의 한 상태라, 빈 칸으로 두지 않는다.
              <Empty>이 회의에서 직접 한 발언이 없습니다.</Empty>
            )}
            <ContentChips counts={body.counts} selected={selected} onSelect={setSelected} />
          </section>

          <section className="inspector-section">
            <h3>전달한 내용</h3>
            {body.sent.length === 0 ? (
              <Empty>전달한 내용이 없습니다.</Empty>
            ) : body.sent.map((group) => (
              <ContentGroup
                group={group}
                isSelected={selected === group.content_type}
                key={`sent-${group.content_type}`}
              />
            ))}
          </section>

          <section className="inspector-section">
            <h3>전달받은 내용</h3>
            {body.received.length === 0 ? (
              <Empty>전달받은 내용이 없습니다.</Empty>
            ) : body.received.map((group) => (
              <ContentGroup
                group={group}
                isSelected={selected === group.content_type}
                key={`received-${group.content_type}`}
              />
            ))}
          </section>
        </>
      ) : null}

      {participant?.delegated ? (
        <p className="inspector-note">이 회의는 대리인이 대신 참석했습니다.</p>
      ) : null}
    </PanelShell>
  )
}

/**
 * 화살표 상세 (시안 `601:10010` · 고른 알약은 `622:7321`).
 *
 * ## 뱃지 하나가 아니라 화살표 전체를 읽는다
 *
 * 예전에는 누른 뱃지에 걸린 엣지만 열었다. 그런데 시안의 패널 머리에는
 * `의견 3 · 요청사항 5 · 변동사항 2` 가 **나란히** 있다 — 한 화살표에 무엇이
 * 함께 오갔는지를 보여 주는 자리다. 누른 것만 열면 그 줄을 그릴 수가 없고,
 * 옆 뱃지를 보려면 패널을 닫았다 다시 열어야 했다. 이제 화살표에 걸린 것을
 * 전부 읽고, 누른 뱃지는 **어느 묶음을 가리켜 열었는지**로만 쓴다.
 */
export function FlowEdgePanel({ arrow, count, direction, edges, onClose }) {
  const [selected, setSelected] = useState(count?.content_type ?? null)
  const [keyword, setKeyword] = useState('')
  const trimmed = keyword.trim().toLowerCase()

  /*
    엣지 상세를 종류별로 묶는다.

    순서는 화살표의 `counts` 를 따른다 — 서버가 정한 종류 순서라, 여기서 다시
    정렬하면 판의 뱃지 순서와 패널의 카드 순서가 갈린다.
  */
  const groups = useMemo(() => {
    const rows = edges.data ?? []
    return (arrow?.counts ?? [])
      .map((entry) => ({
        content_type: entry.content_type,
        label: entry.label,
        items: rows
          .filter(({ edge }) => edge.content_type === entry.content_type)
          .map(({ edge, agenda, document, delivery_context: says }) => ({
            id: edge.id,
            // 카드 제목은 "무엇에 대한 이야기였나" 다. 안건이 그 자리이고,
            // 안건이 없는 엣지는 붙은 문서가 대신한다.
            title: agenda?.title ?? document?.title ?? edge.label,
            quote: (says ?? [])[0]?.utterance ?? '',
            counterpart: edge.surface ? (SURFACE_LABEL[edge.surface] ?? edge.surface) : '',
            at_label: edge.at_label ?? '',
            source: edge.source_url ? { url: edge.source_url, label: edge.source || '원본' } : null,
          }))
          // 제목과 인용문으로 거른다. 창구(`Discord`)·시각은 뺀다 — 그것까지
          // 넣으면 `1` 한 글자에 시각이 걸려 아무 카드나 남는다.
          .filter((item) => !trimmed
            || `${item.title} ${item.quote}`.toLowerCase().includes(trimmed)),
      }))
      .filter((group) => group.items.length > 0)
  }, [arrow, edges.data, trimmed])

  return (
    <PanelShell
      /*
        제목이 **화살표의 방향**이다(시안 `601:9343` — `유수인 → 서재민`).
        `전달된 내용` 은 그 아래 묶음의 이름으로 내려간다. 어느 화살표를
        눌렀는지가 제목에 없으면, 선이 여럿 겹친 자리에서 방금 무엇을 열었는지
        패널만 보고는 알 수 없다.
      */
      title={direction}
      composer
      search={{ label: '전달된 내용 검색', value: keyword, onChange: setKeyword }}
      onClose={onClose}
    >
      {edges.loading && !edges.data ? <Loading label="화살표를 여는 중입니다…" /> : null}
      {edges.error && !edges.data ? <LoadError error={edges.error} onRetry={edges.reload} /> : null}

      {edges.data ? (
        <section className="inspector-section">
          <h3>전달된 내용</h3>
          <ContentChips counts={arrow?.counts ?? []} selected={selected} onSelect={setSelected} />

          {groups.length === 0 ? (
            trimmed
              ? <Empty>「{keyword.trim()}」에 걸리는 내용이 없습니다.</Empty>
              : <Empty>이 화살표에 걸린 내용을 불러오지 못했습니다.</Empty>
          ) : groups.map((group) => (
            <ContentGroup
              group={group}
              isSelected={selected === group.content_type}
              key={group.content_type}
            />
          ))}
        </section>
      ) : null}
    </PanelShell>
  )
}
