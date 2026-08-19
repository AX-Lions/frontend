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
 * 필터 알약을 **그려 낼 묶음에서 직접 만든다.**
 *
 * 예전에는 서버가 준 `counts` 를 그대로 알약으로 그렸다. 그런데 사람 패널의
 * `counts` 는 **보낸 것에서만** 세어져서, 받기만 한 종류는 알약이 아예 없었다.
 * 서재민은 `의견`·`변동사항`·`기타` 를 받았는데 보낸 적이 없어 그 셋을 거를
 * 단추가 없었고, 다른 알약을 하나라도 켜는 순간 **그 세 묶음이 화면에서 사라진
 * 뒤 다시 부를 방법이 없었다.** 숫자도 어긋나서 `일정 1` 을 누르면 카드가 석
 * 장 떴다.
 *
 * 서버 쪽 개수를 고치는 것만으로는 같은 결함이 다시 난다 — 세는 곳과 그리는
 * 곳이 다르면 언젠가 또 갈린다. 그래서 **알약 목록과 숫자를 화면이 그릴 묶음
 * 하나에서 뽑는다.** 이렇게 두면 "알약 하나 = 거를 수 있는 묶음 하나" 와
 * "알약의 숫자 = 눌렀을 때 펼쳐지는 카드 수" 가 어긋날 자리가 없다.
 *
 * 순서는 서버가 정한 `counts` 순서를 따르고(판의 뱃지 순서와 같다), 거기 없는
 * 종류는 뒤에 잇는다.
 */
function chipsFromGroups(counts, groups) {
  const total = new Map()
  const label = new Map()
  groups.forEach((group) => {
    total.set(group.content_type, (total.get(group.content_type) ?? 0) + group.items.length)
    label.set(group.content_type, group.label)
  })

  const ordered = []
  const push = (type) => {
    if (total.has(type) && !ordered.includes(type)) {
      ordered.push(type)
    }
  }
  ;(counts ?? []).forEach((count) => push(count.content_type))
  total.forEach((_, type) => push(type))

  return ordered.map((type) => ({
    key: type,
    content_type: type,
    label: label.get(type),
    count: total.get(type),
  }))
}

/**
 * 개수 알약 줄.
 *
 * 고른 알약은 남색으로 차고(시안 `622:7321`), **고른 종류의 카드 묶음만 남는다.**
 *
 * 예전에는 고른 종류에 테두리만 둘렀다. 나머지를 감추면 이 화살표에 무엇이
 * 함께 오갔는지가 화면에서 사라진다는 이유였는데, 그 자리는 이미 이 알약 줄이
 * 지키고 있다 — 걸러도 알약은 그대로 남아 개수를 말한다. 반대로 눌러도 목록이
 * 그대로인 버튼은 고장 난 것으로 읽힌다.
 *
 * 여러 개를 같이 고를 수 있고 보이는 것은 그 **합집합**이다. `요청사항` 과
 * `변동사항` 을 나란히 놓고 읽는 것이 이 패널에서 가장 흔한 읽기라, 하나만
 * 고르게 하면 두 번 눌러 두 번 읽어야 한다.
 *
 * `stats` 는 거를 수 없는 통계(`발언`)다. 필터 알약과 한 줄에 서지만 하는 일이
 * 다르므로 만드는 곳도 다르다.
 */
function ContentChips({ chips = [], onToggle, selected, stats = [] }) {
  if (!chips.length && !stats.length) {
    return null
  }

  return (
    <div className="inspector-chip-row">
      {stats.map((count) => (
        /*
          `발언` 처럼 대응하는 카드 묶음이 없는 칸. 발언은 엣지가 아니라 엣지
          **안에서** 입을 연 횟수라 `content_type` 자체가 붙지 않는다. 이것까지
          필터로 만들면 누르는 순간 걸리는 묶음이 하나도 없어 패널이 통째로
          빈다. 그래서 누를 수 없는 통계 표시로 그린다 — 버튼처럼 생겼는데 아무
          일도 안 일어나는 것보다, 처음부터 버튼이 아닌 편이 정직하다.
        */
        <span className="inspector-chip is-static" key={count.key ?? count.label}>
          <span>{count.label}</span>
          <b>{count.count}</b>
        </span>
      ))}

      {chips.map((count) => {
        const key = count.key ?? count.content_type

        const isOn = selected.has(count.content_type)

        return (
          <button
            className={isOn ? 'inspector-chip is-on' : 'inspector-chip'}
            type="button"
            key={key}
            aria-pressed={isOn}
            onClick={() => onToggle(count.content_type)}
          >
            <span>{count.label}</span>
            <b>{count.count}</b>
          </button>
        )
      })}
    </div>
  )
}

/**
 * 고른 알약에 걸리는 묶음만 남긴다. 아무것도 안 골랐으면 전부 남는다.
 *
 * 흐리게 하지 않고 아예 빼는 이유는 자리 때문이다. 흐린 카드도 높이를
 * 차지해서, 다섯 종류가 오간 화살표에서는 고른 것을 보려고 여전히 스크롤해야
 * 한다. 그러면 거른 보람이 없다.
 */
function filterGroups(groups, selected) {
  if (selected.size === 0) {
    return groups
  }
  return groups.filter((group) => selected.has(group.content_type))
}

/**
 * 알약 하나를 켜고 끈다.
 *
 * `Set` 을 제자리에서 고치지 않고 **새로 만든다.** 같은 객체를 돌려주면
 * 리액트는 상태가 그대로인 줄 알고 다시 그리지 않아, 눌러도 화면이 안 바뀐다.
 */
function toggleIn(selected, contentType) {
  const next = new Set(selected)
  if (!next.delete(contentType)) {
    next.add(contentType)
  }
  return next
}

/**
 * 카드에 **회의 전반 순번**을 붙이고 그 순서로 세운다.
 *
 * 좌측 `시간순 인덱스` 의 몇 번이 이 카드인지가 번호로 이어진다. 두 자리가
 * 같은 번호를 쓰지 않으면 목록에서 찾은 것을 패널에서 다시 눈으로 훑어야 해서,
 * 목록이 목차 노릇을 못 한다.
 *
 * 번호를 모르는 항목(`seq` 가 null)은 뒤로 보내되 **들어온 차례를 유지한다** —
 * 서버가 준 순서가 그나마 근거 있는 순서다. `sort` 가 안정 정렬이라 같은
 * 값끼리는 원래 순서가 그대로 남는다.
 */
function orderBySeq(items, seqOf) {
  return items
    .map((item) => ({ ...item, seq: seqOf(item.edge_id) ?? null }))
    .sort((a, b) => {
      if (a.seq === null || b.seq === null) {
        return (a.seq === null ? 1 : 0) - (b.seq === null ? 1 : 0)
      }
      return a.seq - b.seq
    })
}

/**
 * 종류 하나의 카드 묶음. 머리에 그 종류의 아이콘과 이름이 붙는다.
 *
 * 예전에는 고른 알약에 걸리면 `is-selected` 테두리를 둘렀다. 이제 고른 것만
 * 보이므로 그 테두리가 가리킬 대상이 없다 — **보이는 것이 곧 고른 것**이고,
 * 전부 보일 때는 아무것도 안 고른 것이다. 어느 쪽이든 화면의 모든 묶음이
 * 같은 상태라, 테두리는 정보를 하나도 싣지 못한 채 선만 하나 더 그린다.
 */
function ContentGroup({ group, seqOf }) {
  const items = useMemo(() => orderBySeq(group.items, seqOf), [group.items, seqOf])

  return (
    <section className="inspector-group">
      <header className="inspector-group-head">
        <FlowMetricBadge tone={toneOf(group.content_type)} />
        <span>{group.label}</span>
      </header>

      {items.map((item) => (
        <article className="inspector-item" key={item.id}>
          {/*
            번호와 제목은 **같은 줄**에 선다. 번호를 윗줄에 따로 두면 카드마다
            줄이 하나씩 늘어 열 장짜리 묶음이 화면 두 배가 된다. 순번을 모르는
            항목은 번호 없이 제목만 그린다 — 없는 번호를 지어내면 좌측 목록과
            어긋나고, 그 어긋남은 눈으로 잡히지 않는다.
          */}
          <span className="inspector-item-head">
            {item.seq ? <b className="inspector-item-seq">{item.seq}</b> : null}
            <strong>{item.title}</strong>
          </span>
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
export function FlowNodePanel({ meetingId, node, onClose, participant, seqOf = () => null }) {
  const isAgent = node.kind === 'AGENT'
  const attendance = participant ? ATTENDANCE_LABEL[participant.attendance] : null
  const detail = useParticipantFlow(meetingId, node.id)
  const body = detail.data

  // 사람 패널은 판에서 사람을 눌러 연다 — 어느 종류를 보러 왔는지 알 길이
  // 없으므로 빈 채로 시작한다. 화살표 패널만 뱃지라는 단서를 갖는다.
  const [selected, setSelected] = useState(() => new Set())
  const toggle = (contentType) => setSelected((was) => toggleIn(was, contentType))

  /*
    알약은 **두 구역을 합쳐서** 만든다.

    이 줄은 `전달한 내용` 과 `전달받은 내용` 을 함께 거르는 필터라, 한쪽에만
    있는 종류를 빠뜨리면 그 묶음은 걸러 낼 수도 되돌릴 수도 없는 채로 화면에서
    사라진다. 사용자가 이 패널에 요구한 것이 **"그 인물에게 전달된 내용이
    버튼으로 뜨고, 누르면 그 종류만 보인다"** 인데, 받은 것에 단추가 없으면
    그 말이 절반만 성립한다.
  */
  const allGroups = useMemo(
    () => [...(body?.sent ?? []), ...(body?.received ?? [])],
    [body],
  )
  const chips = useMemo(() => chipsFromGroups(body?.counts, allGroups), [body, allGroups])
  // 거를 수 없는 통계(`발언`). 서버만 아는 값이라 여기서 만들어 낼 수 없다.
  const stats = useMemo(() => (body?.counts ?? []).filter((c) => !c.content_type), [body])

  const sent = useMemo(() => filterGroups(body?.sent ?? [], selected), [body, selected])
  const received = useMemo(() => filterGroups(body?.received ?? [], selected), [body, selected])

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
            <ContentChips chips={chips} stats={stats} selected={selected} onToggle={toggle} />
          </section>

          <section className="inspector-section">
            <h3>전달한 내용</h3>
            {/*
              걸러서 빈 것과 애초에 없는 것을 다른 말로 적는다. 알약을 고른
              채로 `전달한 내용이 없습니다` 를 보면, 이 사람이 아무것도 안
              보낸 줄 안다 — 알약을 끄면 다시 나타나는데도.

              알약 개수는 **보낸 것**에서만 세므로, 고른 종류가 받은 쪽에는
              하나도 없는 일이 흔하다. 그 자리에서 특히 잘 헷갈린다.
            */}
            {sent.length === 0 ? (
              <Empty>{selected.size ? '고른 종류로 전달한 내용이 없습니다.' : '전달한 내용이 없습니다.'}</Empty>
            ) : sent.map((group) => (
              <ContentGroup
                group={group}
                seqOf={seqOf}
                key={`sent-${group.content_type}`}
              />
            ))}
          </section>

          <section className="inspector-section">
            <h3>전달받은 내용</h3>
            {received.length === 0 ? (
              <Empty>{selected.size ? '고른 종류로 전달받은 내용이 없습니다.' : '전달받은 내용이 없습니다.'}</Empty>
            ) : received.map((group) => (
              <ContentGroup
                group={group}
                seqOf={seqOf}
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
export function FlowEdgePanel({ arrow, count, direction, edges, onClose, seqOf = () => null }) {
  /*
    뱃지를 눌러 열었으면 **그 종류 하나가 켜진 채로** 시작한다 — 누른 것을
    보러 온 것이 분명한데 전부 펼쳐 놓으면 다시 한 번 눌러야 한다. 선을 눌러
    열었으면 단서가 없으므로 빈 `Set` 이고, 그때는 전부 보인다.

    첫 상태는 처음 만들어질 때 한 번만 읽힌다. 화살표가 바뀌어도 이 값이
    다시 반영되지 않는 것은 `FlowBoardPage` 가 `key` 로 패널을 새로 만들어
    해결한다 — 그쪽 주석 참고.
  */
  const [selected, setSelected] = useState(
    () => new Set(count?.content_type ? [count.content_type] : []),
  )
  const toggle = (contentType) => setSelected((was) => toggleIn(was, contentType))
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
            // 여기서는 `id` 가 곧 엣지 id 지만 `edge_id` 로도 적어 둔다.
            // 사람 패널 쪽 항목은 `{엣지}::{보냄|받음}` 이라 `id` 가 엣지 id 가
            // 아니고, 순번을 찾는 `seqOf` 는 두 경로에 하나뿐이다. 이름이
            // 갈리면 한쪽만 번호가 붙는데, 그 상태가 화면에서는 "번호를 모르는
            // 항목" 과 똑같이 보여 눈으로 잡히지 않는다.
            edge_id: edge.id,
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

  const visible = useMemo(() => filterGroups(groups, selected), [groups, selected])

  /*
    알약도 **검색을 거친 묶음**에서 만든다.

    화살표의 `counts` 를 그대로 그리면 `토큰` 을 검색해 카드가 한 장도 안 남은
    종류의 알약이 `의견 3` 이라고 적힌 채 남는다. 눌러도 아무것도 안 나오는
    단추라, 검색이 고장 난 것으로 읽힌다.
  */
  const chips = useMemo(() => chipsFromGroups(arrow?.counts, groups), [arrow, groups])

  return (
    <PanelShell
      /*
        제목이 **화살표의 방향**이다(시안 `601:9343` — `유수인 → 서재민`).
        `전달된 내용` 은 그 아래 묶음의 이름으로 내려간다. 어느 화살표를
        눌렀는지가 제목에 없으면, 선이 여럿 겹친 자리에서 방금 무엇을 열었는지
        패널만 보고는 알 수 없다.
      */
      title={direction}
      /*
        선 하나가 한 쌍의 모든 전달을 뭉뚱그리던 것을 `flowLayout` 이 쌍마다
        최대 둘로 — 사람이 직접 나른 회색, 대리인이 나른 주황 — 갈랐다. 판이
        그 둘을 색으로 구분하는데 패널 제목이 똑같으면, 주황 선을 눌러 놓고도
        지금 보는 것이 대리인이 나른 쪽인지 알 수 없다. 판과 패널이 같은
        이야기를 해야 한다는 것이 이 화면의 원칙이다(`FlowCanvas.jsx` 위 주석).
      */
      subtitle={arrow?.via_agent ? 'AI 대리인이 전달' : null}
      composer
      search={{ label: '전달된 내용 검색', value: keyword, onChange: setKeyword }}
      onClose={onClose}
    >
      {edges.loading && !edges.data ? <Loading label="화살표를 여는 중입니다…" /> : null}
      {edges.error && !edges.data ? <LoadError error={edges.error} onRetry={edges.reload} /> : null}

      {edges.data ? (
        <section className="inspector-section">
          <h3>전달된 내용</h3>
          <ContentChips chips={chips} stats={[]} selected={selected} onToggle={toggle} />

          {/*
            빈 이유를 셋으로 나눠 적는다. 검색어 · 고른 알약 · 정말 아무것도
            없음은 사용자가 할 일이 다르다 — 앞의 둘은 지우면 되지만 마지막은
            지울 것이 없다. 한 문구로 뭉치면 지울 것을 못 찾는다.
          */}
          {visible.length === 0 ? (
            <Empty>
              {trimmed
                ? `「${keyword.trim()}」에 걸리는 내용이 없습니다.`
                : selected.size
                  ? '고른 종류에 걸리는 내용이 없습니다.'
                  : '이 화살표에 걸린 내용을 불러오지 못했습니다.'}
            </Empty>
          ) : visible.map((group) => (
            <ContentGroup
              group={group}
              seqOf={seqOf}
              key={group.content_type}
            />
          ))}
        </section>
      ) : null}
    </PanelShell>
  )
}
