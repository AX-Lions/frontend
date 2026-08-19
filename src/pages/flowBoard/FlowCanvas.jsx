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
 * ## 선 모양은 시안 하나로 통일했다 (`576:4990`)
 *
 * 한때 선 색이 「AI 가 나른 것(주황) · 사람끼리(진회색)」를 갈랐다. 시안의
 * 화살표는 굵기·색·양 끝 모양이 **하나뿐**이라 그 구분을 색에서 뺐다:
 * 1px `#9CA3AF` 실선, 출발 쪽에 작은 점, 도착 쪽에 속 빈 화살촉.
 *
 * AI 가 낀 흐름은 여전히 읽혀야 한다. 그 말은 이제 뱃지 쪽이 한다 —
 * 자기 대리인과 오간 뱃지 묶음의 주황 테두리(`.flow-badge-group.is-self`)가
 * 남아 있고, 판에서 대리인 노드를 접는 규칙도 그대로다.
 */

/** 시안 토큰 `테두리/플로우화살표`. 모든 선이 이 색 하나를 쓴다. */
const LINK_STROKE = '#9ca3af'

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
  onNodeSelect,
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
            시안(`576:4990`)의 양 끝.

            출발 쪽은 지름 5.3px 짜리 점, 도착 쪽은 **속을 채우지 않은** 직각
            화살촉이다. 채운 삼각형을 쓰면 1px 선 끝에 검은 덩어리가 붙어
            선보다 촉이 먼저 읽힌다.

            `markerUnits="userSpaceOnUse"` 가 필요하다. 기본값
            (`strokeWidth`)이면 촉 크기가 선 굵기를 따라가는데, 선이 1px 라
            촉이 시안의 1/4 로 쪼그라든다.
          */}
          <marker
            id="flow-arrow-tail"
            markerUnits="userSpaceOnUse"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <circle cx="4" cy="4" r="2.67" fill={LINK_STROKE} />
          </marker>
          <marker
            id="flow-arrow-head"
            markerUnits="userSpaceOnUse"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
          >
            <path
              d="M6 2 L10 6 L6 10"
              fill="none"
              stroke={LINK_STROKE}
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>

        {links.map((link) => {
          const lit = isHighlighted(link.arrow)
          return (
            <path
              className={lit ? 'flow-link' : 'flow-link is-dimmed'}
              key={link.id}
              d={link.d}
              stroke={LINK_STROKE}
              markerStart="url(#flow-arrow-tail)"
              markerEnd="url(#flow-arrow-head)"
              /*
                `시간순` 을 켰을 때만 진하기를 적용한다. 서버가 최근일수록 1 에
                가까운 값을 주는데, 항상 걸면 오래된 선이 늘 흐려 **회의 초반에
                오간 것을 못 보고 지나친다.**
              */
              opacity={lit ? (showRecency ? link.opacity : 1) : 0.14}
            />
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
