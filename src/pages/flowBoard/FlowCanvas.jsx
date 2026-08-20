import { Fragment, useState } from 'react'

import { FlowMetricBadge } from './FlowMetricBadge'
import { toneOf } from './flowBoard.data'

/**
 * 캔버스.
 *
 * 이전에는 노드 셋과 연결선 셋이 리터럴이었다 —
 * `<ProfileNode className="top-left" name="유수인" />`, `<path d="M175 376 H589" />`.
 * 자리는 CSS 절대좌표, 선은 그 좌표에 맞춰 손으로 계산한 값이었다. 이제
 * 모양은 전부 `flowLayout` 이 계산하고 여기는 **그리기만 한다.**
 *
 * ## 선 모양 (`576:4990`)
 *
 * 굵기와 양 끝은 하나다 — 1px 실선, 출발 쪽에 작은 점, 도착 쪽에 속 빈
 * 화살촉. 색만 **한쪽이라도 대리인·서버가 낀 선**을 갈라 준다.
 *
 *     주황 `#FF9D42`  AI 가 나른 것 (시안 토큰 `AI/포인트컬러`)
 *     회색 `#9CA3AF`  사람과 사람 사이 (시안 토큰 `테두리/플로우화살표`)
 *
 * 이 서비스가 파는 것이 "내가 없는 동안 대리인이 대신 움직였다" 라, 그 구분이
 * 판에서 한눈에 잡혀야 한다. 대리인 노드의 주황 테두리(`576:5990`)와 같은
 * 색이라 선과 노드가 같은 이야기를 한다.
 */

/**
 * 선 색.
 *
 * `on` 은 고른 선이다. 같은 색을 그대로 쓰면 무엇을 골랐는지 굵기 0.6px 로만
 * 말하게 되므로 한 단계 진하게 내린다 — **색조는 안 바꾼다.** 바꾸면 고른
 * 순간 사람 선이 AI 선처럼 보인다.
 */
const LINK_TONES = {
  human: { base: '#9ca3af', on: '#4b5563' },
  ai: { base: '#ff9d42', on: '#d97a16' },
}

const toneOfLink = (link) => (link.isAi ? 'ai' : 'human')

/** 뱃지가 접혀도 이만큼은 실제 알약으로 보인다. 나머지만 `···` 뒤에 숨는다. */
const COLLAPSED_PEEK_COUNT = 2

/** 마커 id 꼬리표. `기본 사람` 만 꼬리표가 없다 — 가장 흔한 선이라 짧게 둔다. */
function markerSuffix(tone, state) {
  return `${tone === 'ai' ? '-ai' : ''}${state === 'on' ? '-on' : ''}`
}

/**
 * `임수연의 Bordo` → `임수연의`.
 *
 * 시안이 이름을 두 줄로 끊는다. 서버가 주는 것은 붙은 한 문장뿐이라 화면이
 * 자른다 — 규칙(`{이름}의 Bordo`)이 서버 쪽에 박혀 있어 뒤가 항상 `Bordo` 다.
 * 규칙에 안 맞는 이름이 오면 자르지 않고 통째로 둔다.
 */
function ownerLabel(name) {
  const trimmed = (name ?? '').trim()
  return trimmed.endsWith(' Bordo') ? trimmed.slice(0, -' Bordo'.length) : trimmed
}

function FlowNode({ node, isMine, isSelected, onSelect }) {
  const classNames = ['flow-node', `is-${(node.kind ?? 'user').toLowerCase()}`]
  if (isSelected) {
    classNames.push('is-selected')
  }
  if (isMine) {
    classNames.push('is-mine')
  }

  return (
    <button
      className={classNames.join(' ')}
      type="button"
      style={{ left: node.x - node.r, top: node.y - node.r, width: node.r * 2, height: node.r * 2 }}
      aria-pressed={isSelected}
      /*
        판 드래그가 먼저 잡아채면 클릭이 안 난다. 이전 캔버스에서 노드를 눌러도
        아무 일이 없던 것이 이 때문이었다 — 핸들러가 없기도 했지만, 붙였어도
        포인터가 보드로 흘러가 드래그가 시작됐다.
      */
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => onSelect(node)}
    >
      {/*
        대리인은 사진이 없다(시안 `576:5990`).

        `{이름}의 Bordo` 는 사람이 아니라 그 사람을 대신해 움직인 프로그램이라,
        주인 얼굴을 씌우면 판에서 **사람이 직접 말한 것처럼** 읽힌다. 이 화면이
        답하는 질문이 "내가 없는 동안 무슨 일이 있었지" 이므로 그 구별이
        핵심이다. 그래서 흰 원 + 주황 테두리 + 반짝임 아이콘으로 따로 그리고,
        이름은 `임수연의 / Bordo` 두 줄로 끊는다.
      */}
      {node.kind === 'AGENT' ? (
        <span className="flow-node-agent">
          <img className="flow-node-spark" src="/icons/BordoSparkle.svg" alt="" />
          <span className="flow-node-agent-name" title={node.name}>
            <span className="flow-node-agent-owner">{ownerLabel(node.name)}</span>
            <b>Bordo</b>
          </span>
        </span>
      ) : (
        <>
          {node.avatar_url ? (
            <img src={node.avatar_url} alt="" />
          ) : (
            <span className="flow-node-initial" aria-hidden="true">
              {(node.name ?? '?').trim().slice(0, 1)}
            </span>
          )}
          <span className="flow-node-name">{node.name}</span>
        </>
      )}
    </button>
  )
}

/*
  `showRecency` 를 없앴다.

  좌측 `필터링 > 시간순` 체크박스가 인덱스에 합쳐지면서 삭제됐고, 시간순은 이제
  이 화면의 **기본 전제**다 — 끌 수 있는 것이 아니다. 끌 수 없는 것을 끌 수 있는
  척 받아 두면 다음 사람이 `false` 를 넘길 자리를 찾다가 켜지지 않는 스위치를
  하나 더 만든다. 그래서 `link.opacity` 를 늘 적용한다.
*/
export function FlowCanvas({
  activeBadgeId,
  className = '',
  highlightedEdgeIds,
  layout,
  myNodeId,
  onBadgeSelect,
  onLinkSelect,
  onNodeSelect,
  selectedArrowId,
  selectedNodeId,
  style,
  children,
}) {
  const { stage, links, badges, nodes } = layout

  /*
    노드와 겹치는 뱃지 묶음을 눌러야 펼치는 요약 단추로 접는다.

    `flowLayout.js` 가 자리를 찾을 때 "화살표에 붙어 있는 것" 을 "아무것과도
    안 겹치는 것" 보다 우선한다(그쪽 주석 참고) — 아주 촘촘한 판에서는 그
    타협의 대가로 알약 묶음이 옆 노드 원과 겹친다. 알약을 펼쳐 둔 채로
    두면 얼굴이 가려지므로, `badge.crampedNode` 가 선 자리에서만 이렇게
    접는다 — 나머지 뱃지는 지금처럼 그대로 펼쳐 보인다.
  */
  const [expandedBadgeIds, setExpandedBadgeIds] = useState(() => new Set())
  const expandBadge = (badgeId) => setExpandedBadgeIds((current) => new Set(current).add(badgeId))

  // 인덱스(안건)를 고르면 그 안건에 걸린 화살표만 남기지 않고 **나머지를
  // 흐린다.** 지우면 판의 모양이 바뀌어 "무엇이 강조됐는지" 를 비교할 수 없다.
  //
  // 판정은 **알약 하나 단위**로 내린다. 화살표 하나가 `의견 3 · 요청사항 5 ·
  // 변동사항 2` 를 같이 나르는데 고른 줄이 그중 `요청사항` 한 건이면, 화살표째
  // 진하게 두는 것은 "이 화살표가 강조됐다" 까지만 말하고 **무엇이 강조된
  // 것인지는 말하지 않는다.** 인덱스를 고르는 이유가 그 "무엇" 이라, 거기서
  // 멈추면 고른 보람이 없다.
  const isCountHighlighted = (count) => !highlightedEdgeIds
    || (count.edge_ids ?? []).some((edgeId) => highlightedEdgeIds.has(edgeId))

  // 화살표 판정은 그 위에 얹는다 — **알약이 하나라도 걸리면** 걸린 화살표다.
  // 결과는 예전과 같지만, 선 쪽과 뱃지 쪽이 같은 판정을 각자 내리고 있으면
  // 나중에 한쪽만 고쳐져 선과 뱃지가 서로 다른 말을 한다. 걸림을 정하는 자리는
  // 위의 `isCountHighlighted` 하나뿐이다.
  //
  // 앞의 `!highlightedEdgeIds` 는 판정이 아니라 빈 배열 대비다 — 알약이 하나도
  // 없는 화살표도 아무것도 안 고른 평소에는 진해야 한다.
  const isHighlighted = (arrow) => !highlightedEdgeIds
    || (arrow.counts ?? []).some(isCountHighlighted)

  return (
    <div className={`board-stage ${className}`} style={{ ...style, width: stage.width, height: stage.height }}>
      <svg
        className="connector-layer"
        width={stage.width}
        height={stage.height}
        viewBox={`0 0 ${stage.width} ${stage.height}`}
        aria-hidden="true"
      >
        <defs>
          {/*
            선의 양 끝 (`576:4990`).

            출발 쪽은 지름 5.3px 짜리 점, 도착 쪽은 **속을 채우지 않은** 직각
            화살촉이다. 채운 삼각형을 쓰면 1px 선 끝에 검은 덩어리가 붙어
            선보다 촉이 먼저 읽힌다.

            `markerUnits="userSpaceOnUse"` 가 필요하다. 기본값
            (`strokeWidth`)이면 촉 크기가 선 굵기를 따라가는데, 선이 1px 라
            촉이 시안의 1/4 로 쪼그라든다.

            색깔별로 **네 벌**을 만든다(사람·AI × 기본·고름). 마커는 자기를
            쓰는 선의 `stroke` 를 물려받지 않고 안에 적힌 색으로 그려지기
            때문이다 — 한 벌로 두면 주황 선 끝에 회색 촉이 붙는다.
          */}
          {Object.entries(LINK_TONES).flatMap(([tone, colors]) =>
            Object.entries(colors).map(([state, color]) => {
              const suffix = markerSuffix(tone, state)
              const on = state === 'on'

              return (
                <Fragment key={suffix}>
                  <marker
                    id={`flow-arrow-tail${suffix}`}
                    markerUnits="userSpaceOnUse"
                    markerWidth={on ? 10 : 8}
                    markerHeight={on ? 10 : 8}
                    refX={on ? 5 : 4}
                    refY={on ? 5 : 4}
                    orient="auto"
                  >
                    <circle
                      cx={on ? 5 : 4}
                      cy={on ? 5 : 4}
                      r={on ? 3.2 : 2.67}
                      fill={color}
                    />
                  </marker>
                  <marker
                    id={`flow-arrow-head${suffix}`}
                    markerUnits="userSpaceOnUse"
                    markerWidth={on ? 14 : 12}
                    markerHeight={on ? 14 : 12}
                    refX={on ? 11 : 10}
                    refY={on ? 7 : 6}
                    orient="auto"
                  >
                    <path
                      d={on ? 'M6.5 2.5 L11 7 L6.5 11.5' : 'M6 2 L10 6 L6 10'}
                      fill="none"
                      stroke={color}
                      strokeWidth={on ? 1.4 : 1}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </marker>
                </Fragment>
              )
            }))}
        </defs>

        {/*
          재생 중에는 아직 안 온 선을 아예 안 그린다.

          흐리게 두는 방법도 있었지만, 이 화면은 **안 보이는 것과 없는 것을
          구별해서 보여 주는** 자리라 "아직 일어나지 않은 일" 을 옅게 그려 두면
          이미 일어난 것과 같은 층위로 읽힌다. 누를 자리(`flow-link-hit`)까지
          같이 빼야 한다 — 안 보이는 선이 눌려 패널이 열리면 판보다 패널이 앞선
          이야기를 한다.

          `layout` 이 배열에서 빼지 않고 `isVisible` 로만 표시하는 이유는
          `flowLayout` 의 ★ 주석에 있다(기하가 흔들리면 안 된다).
        */}
        {links.filter((link) => link.isVisible !== false).map((link) => {
          const lit = isHighlighted(link.arrow)
          const picked = link.arrowId === selectedArrowId
          const tone = toneOfLink(link)

          return (
            <g className="flow-link-group" key={link.id}>
              {/*
                눈에 안 보이는 굵은 선. 누를 자리를 넓힌다.

                보이는 선이 1px 라 그것만 누르게 두면 **거의 못 누른다** —
                포인터가 1px 위에 정확히 얹혀야 한다. 시안(`601:9343`)은
                화살표를 눌러 오른쪽 패널을 여는 화면이므로, 눌리는 폭과
                그려지는 폭을 따로 둔다.
              */}
              <path
                className="flow-link-hit"
                d={link.d}
                onClick={() => onLinkSelect?.(link)}
                onPointerDown={(event) => event.stopPropagation()}
              />
              <path
                className={[
                  'flow-link',
                  lit ? '' : 'is-dimmed',
                  picked ? 'is-selected' : '',
                ].filter(Boolean).join(' ')}
                d={link.d}
                /*
                  선 색을 여기서 준다. 마커(점·촉)는 CSS 의 `stroke` 를
                  물려받지 않고 자기 안에 적힌 색으로 그려지므로, 색을 CSS 에
                  두면 **선만 진해지고 양 끝은 회색으로 남는다.** 한 표를
                  선과 마커 양쪽이 쓰는 편이 어긋날 자리가 없다.
                */
                stroke={LINK_TONES[tone][picked ? 'on' : 'base']}
                markerStart={`url(#flow-arrow-tail${markerSuffix(tone, picked ? 'on' : 'base')})`}
                markerEnd={`url(#flow-arrow-head${markerSuffix(tone, picked ? 'on' : 'base')})`}
                /*
                  진하기를 **늘** 적용한다. 서버가 최근일수록 1 에 가까운 값을
                  준다. 한때는 `시간순` 을 켰을 때만 걸었는데, 그 체크박스가
                  인덱스에 합쳐져 사라지면서 늘 켜져 있는 상태가 됐다.

                  고른 선은 그 규칙에서 뺀다 — 오래된 선을 골랐을 때 흐린 채로
                  남으면 무엇을 골랐는지 안 보인다.
                */
                opacity={picked ? 1 : (lit ? link.opacity : 0.14)}
              />
            </g>
          )
        })}
      </svg>

      {children}

      {nodes.map((node) => (
        <FlowNode
          key={node.id}
          node={node}
          isMine={node.id === myNodeId}
          isSelected={node.id === selectedNodeId}
          onSelect={onNodeSelect}
        />
      ))}

      {badges.map((badge) => {
        const lit = isHighlighted(badge.arrow)
        const counts = badge.arrow.counts ?? []
        const collapsed = badge.crampedNode && !expandedBadgeIds.has(badge.id)
        // 접혀도 알약 하나 둘은 그대로 보인다 — "..." 뒤에 전부 숨기면 무엇을
        // 나르는 화살표인지조차 안 보인다. 나머지만 "..." 로 묶는다.
        const peekCounts = collapsed ? counts.slice(0, COLLAPSED_PEEK_COUNT) : counts
        const hiddenCount = collapsed ? counts.length - peekCounts.length : 0

        return (
          <div
            className={[
              'flow-badge-group',
              `is-${badge.axis}`,
              badge.isSelf ? 'is-self' : '',
              lit ? '' : 'is-dimmed',
              collapsed ? 'is-collapsed' : '',
            ].filter(Boolean).join(' ')}
            key={badge.id}
            /*
              선과 나란히 눕힌다. `translate` 가 `rotate` 보다 **앞에** 와야
              한다 — 뒤에 두면 돌아간 좌표계에서 절반을 물러나므로 묶음이
              선 옆이 아니라 엉뚱한 데로 간다.
            */
            style={{
              left: badge.x,
              top: badge.y,
              transform: `translate(-50%, -50%) rotate(${badge.angle ?? 0}deg)`,
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {peekCounts.map((count) => {
              const badgeId = `${badge.id}::${count.content_type}`
              /*
                안 걸린 알약은 **지우지 않고 흐리게 둔다.**

                그 화살표가 원래 무엇을 나르는지가 계속 보여야 강조된 것이 전체
                중 어느 하나인지 읽힌다 — 빼 버리면 `요청사항 5` 만 남아 마치 그
                화살표가 요청사항만 나른 것처럼 보인다. 선을 지우지 않고 흐리기만
                하는 것과 같은 이유다.

                `is-dimmed` 를 돌려쓰지 않는다. 그쪽은 "이 화살표는 지금 이야기와
                무관하다" 이고 이쪽은 "이 화살표에 같이 실렸지만 지금 고른 것은
                아니다" 라, 말이 다르면 흐린 정도도 달라야 한다.

                걸린 묶음 안에서만 쓴다. 묶음째 흐린(`is-dimmed`) 위에 또 얹으면
                두 번 흐려져 그 화살표가 무엇을 나르던 것인지가 아예 안 읽힌다.
              */
              const muted = lit && !isCountHighlighted(count)
              return (
                <button
                  /*
                    `is-active`(누른 알약)와 `is-muted`(안 고른 알약)는 별개라
                    동시에 붙을 수 있다. 삼항으로 이어 붙이면 하나가 다른 하나를
                    지우므로 `flow-link` 와 같은 방식으로 모아 붙인다.
                  */
                  className={[
                    'flow-badge',
                    activeBadgeId === badgeId ? 'is-active' : '',
                    muted ? 'is-muted' : '',
                  ].filter(Boolean).join(' ')}
                  type="button"
                  key={badgeId}
                  // 서버가 만든 라벨(`의견`)과 개수를 그대로 읽어 준다.
                  aria-label={`${badge.arrow.direction_label} ${count.label} ${count.count}건`}
                  onClick={() => onBadgeSelect(badgeId, count, badge.arrow)}
                >
                  <FlowMetricBadge tone={toneOf(count.content_type)} />
                  <b>{count.count}</b>
                </button>
              )
            })}
            {hiddenCount > 0 ? (
              /*
                노드와 겹칠 때만 오는 마지막 수단이다 — 알약을 전부 펼친 채로
                두면 얼굴을 가린다. 그래도 앞의 한둘(`COLLAPSED_PEEK_COUNT`)은
                진짜 알약으로 남겨 둔다 — 이 화살표가 무엇을 나르는지 자체가
                안 보이면 `···` 하나만으로는 뭘 누르는 건지 짐작할 수 없다.
                나머지 개수만 이 단추 뒤에 숨는다. 펼친 뒤에는 이 판이 다시
                그려질 때까지 그대로 남는다(같은 자리로 도로 접히면 방금
                누른 것이 사라진 것처럼 보인다).
              */
              <button
                type="button"
                className="flow-badge flow-badge-collapsed"
                aria-label={`${badge.arrow.direction_label} 그 외 ${hiddenCount}종 — 눌러서 펼치기`}
                onClick={() => expandBadge(badge.id)}
              >
                <span aria-hidden="true">···</span>
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
