import { Fragment } from 'react'

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
          <span className="flow-node-agent-name">
            {ownerLabel(node.name)}
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
  showRecency,
  style,
  children,
}) {
  const { stage, links, badges, nodes } = layout

  // 인덱스(안건)를 고르면 그 안건에 걸린 화살표만 남기지 않고 **나머지를
  // 흐린다.** 지우면 판의 모양이 바뀌어 "무엇이 강조됐는지" 를 비교할 수 없다.
  const isHighlighted = (arrow) => {
    if (!highlightedEdgeIds) {
      return true
    }
    return (arrow.counts ?? []).some((count) => (count.edge_ids ?? [])
      .some((edgeId) => highlightedEdgeIds.has(edgeId)))
  }

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

        {links.map((link) => {
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
                  `시간순` 을 켰을 때만 진하기를 적용한다. 서버가 최근일수록 1 에
                  가까운 값을 주는데, 항상 걸면 오래된 선이 늘 흐려 **회의 초반에
                  오간 것을 못 보고 지나친다.**

                  고른 선은 그 규칙에서 뺀다 — 오래된 선을 골랐을 때 흐린 채로
                  남으면 무엇을 골랐는지 안 보인다.
                */
                opacity={picked ? 1 : (lit ? (showRecency ? link.opacity : 1) : 0.14)}
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
        return (
          <div
            className={`flow-badge-group is-${badge.axis}${badge.isSelf ? ' is-self' : ''}${lit ? '' : ' is-dimmed'}`}
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
            {(badge.arrow.counts ?? []).map((count) => {
              const badgeId = `${badge.id}::${count.content_type}`
              return (
                <button
                  className={activeBadgeId === badgeId ? 'flow-badge is-active' : 'flow-badge'}
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
          </div>
        )
      })}
    </div>
  )
}
