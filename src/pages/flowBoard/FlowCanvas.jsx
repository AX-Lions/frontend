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
 * ## 선 색이 무엇을 가르는가
 *
 *     주황   한쪽이라도 대리인·서버가 낀 선 (AI 가 나른 것)
 *     진회색 사람과 사람 사이
 *
 * 이전 CSS 는 모든 `path` 를 `#e5e7eb` 로 덮어 화살촉까지 지웠다. 선이 전부
 * 같은 회색이면 **"AI 대리인이 대신 움직였다" 는 이 서비스의 핵심이 그림에서
 * 사라진다.**
 */

const AI_STROKE = '#f59e0b'
const HUMAN_STROKE = '#374151'

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
      {node.avatar_url ? (
        <img src={node.avatar_url} alt="" />
      ) : (
        <span className="flow-node-initial" aria-hidden="true">
          {(node.name ?? '?').trim().slice(0, 1)}
        </span>
      )}
      <span className="flow-node-name">{node.name}</span>
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
          {/* 화살촉은 선 색을 따라간다. 하나로 두면 주황 선 끝에 회색 촉이 붙는다. */}
          <marker id="flow-arrow-ai" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0 0 L9 4.5 L0 9 z" fill={AI_STROKE} />
          </marker>
          <marker id="flow-arrow-human" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0 0 L9 4.5 L0 9 z" fill={HUMAN_STROKE} />
          </marker>
        </defs>

        {links.map((link) => {
          const lit = isHighlighted(link.arrow)
          return (
            <path
              className={lit ? 'flow-link' : 'flow-link is-dimmed'}
              key={link.id}
              d={link.d}
              stroke={link.isAi ? AI_STROKE : HUMAN_STROKE}
              markerEnd={`url(#${link.isAi ? 'flow-arrow-ai' : 'flow-arrow-human'})`}
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
            style={{ left: badge.x, top: badge.y }}
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
