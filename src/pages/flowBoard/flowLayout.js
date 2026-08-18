/**
 * 플로우 캔버스의 기하 전부.
 *
 * ## 왜 순수 함수로 떼어 놨나
 *
 * 이전 캔버스는 노드 자리가 CSS 클래스(`.top-left`)였고 연결선이
 * `<path d="M175 376 H589" />` 세 개였다. 좌표가 CSS·SVG·JSX 세 곳에 흩어져
 * 있어서 **사람이 넷이 되는 순간 그릴 자리가 없었다.** 자리를 데이터에서
 * 계산하면 노드가 둘이든 여덟이든 같은 코드가 그린다.
 *
 * 렌더와 섞지 않는 이유는 이 계산이 화면 없이도 검증 가능해야 해서다.
 *
 * ## 결정적이어야 한다
 *
 * 같은 데이터면 같은 그림이어야 한다. 서버가 주는 `nodes` 순서는 **엣지를
 * 훑은 순서**라 필터를 하나 끄면 배열 순서가 바뀐다. 그 순서를 그대로 쓰면
 * 체크박스 하나에 사람들이 자리를 바꿔 앉는다. 그래서 여기서 다시 정렬한다.
 */

/** 원형 아바타 반지름. CSS 의 `--flow-node-size` 와 짝이다. */
export const NODE_RADIUS = 56

/** 이웃한 두 노드 사이에 최소한 남겨야 하는 빈 틈. */
const NODE_MIN_GAP = 44

/** 그린 것 바깥으로 남기는 여백. 선택 링과 그림자가 잘리지 않을 만큼. */
const STAGE_MARGIN = 32

/** 뱃지 묶음 한 덩이의 대략적인 반지름. 무대 경계를 잴 때만 쓴다. */
const BADGE_HALF = 46

/** 한가운데 요약표가 차지하는 자리. 노드는 이 상자를 피해 앉는다. */
export const SUMMARY_SIZE = { width: 592, height: 266 }

/** 요약표와 노드 사이 최소 거리. */
const SUMMARY_CLEARANCE = 40

/** 요약표를 가로지르는 선이 상자에서 떨어져야 하는 거리. */
const SUMMARY_BOW_MARGIN = 28

/**
 * 같은 두 노드를 잇는 선이 여럿일 때, **선 가운데에서** 벌어지는 간격.
 *
 * 뱃지가 앉는 곳이 곧 선의 가운데라 이 값이 뱃지 사이 거리이기도 하다.
 * 뱃지 하나가 36px 이므로 그보다 넉넉해야 두 뱃지가 겹쳐 읽히지 않는다.
 */
const PARALLEL_SPREAD = 44

/** 선 끝을 원 테두리에서 얼마나 띄울지. 끝쪽은 화살촉이 앉을 자리가 더 필요하다. */
const EDGE_START_GAP = 6
const EDGE_END_GAP = 16

const KIND_RANK = { USER: 0, AGENT: 1, SERVER: 2 }

/**
 * 사람 → 그 사람의 Bordo 순으로, 사람은 가나다순으로 앉힌다.
 *
 * 대리인 노드의 `name` 은 `임수연의 Bordo` 라, 이름만으로 정렬하면 주인과
 * 멀리 떨어져 앉아 "누구의 대리인인지" 가 그림에서 사라진다. 그래서 정렬
 * 기준을 **주인의 이름**으로 맞춘다.
 */
function orderNodes(nodes) {
  const ownerName = new Map()
  nodes.forEach((node) => {
    if (node?.kind === 'USER' && node.user_id) {
      ownerName.set(node.user_id, node.name ?? '')
    }
  })

  const sortKey = (node) => ownerName.get(node.user_id) ?? node.name ?? ''

  return [...nodes].sort((a, b) => {
    const byName = sortKey(a).localeCompare(sortKey(b), 'ko')
    if (byName !== 0) {
      return byName
    }

    const rank = (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9)
    if (rank !== 0) {
      return rank
    }

    // 이름도 종류도 같은 두 노드가 있을 수 있다(동명이인). id 로 갈라야
    // 렌더마다 순서가 뒤집히지 않는다.
    return String(a.id).localeCompare(String(b.id))
  })
}

/**
 * 링의 두 반지름.
 *
 * 두 조건 중 큰 쪽을 쓴다.
 * 1. 한가운데 요약표를 피할 것
 * 2. 이웃 노드끼리 겹치지 않을 것 — 노드가 많아질수록 이쪽이 커진다
 */
function ringRadii(count) {
  const spacing = count > 1
    ? (NODE_RADIUS + NODE_MIN_GAP / 2) / Math.sin(Math.PI / count)
    : 0

  return {
    rx: Math.max(SUMMARY_SIZE.width / 2 + SUMMARY_CLEARANCE + NODE_RADIUS, spacing),
    ry: Math.max(SUMMARY_SIZE.height / 2 + SUMMARY_CLEARANCE + NODE_RADIUS, spacing),
  }
}

function unit(dx, dy) {
  const length = Math.hypot(dx, dy)
  return length < 1e-6 ? { x: 0, y: 0, length: 0 } : { x: dx / length, y: dy / length, length }
}

/** 중심에서 방향 `u` 로 나갔을 때 축 정렬 사각형 경계까지의 거리. */
function boxReach(u, halfWidth, halfHeight) {
  const toRight = Math.abs(u.x) < 1e-6 ? Infinity : halfWidth / Math.abs(u.x)
  const toBottom = Math.abs(u.y) < 1e-6 ? Infinity : halfHeight / Math.abs(u.y)
  return Math.min(toRight, toBottom)
}

/**
 * 한 줄의 곡선을 만든다.
 *
 * ## 왜 직선이 아닌가
 *
 * 노드가 링 위에 있고 요약표가 한가운데 있어서, **마주 보는 두 노드를 직선으로
 * 이으면 선이 요약표를 관통한다.** 뱃지도 그 위에 얹힌다. 그래서 선의 가운데를
 * 바깥으로 밀어 상자를 비껴가게 한다.
 *
 * 2차 베지에의 가운데 점은 `(현의 중점 + 제어점) / 2` 다. 가운데를 중심에서
 * `need` 만큼 떨어뜨리고 싶으면 제어점을 `2*need - d` 에 두면 된다.
 * 이미 충분히 떨어져 있으면(`d >= need`) 제어점이 현의 중점과 같아져 직선이 된다.
 */
function curveBetween(from, to, center, parallelOffset) {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }
  const outward = unit(mid.x - center.x, mid.y - center.y)
  const chord = unit(to.x - from.x, to.y - from.y)

  // 정확히 중심을 지나는 현은 바깥 방향을 정할 수 없다. 그때는 현의 수직
  // 방향으로 민다 — 어느 쪽이든 상자를 벗어나는 것은 같다.
  const push = outward.length < 1e-6 ? { x: -chord.y, y: chord.x } : outward
  const distance = outward.length
  const need = boxReach(
    push,
    SUMMARY_SIZE.width / 2 + SUMMARY_BOW_MARGIN,
    SUMMARY_SIZE.height / 2 + SUMMARY_BOW_MARGIN,
  ) + NODE_RADIUS / 2

  /*
    제어점을 두 배로 민다.

    곡선의 가운데는 `(현의 중점 + 제어점) / 2` 라, 제어점을 `x` 만큼 옮기면
    가운데는 `x/2` 만 움직인다. 벌리려던 간격의 **절반만 벌어져** 뱃지가
    겹쳤다. 끝점은 노드 중심에 그대로 두고 제어점만 두 배로 민다 — 끝점까지
    옮기면 선이 노드에서 떨어진 자리에서 시작한다.
  */
  const reach = Math.max(distance, 2 * need - distance)
  const sideways = parallelOffset * 2
  const control = {
    x: center.x + push.x * reach - chord.y * sideways,
    y: center.y + push.y * reach + chord.x * sideways,
  }

  // 선 끝을 원 테두리에 맞춘다. 방향은 제어점 쪽이라 곡선이 원을 파고들지 않는다.
  const startDir = unit(control.x - from.x, control.y - from.y)
  const endDir = unit(control.x - to.x, control.y - to.y)
  const start = {
    x: from.x + startDir.x * (NODE_RADIUS + EDGE_START_GAP),
    y: from.y + startDir.y * (NODE_RADIUS + EDGE_START_GAP),
  }
  const end = {
    x: to.x + endDir.x * (NODE_RADIUS + EDGE_END_GAP),
    y: to.y + endDir.y * (NODE_RADIUS + EDGE_END_GAP),
  }

  return {
    start,
    control,
    end,
    // 2차 베지에의 t=0.5 지점. 뱃지가 앉을 자리다.
    midpoint: {
      x: (start.x + end.x) / 4 + control.x / 2,
      y: (start.y + end.y) / 4 + control.y / 2,
    },
    // t=0.5 의 접선은 현과 나란하다. 뱃지를 선을 따라 눕힐지 세울지 정한다.
    axis: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'row' : 'column',
  }
}

/** 사람끼리 오간 것이 아니면 AI 선이다. 대리인·서버가 한쪽에라도 끼면 주황. */
function isAiLink(from, to) {
  return from?.kind !== 'USER' || to?.kind !== 'USER'
}

/**
 * 캔버스 한 판을 만든다.
 *
 * @param nodes  `GET .../flow` 의 `nodes`
 * @param arrows `GET .../flow` 의 `arrows`
 * @returns `{ nodes, links, badges, stage, summary }`
 */
export function buildFlowLayout(nodes = [], arrows = []) {
  const ordered = orderNodes(nodes.filter(Boolean))
  const { rx, ry } = ringRadii(ordered.length)
  // 중심을 어디에 두든 마지막에 경계에 맞춰 다시 옮긴다. 여기서는 좌표가
  // 음수로 내려가지 않을 만큼만 띄운다.
  const center = { x: rx + NODE_RADIUS, y: ry + NODE_RADIUS }
  const step = (2 * Math.PI) / Math.max(1, ordered.length)

  const placed = ordered.map((node, index) => {
    // 12시부터 시계 방향. 사람이 하나여도 위쪽에 앉는다.
    const angle = -Math.PI / 2 + index * step
    return {
      ...node,
      x: center.x + rx * Math.cos(angle),
      y: center.y + ry * Math.sin(angle),
      r: NODE_RADIUS,
    }
  })

  const byId = new Map(placed.map((node) => [node.id, node]))

  /*
    같은 두 노드를 잇는 선이 몇 번째인지 세어 둔다.

    작업 플로우는 사람마다 작업·수정·피드백·공유·AI조회가 다 있어서 같은 쌍
    사이에 선이 여럿 생긴다. 오프셋을 안 주면 다섯 줄이 **한 줄로 겹쳐 보이고**
    뱃지 다섯 개가 같은 점에 쌓인다. 방향(A→B, B→A)이 달라도 겹치는 것은
    같으므로 정렬한 쌍을 키로 쓴다.
  */
  const pairSlots = new Map()
  const pending = []

  arrows.forEach((arrow) => {
    const from = byId.get(arrow.from_node_id)
    if (!from) {
      return
    }

    // `to_node_ids` 는 여럿일 수 있다. 작업 플로우 한 건이 팀 전원에게 가면
    // 대상 수만큼 선이 그어진다 — 하나만 그리면 나머지 사람에게는 그 일이
    // 일어나지 않은 것으로 보인다.
    ;(arrow.to_node_ids ?? []).forEach((toId, targetIndex) => {
      const to = byId.get(toId)
      if (!to || to.id === from.id) {
        return
      }

      const pairKey = [from.id, to.id].sort().join('|')
      const slot = pairSlots.get(pairKey) ?? 0
      pairSlots.set(pairKey, slot + 1)
      pending.push({ arrow, from, to, targetIndex, pairKey, slot })
    })
  })

  const links = pending.map(({ arrow, from, to, targetIndex, pairKey, slot }) => {
    const total = pairSlots.get(pairKey) ?? 1
    const offset = (slot - (total - 1) / 2) * PARALLEL_SPREAD
    const curve = curveBetween(from, to, center, offset)

    return {
      id: `${arrow.id}::${to.id}`,
      arrowId: arrow.id,
      arrow,
      fromId: from.id,
      toId: to.id,
      isAi: isAiLink(from, to),
      opacity: arrow.opacity ?? 1,
      // 뱃지는 화살표당 하나다. 브로드캐스트에서 팔마다 같은 숫자를 붙이면
      // 같은 일이 네 번 일어난 것처럼 읽힌다.
      isBadgeAnchor: targetIndex === 0,
      ...curve,
    }
  })

  const badges = links
    .filter((link) => link.isBadgeAnchor && (link.arrow.counts ?? []).length > 0)
    .map((link) => ({
      id: link.arrowId,
      arrow: link.arrow,
      isAi: link.isAi,
      point: link.midpoint,
      axis: link.axis,
    }))

  /*
    무대 크기를 그린 것에 맞춰 잡는다.

    처음에는 링 반지름에 여백을 더한 고정값을 썼는데, **평행선이 몇 줄이냐에
    따라 실제로 차지하는 폭이 달라진다.** 여백을 모자라게 잡으면 SVG 가 무대
    크기만큼만 그려서 벌려 놓은 선이 잘리고, 넉넉히 잡으면 아무것도 없는 여백을
    한참 스크롤하게 된다. 그래서 다 그린 뒤 경계를 재서 거기에 맞춘다.

    2차 베지에는 세 점(시작·제어·끝)의 볼록 껍질 안에 있으므로 그 셋만 재면
    곡선 전체가 담긴다.
  */
  const xs = []
  const ys = []
  placed.forEach((node) => {
    xs.push(node.x - node.r, node.x + node.r)
    ys.push(node.y - node.r, node.y + node.r)
  })
  links.forEach((link) => {
    [link.start, link.control, link.end].forEach((p) => {
      xs.push(p.x)
      ys.push(p.y)
    })
  })
  badges.forEach((badge) => {
    xs.push(badge.point.x - BADGE_HALF, badge.point.x + BADGE_HALF)
    ys.push(badge.point.y - BADGE_HALF, badge.point.y + BADGE_HALF)
  })
  xs.push(center.x - SUMMARY_SIZE.width / 2, center.x + SUMMARY_SIZE.width / 2)
  ys.push(center.y - SUMMARY_SIZE.height / 2, center.y + SUMMARY_SIZE.height / 2)

  const shiftX = STAGE_MARGIN - Math.min(...xs)
  const shiftY = STAGE_MARGIN - Math.min(...ys)
  const at = (p) => ({ x: p.x + shiftX, y: p.y + shiftY })
  const round = (v) => Number(v.toFixed(1))

  return {
    nodes: placed.map((node) => ({ ...node, x: node.x + shiftX, y: node.y + shiftY })),
    links: links.map((link) => {
      const start = at(link.start)
      const control = at(link.control)
      const end = at(link.end)
      return {
        ...link,
        d: `M${round(start.x)} ${round(start.y)} Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
      }
    }),
    badges: badges.map((badge) => ({
      ...badge,
      x: badge.point.x + shiftX,
      y: badge.point.y + shiftY,
    })),
    stage: {
      width: Math.ceil(Math.max(...xs) - Math.min(...xs) + STAGE_MARGIN * 2),
      height: Math.ceil(Math.max(...ys) - Math.min(...ys) + STAGE_MARGIN * 2),
    },
    summary: {
      left: center.x - SUMMARY_SIZE.width / 2 + shiftX,
      top: center.y - SUMMARY_SIZE.height / 2 + shiftY,
      width: SUMMARY_SIZE.width,
      height: SUMMARY_SIZE.height,
    },
  }
}
