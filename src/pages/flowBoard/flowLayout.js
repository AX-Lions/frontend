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
 * ## 판의 구성 — 요약표가 위, 그래프가 아래
 *
 *     ┌────────── 요약표 ──────────┐   ← 판 맨 위. 세 열이 여기 쌓인다
 *     └────────────────────────────┘
 *              ○ ─────── ○            ← 노드는 그 아래 링 위에 앉는다
 *              ○ ─────── ○
 *
 * 한때 요약표를 링 **한가운데**에 두었다. 그러면 마주 보는 두 노드를 잇는 선이
 * 요약표를 관통해서, 선을 일부러 바깥으로 휘게 만들어야 했다 — 곡선은 취향이
 * 아니라 가운데 상자를 피하려고 낸 우회로였다. 요약표를 위로 빼면 링 안이
 * 비므로 **선이 직선이어도 아무것도 가리지 않는다.** 두 변경은 한 몸이다.
 *
 * 직선이 나은 이유는 따로 있다. 곡선은 두 노드를 잇는 선이 여럿일 때 어느
 * 것이 어느 것인지 눈으로 따라가기 어렵고, 화살촉의 각도가 실제 방향과
 * 어긋나 보인다. 이 화면이 답해야 하는 질문은 "누가 누구에게 무엇을
 * 보냈나" 라서, 선은 눈으로 따라갈 수 있어야 한다.
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

/** 요약표 폭. */
export const SUMMARY_WIDTH = 592

/*
  요약표 높이는 **줄 수에서 계산한다.**

  높이를 266px 로 못 박아 두었더니, 열마다 두 줄뿐인 회의에서도 상자가 그대로
  커서 아래쪽 절반이 빈 채로 남았다. 반대로 여섯 줄이 넘으면 상자가 아래로
  삐져나와 노드를 덮었다. 요약표가 판 한가운데 있을 때는 노드가 상자를 피해
  둘러앉아 티가 덜 났지만, **위에 고정하면 상자 아래 경계가 곧 그래프의
  시작점**이라 높이가 틀리면 바로 겹치거나 빈다.

  아래 값들은 `flowBoard.css` 의 `.summary-board` · `.summary-column` 과 짝이다.
  한쪽만 고치면 요약표와 노드 사이 간격이 어긋난다.
*/
const SUMMARY_PADDING_Y = 24 // .summary-board { padding: 24px }
const SUMMARY_HEADING = 24 // .summary-column h2 — 16px 한 줄 + margin-bottom 8px
const SUMMARY_ROW = 33 // .summary-column button — 14px×1.15 + 상하 8px, 올림
const SUMMARY_ROW_GAP = 6 // .summary-column div { gap: 6px }

/** 요약이 통째로 비었을 때(작업 모드·요약 없는 회의) 안내문이 앉을 만한 높이. */
const SUMMARY_MIN_HEIGHT = 132

/** 요약표 아래 끝과 가장 위에 앉은 노드 사이의 빈 틈. */
const SUMMARY_GAP = 56

/**
 * 노드 중심이 벌어지는 목표 폭·높이의 **절반**.
 *
 * 가로는 요약표 폭에 맞춘다 — 그래프가 요약표보다 좁으면 위아래가 따로 노는
 * 그림이 되고, 넓으면 판이 옆으로 길어져 축소된다. `-NODE_RADIUS` 는 원의
 * 바깥 테두리를 기준으로 맞추기 위한 것이다(중심 span + 지름 = 요약표 폭).
 */
const RING_HALF_WIDTH = SUMMARY_WIDTH / 2 - NODE_RADIUS
const RING_HALF_HEIGHT = 200

/**
 * 같은 두 노드를 잇는 선이 여럿일 때, 선끼리 **직각으로** 벌어지는 간격.
 *
 * 뱃지가 앉는 곳이 곧 선의 가운데라 이 값이 뱃지 사이 거리이기도 하다.
 * 뱃지 하나가 36px 이므로 그보다 넉넉해야 두 뱃지가 겹쳐 읽히지 않는다.
 */
const PARALLEL_SPREAD = 44

/**
 * 선을 옆으로 밀 수 있는 한계.
 *
 * 직선을 직각으로 밀면 끝점도 같이 밀린다. 반지름보다 많이 밀면 끝점이 원
 * 바깥으로 나가 **선이 노드에서 떨어진 허공에서 시작한다.** 곡선일 때는
 * 제어점만 밀고 끝점은 원에 붙여 두어 이 문제가 없었다. 그래서 선이 셋을
 * 넘으면 간격을 좁혀서라도 전부 원 안에서 출발하게 한다.
 */
const MAX_PARALLEL_OFFSET = NODE_RADIUS * 0.72

/**
 * 평행선의 뱃지를 **선을 따라** 앞뒤로 어긋나게 놓는 거리.
 *
 * 직각으로 44px 벌리는 것만으로는 모자란다. 뱃지 묶음은 가로로 길고(3종이면
 * 130px 쯤) 세로로는 30px 밖에 안 되는 알약이라, **선이 비스듬하면 44px 는
 * 알약 길이 안에 들어와 두 묶음이 포개진다.** 곡선일 때는 선이 바깥으로
 * 휘면서 뱃지도 따라 벌어져 티가 덜 났다.
 *
 * 짧은 선에서는 이만큼 밀면 뱃지가 노드에 올라타므로 선 길이에 맞춰 줄인다.
 */
const BADGE_SLIDE = 130
const BADGE_SLIDE_RATIO = 0.3

/** 선 끝을 원 테두리에서 얼마나 띄울지. 끝쪽은 화살촉이 앉을 자리가 더 필요하다. */
const EDGE_START_GAP = 6
const EDGE_END_GAP = 16

/**
 * 자기 대리인과 오간 것을 붙이는 자리 — 노드 테두리에서 바깥으로.
 *
 * 대리인을 주인에게 접으면 「사람 ↔ 자기 대리인」 엣지는 자기 자신을 가리킨다.
 * 그릴 선이 없다고 버리면 **"내가 내 대리인에게 지시한 기록" 이 판에서 통째로
 * 사라진다** — 이 서비스에서 가장 자주 일어나는 일인데 안 보이게 된다.
 * 그래서 선 대신 노드에 뱃지로 붙인다.
 */
const SELF_BADGE_GAP = 26

/** 한 사람에게 자기 뱃지가 여럿일 때 바깥으로 쌓이는 간격. */
const SELF_BADGE_STEP = 34

const KIND_RANK = { USER: 0, AGENT: 1, SERVER: 2 }

/** 요약표 세 열 중 가장 긴 열의 줄 수로 상자 높이를 잰다. */
function summaryHeight(rows) {
  if (!rows) {
    return SUMMARY_MIN_HEIGHT
  }

  const body = rows * SUMMARY_ROW + (rows - 1) * SUMMARY_ROW_GAP
  return Math.max(SUMMARY_MIN_HEIGHT, SUMMARY_PADDING_Y * 2 + SUMMARY_HEADING + body)
}

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
 * 노드가 앉을 각도.
 *
 * 12시에서 **반 칸 돌려** 시작한다. 정확히 12시부터 세면 짝수 명일 때 한
 * 사람이 12시, 한 사람이 6시에 앉아 마름모가 되는데, 요약표가 바로 위에
 * 있으므로 12시 자리는 상자 밑에 바짝 붙어 답답하다. 반 칸 돌리면 넷이
 * 두 명씩 위아래로 갈라 앉아 **요약표와 나란한 사각형**이 된다.
 *
 * 홀수 명이어도 세로축 대칭은 그대로다 — 셋이면 위 둘 · 아래 하나가 된다.
 */
function ringAngles(count) {
  const step = (2 * Math.PI) / Math.max(1, count)
  return Array.from({ length: count }, (_, index) => -Math.PI / 2 + step / 2 + index * step)
}

/**
 * 링의 두 반지름.
 *
 * 두 조건 중 큰 쪽을 쓴다.
 * 1. 가장 바깥에 앉는 노드가 목표 폭·높이에 닿을 것
 * 2. 이웃 노드끼리 겹치지 않을 것 — 노드가 많아질수록 이쪽이 커진다
 *
 * 1번을 `RING_HALF_WIDTH` 를 그대로 반지름에 쓰지 않고 **가장 큰 |cos| 로
 * 나누는** 이유는, 반 칸 돌려 앉히면 아무도 3시·9시 정각에 있지 않기
 * 때문이다. 반지름을 그대로 쓰면 넷일 때 가로 폭이 `2·r·cos45° = 0.71·2r`
 * 로 줄어 그래프가 요약표보다 한참 좁아진다.
 */
function ringRadii(angles) {
  const count = angles.length
  const spacing = count > 1
    ? (NODE_RADIUS + NODE_MIN_GAP / 2) / Math.sin(Math.PI / count)
    : 0

  const widest = (values) => values.reduce((max, v) => Math.max(max, Math.abs(v)), 0)
  const maxCos = widest(angles.map(Math.cos))
  const maxSin = widest(angles.map(Math.sin))

  // 둘이면 나란히 앉아 |sin| 이 0 이다. 0 으로 나누지 않도록 목표값을 그대로 쓴다.
  const reach = (half, extent) => (extent > 1e-6 ? half / extent : half)

  return {
    rx: Math.max(spacing, reach(RING_HALF_WIDTH, maxCos)),
    ry: Math.max(spacing, reach(RING_HALF_HEIGHT, maxSin)),
  }
}

function unit(dx, dy) {
  const length = Math.hypot(dx, dy)
  return length < 1e-6 ? { x: 0, y: 0, length: 0 } : { x: dx / length, y: dy / length, length }
}

/**
 * 두 노드를 잇는 **직선** 하나를 만든다.
 *
 * `offset` 은 선을 현과 직각으로 통째로 미는 양이다. 두 끝을 같은 양만큼
 * 밀기 때문에 선은 여전히 직선이고 옆 선과 나란하다 — 같은 쌍 사이에 선이
 * 여럿일 때 겹쳐 보이지 않게 하는 유일한 장치다.
 *
 * 끝점을 그냥 옆으로 옮기면 원 테두리에서 벗어나 **선이 노드에서 떨어진
 * 자리에서 시작한다.** 밀린 선이 원을 자르는 지점을 피타고라스로 되찾아야
 * 끝이 원에 붙는다: 중심에서 선까지 거리가 `offset` 이므로, 반지름 `R` 인
 * 원 안에 든 절반 길이는 `√(R² − offset²)` 이다.
 */
function lineBetween(from, to, offset, slideRank) {
  const chord = unit(to.x - from.x, to.y - from.y)
  const normal = { x: -chord.y, y: chord.x }
  const shift = { x: normal.x * offset, y: normal.y * offset }
  const reach = (radius) => Math.sqrt(Math.max(0, radius * radius - offset * offset))

  const startReach = reach(NODE_RADIUS + EDGE_START_GAP)
  const endReach = reach(NODE_RADIUS + EDGE_END_GAP)

  const start = {
    x: from.x + shift.x + chord.x * startReach,
    y: from.y + shift.y + chord.y * startReach,
  }
  const end = {
    x: to.x + shift.x - chord.x * endReach,
    y: to.y + shift.y - chord.y * endReach,
  }

  const length = Math.hypot(end.x - start.x, end.y - start.y)
  const slide = slideRank * Math.min(BADGE_SLIDE, length * BADGE_SLIDE_RATIO)

  return {
    start,
    end,
    // 뱃지가 앉을 자리. 직선이라 두 끝의 한가운데이되, 평행선끼리는 선을
    // 따라 앞뒤로 어긋나 앉는다.
    midpoint: {
      x: (start.x + end.x) / 2 + chord.x * slide,
      y: (start.y + end.y) / 2 + chord.y * slide,
    },
    // 뱃지를 선을 따라 눕힐지 세울지 정한다.
    axis: Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'row' : 'column',
  }
}

/**
 * 사람끼리 오간 것이 아니면 AI 선이다. 대리인·서버가 한쪽에라도 끼면 주황.
 *
 * **접기 전의 노드를 넘겨야 한다.** 대리인을 주인에게 접고 나면 양 끝이 다
 * `USER` 라, 접은 것을 넘기면 주황 선이 하나도 남지 않는다 — 대리인 노드를
 * 없앤 이유가 통째로 사라진다.
 */
function isAiLink(from, to) {
  return from?.kind !== 'USER' || to?.kind !== 'USER'
}

/**
 * 대리인을 주인에게 접는다.
 *
 * 판에 AI 프로필을 따로 세우지 않는다. `강다은의 Bordo` 가 노드로 서면 사람이
 * 다섯인 회의가 노드 여덟 개가 되고, 정작 읽어야 하는 **"누가 누구에게 무엇을
 * 보냈나"** 가 대리인 이름에 묻힌다. AI 가 날랐다는 것은 **선 색(주황)이 이미
 * 말한다** — 노드를 하나 더 세워 같은 말을 두 번 할 이유가 없다.
 *
 * 답의 주어는 사람이다. 대리인은 `어떻게` 에 해당하고, 그건 색이 맡는다.
 *
 * 주인을 못 찾은 대리인은 **그대로 둔다.** 필터로 주인만 빠지는 경우가 있는데,
 * 접을 곳이 없다고 지워 버리면 그 흐름이 통째로 사라진다 — 안 보이는 것과
 * 없는 것은 다르다.
 *
 * @returns `{ kept, ownerOf }` — `ownerOf` 는 모든 노드 id 를 살아남는 id 로
 *          옮기는 표다. 접히지 않은 노드는 자기 자신을 가리킨다.
 */
function collapseAgents(nodes) {
  const userByOwner = new Map()
  nodes.forEach((node) => {
    if (node.kind === 'USER' && node.user_id) {
      userByOwner.set(node.user_id, node.id)
    }
  })

  const ownerOf = new Map()
  nodes.forEach((node) => {
    const owner = node.kind === 'AGENT' && node.user_id
      ? userByOwner.get(node.user_id)
      : undefined
    ownerOf.set(node.id, owner ?? node.id)
  })

  return {
    kept: nodes.filter((node) => ownerOf.get(node.id) === node.id),
    ownerOf,
  }
}

/**
 * 캔버스 한 판을 만든다.
 *
 * @param nodes  `GET .../flow` 의 `nodes`
 * @param arrows `GET .../flow` 의 `arrows`
 * @param options `summaryRows` — 요약표 세 열 중 가장 긴 열의 줄 수.
 *                상자 높이가 곧 그래프가 시작하는 자리라 배치에 필요하다.
 * @returns `{ nodes, links, badges, stage, summary }`
 */
export function buildFlowLayout(nodes = [], arrows = [], { summaryRows = 0 } = {}) {
  const raw = nodes.filter(Boolean)
  // 접기 전 노드를 들고 있어야 선 색을 정할 수 있다. 접은 뒤에는 전부 사람이다.
  const rawById = new Map(raw.map((node) => [node.id, node]))
  const { kept, ownerOf } = collapseAgents(raw)
  const ordered = orderNodes(kept)
  const angles = ringAngles(ordered.length)
  const { rx, ry } = ringRadii(angles)
  const summary = { width: SUMMARY_WIDTH, height: summaryHeight(summaryRows) }

  /*
    가로 중심은 요약표와 링이 나눠 쓴다 — 둘의 중심축이 어긋나면 그래프가
    상자 옆으로 삐딱하게 달린 것처럼 보인다. 넓은 쪽이 판의 폭을 정한다.
  */
  const spanWidth = Math.max(summary.width, rx * 2 + NODE_RADIUS * 2)
  const centerX = STAGE_MARGIN + spanWidth / 2
  const summaryTop = STAGE_MARGIN

  /*
    링을 요약표 아래로 내린다.

    `ry` 만큼 내리면 안 된다. **가장 위에 앉은 노드가 링의 꼭대기에 있다는
    보장이 없기 때문이다** — 둘이면 둘 다 3시·9시에 앉아 링 위쪽이 통째로
    비고, 그만큼 요약표와 노드 사이가 허옇게 뜬다. 실제로 가장 위에 오는
    노드를 찾아 그것을 상자 바로 아래에 붙인다.
  */
  const highest = angles.length ? Math.min(...angles.map((angle) => Math.sin(angle) * ry)) : 0
  const centerY = summaryTop + summary.height + SUMMARY_GAP + NODE_RADIUS - highest

  const placed = ordered.map((node, index) => ({
    ...node,
    x: centerX + rx * Math.cos(angles[index]),
    y: centerY + ry * Math.sin(angles[index]),
    r: NODE_RADIUS,
  }))

  const byId = new Map(placed.map((node) => [node.id, node]))

  /*
    같은 두 노드를 잇는 선이 몇 번째인지 세어 둔다.

    서버가 `(보낸 이, 받은 이들)` 마다 하나로 묶어 주지만, 방향이 반대인 것과
    받는 사람 묶음이 다른 것(A→B 와 A→B·C)은 다른 화살표라 같은 쌍 사이에
    선이 여럿 생긴다. 오프셋을 안 주면 그 선들이 **한 줄로 겹쳐 보이고**
    뱃지가 같은 점에 쌓인다. 방향이 달라도 겹치는 것은 같으므로 정렬한 쌍을
    키로 쓴다.
  */
  const pairSlots = new Map()
  const pending = []
  const selfPending = []

  arrows.forEach((arrow) => {
    const fromRaw = rawById.get(arrow.from_node_id)
    const from = byId.get(ownerOf.get(arrow.from_node_id))
    if (!from) {
      return
    }

    /*
      접고 나면 같은 사람이 여러 번 나온다.

      `[강다은, 강다은의 Bordo]` 로 간 화살표는 둘 다 `강다은` 이 된다. 안
      걸러 내면 **같은 자리에 같은 선을 두 번 긋고**, 평행선 세는 값까지
      부풀어 멀쩡한 옆 선들이 괜히 벌어진다.
    */
    const drawnTargets = new Set()
    let selfHit = null

    // `to_node_ids` 는 여럿일 수 있다. 작업 플로우 한 건이 팀 전원에게 가면
    // 대상 수만큼 선이 그어진다 — 하나만 그리면 나머지 사람에게는 그 일이
    // 일어나지 않은 것으로 보인다.
    ;(arrow.to_node_ids ?? []).forEach((toId) => {
      const toRaw = rawById.get(toId)
      const to = byId.get(ownerOf.get(toId))
      if (!to) {
        return
      }

      // 색은 **접기 전** 종류로 정한다. 접은 뒤에는 양 끝이 다 사람이다.
      const isAi = isAiLink(fromRaw, toRaw)

      // 자기 대리인과 오간 것. 접고 나면 자기 자신을 가리켜 그릴 선이 없다.
      if (to.id === from.id) {
        selfHit = selfHit ?? { arrow, node: from, isAi }
        return
      }

      if (drawnTargets.has(to.id)) {
        return
      }
      drawnTargets.add(to.id)

      const pairKey = [from.id, to.id].sort().join('|')
      const slot = pairSlots.get(pairKey) ?? 0
      pairSlots.set(pairKey, slot + 1)
      /*
        뱃지는 화살표당 하나다. 브로드캐스트에서 팔마다 같은 숫자를 붙이면
        같은 일이 네 번 일어난 것처럼 읽힌다. **실제로 그린 첫 팔**에 붙인다 —
        원래 순서의 첫 대상이 자기 대리인이라 안 그려질 수 있어서, 목록의
        첫 칸을 기준으로 삼으면 그 화살표만 숫자가 통째로 빠진다.
      */
      pending.push({ arrow, from, to, isAi, pairKey, slot, isBadgeAnchor: drawnTargets.size === 1 })
    })

    /*
      선이 하나도 안 그려진 화살표만 자기 뱃지가 된다.

      한 화살표가 자기 대리인과 남에게 같이 갔다면 숫자는 이미 선 쪽에 붙는다.
      양쪽에 다 붙이면 **같은 건수가 두 번 일어난 것처럼 읽힌다.**
    */
    if (selfHit && drawnTargets.size === 0) {
      selfPending.push(selfHit)
    }
  })

  const links = pending.map(({ arrow, from, to, isAi, pairKey, slot, isBadgeAnchor }) => {
    const total = pairSlots.get(pairKey) ?? 1
    // 선이 많아지면 간격을 좁힌다. 넓게 유지하면 바깥 선이 노드에서 떨어진다.
    const spread = total > 1
      ? Math.min(PARALLEL_SPREAD, (MAX_PARALLEL_OFFSET * 2) / (total - 1))
      : 0
    const rank = slot - (total - 1) / 2

    /*
      미는 방향을 **두 노드 중 누가 앞이냐로** 고정한다.

      `rank` 를 그냥 쓰면 안 된다. 서로 마주 보는 두 화살표(A→B 와 B→A)는
      진행 방향이 반대라 현의 법선도 같이 뒤집힌다. 오프셋 부호와 법선 부호가
      한꺼번에 뒤집히면 둘이 상쇄돼 **두 선이 정확히 같은 자리에 포개진다** —
      벌리려고 만든 장치가 마주 보는 쌍에서만 아무 일도 하지 않았다. 곡선일
      때도 마찬가지였는데, 휘어 나가는 폭이 조금씩 달라 겹친 줄 몰랐다.

      쌍을 묶을 때 쓴 정렬 기준(`pairKey`)을 여기서도 써서, 미는 방향을 화살표
      진행 방향이 아니라 **판 위의 고정된 방향**으로 만든다.
    */
    const forward = String(from.id) < String(to.id) ? 1 : -1
    const offset = rank * spread * forward

    return {
      id: `${arrow.id}::${to.id}`,
      arrowId: arrow.id,
      arrow,
      fromId: from.id,
      toId: to.id,
      isAi,
      opacity: arrow.opacity ?? 1,
      isBadgeAnchor,
      ...lineBetween(from, to, offset, rank * forward),
    }
  })

  const badges = links
    .filter((link) => link.isBadgeAnchor && (link.arrow.counts ?? []).length > 0)
    .map((link) => ({
      id: link.arrowId,
      arrow: link.arrow,
      isAi: link.isAi,
      isSelf: false,
      point: link.midpoint,
      axis: link.axis,
    }))

  /*
    자기 대리인과 오간 것을 노드 바깥에 쌓는다.

    링 중심의 **반대쪽**으로 민다. 안쪽으로 밀면 요약표·다른 선과 겹치는데,
    바깥은 어차피 비어 있다. 한 사람에게 여럿이면 같은 방향으로 더 밀어 쌓는다.
  */
  const selfByNode = new Map()
  selfPending
    .filter((entry) => (entry.arrow.counts ?? []).length > 0)
    .forEach((entry) => {
      const list = selfByNode.get(entry.node.id) ?? []
      list.push(entry)
      selfByNode.set(entry.node.id, list)
    })

  selfByNode.forEach((entries, nodeId) => {
    const node = byId.get(nodeId)
    const outward = unit(node.x - centerX, node.y - centerY)
    // 사람이 하나면 노드가 곧 중심이라 방향을 정할 수 없다. 아래로 내린다.
    const dir = outward.length < 1e-6 ? { x: 0, y: 1 } : outward

    entries.forEach((entry, index) => {
      const reach = NODE_RADIUS + SELF_BADGE_GAP + index * SELF_BADGE_STEP
      badges.push({
        id: entry.arrow.id,
        arrow: entry.arrow,
        isAi: entry.isAi,
        isSelf: true,
        point: { x: node.x + dir.x * reach, y: node.y + dir.y * reach },
        axis: 'row',
      })
    })
  })

  /*
    무대 크기를 그린 것에 맞춰 잡는다.

    처음에는 링 반지름에 여백을 더한 고정값을 썼는데, **평행선이 몇 줄이냐에
    따라 실제로 차지하는 폭이 달라진다.** 여백을 모자라게 잡으면 SVG 가 무대
    크기만큼만 그려서 벌려 놓은 선이 잘리고, 넉넉히 잡으면 아무것도 없는 여백을
    한참 스크롤하게 된다. 그래서 다 그린 뒤 경계를 재서 거기에 맞춘다.
  */
  const xs = []
  const ys = []
  placed.forEach((node) => {
    xs.push(node.x - node.r, node.x + node.r)
    ys.push(node.y - node.r, node.y + node.r)
  })
  links.forEach((link) => {
    [link.start, link.end].forEach((p) => {
      xs.push(p.x)
      ys.push(p.y)
    })
  })
  badges.forEach((badge) => {
    xs.push(badge.point.x - BADGE_HALF, badge.point.x + BADGE_HALF)
    ys.push(badge.point.y - BADGE_HALF, badge.point.y + BADGE_HALF)
  })
  xs.push(centerX - summary.width / 2, centerX + summary.width / 2)
  ys.push(summaryTop, summaryTop + summary.height)

  const shiftX = STAGE_MARGIN - Math.min(...xs)
  const shiftY = STAGE_MARGIN - Math.min(...ys)
  const at = (p) => ({ x: p.x + shiftX, y: p.y + shiftY })
  const round = (v) => Number(v.toFixed(1))

  return {
    nodes: placed.map((node) => ({ ...node, x: node.x + shiftX, y: node.y + shiftY })),
    /*
      끝점도 옮겨서 내보낸다.

      예전에는 `d` 만 옮긴 좌표로 만들고 `start`·`end`·`midpoint` 는 옮기기
      전 값을 그대로 두었다. 한 덩이 안에서 `nodes`·`badges` 는 옮긴 좌표,
      선의 끝점은 안 옮긴 좌표라 **읽는 쪽이 둘을 같이 쓰면 조용히 어긋난다.**
      지금은 `d` 밖에 안 쓰지만 다음 사람이 밟을 자리다.
    */
    links: links.map((link) => {
      const start = at(link.start)
      const end = at(link.end)
      return {
        ...link,
        start,
        end,
        midpoint: at(link.midpoint),
        d: `M${round(start.x)} ${round(start.y)} L${round(end.x)} ${round(end.y)}`,
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
      left: centerX - summary.width / 2 + shiftX,
      top: summaryTop + shiftY,
      width: summary.width,
      height: summary.height,
    },
  }
}
