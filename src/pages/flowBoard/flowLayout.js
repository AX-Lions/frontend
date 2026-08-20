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

/**
 * 그린 것 바깥으로 남기는 여백.
 *
 * 32px 이었다. 링 바깥으로 그만큼씩 비어서, 판을 화면에 맞춰 축소했을 때
 * **프로필이 판 한가운데 작게 모여 앉고 사방이 허옇게 남았다.** 시안처럼
 * 프로필이 판 모서리에 바짝 붙어야 같은 축소율에서 얼굴이 더 크게 나온다.
 * 3px 은 선택 링(`box-shadow`)이 완전히 잘리지 않을 만큼의 최소치다 —
 * 링은 `overflow` 가 걸리지 않은 부모 위로 넘쳐 그려진다.
 */
const STAGE_MARGIN = 3

/** 뱃지 묶음 한 덩이의 대략적인 반지름. 무대 경계를 잴 때만 쓴다. */
const BADGE_HALF = 46

/**
 * 뱃지 묶음과 선 사이의 틈.
 *
 * 예전에는 뱃지가 선 **위에 올라타** 있었고(선의 중점에 그대로 앉혔다),
 * 가리는 것을 감추려고 흰 알약 배경을 깔았다 — 선이 뱃지 밑에서 끊겨 보였다.
 * 시안(`627:3947`)은 선을 안 건드리고 **옆에 나란히** 붙인다. 그래서 선의
 * 법선 방향으로 밀어 놓는다.
 */
const BADGE_LINE_GAP = 2

/** 가로로 누운 뱃지 묶음의 세로 두께 절반. 아이콘 28px 이 곧 두께다. */
const BADGE_ROW_HALF = 14

/**
 * 세로로 선 뱃지 묶음의 가로 폭 절반.
 *
 * 실측 38px(아이콘 28 + 사이 4 + 숫자 한 자리)의 절반이다. 넉넉히 잡아 두면
 * 그만큼 선에서 떨어져 **어느 선에 붙은 숫자인지 눈으로 안 이어진다.**
 */
const BADGE_COLUMN_HALF = 19

/*
  뱃지 묶음의 대략적인 긴 변 길이(정렬 방향으로) — 알약이 하나 늘 때마다
  얼마나 길어지는지. `BADGE_SLIDE` 주석의 실측("3종이면 130px 쯤")에서
  역산한 값이다: 한 종류면 `BADGE_PILL_BASE`, 하나 늘 때마다
  `BADGE_PILL_STEP` 씩 는다.
*/
const BADGE_PILL_BASE = BADGE_COLUMN_HALF * 2 // 38 — 알약 하나
const BADGE_PILL_STEP = 46

/**
 * 뱃지 묶음이 서로, 그리고 노드와 겹치지 않게 자리를 찾는다.
 *
 * 묶음은 **자기 선의 한가운데**에서만 계산된다(`badgeShift`) — 다른 선의
 * 뱃지가 어디 있는지도, 근처에 다른 노드가 있는지도 모른다. 여러 선이 한
 * 노드로 모이면 그 둘레에 뱃지가 한꺼번에 몰려 서로 겹치고, 짧은 선의
 * 뱃지는 아예 상대 노드 위에 올라탄다 — 실제로 회의가 복잡해지면 노드
 * 하나 둘레에 알약이 겹겹이 쌓였다.
 *
 * **선 옆으로 밀지 않고 선을 따라 미끄러뜨린다.** 옆으로 밀면 "화살표에
 * 바짝 붙어 있다" 는 규칙이 깨져 뱃지가 허공에 떠 보인다. 대신 같은
 * 수직 간격(`badgeShift`)을 유지한 채 선 위의 다른 지점(`t`, 0=출발
 * 노드 쪽 · 1=도착 노드 쪽)을 찾으면, 뱃지는 항상 **자기 선에 붙어
 * 있으면서** 겹침만 피한다.
 *
 * 묶음을 회전한 사각형이 아니라 **반지름으로 감싸는 원**으로 본다. 사각형끼리
 * 정확히 검사하려면 회전각마다 분리축을 다시 잡아야 하는데, 원은 각도와
 * 무관하게 안 겹치면 사각형도 반드시 안 겹친다 — 계산은 단순해지고 결과는
 * 더 안전한 쪽(살짝 더 벌어지는 쪽)으로만 어긋난다.
 *
 * 자기 뱃지(`isSelf`)는 옮기지 않는다. 그쪽은 `SELF_BADGE_STEP` 으로 이미
 * 의도적으로 쌓아 둔 자리라, 같은 잣대를 들이대면 원래 디자인을 밀어낸다.
 * 다만 **장애물로는** 넣는다 — 링크 뱃지가 자기 뱃지 위에 앉는 것도 겹침이다.
 */
const BADGE_CLEARANCE = 6

/** 뱃지가 노드 테두리에서 최소한 떨어져야 하는 거리. */
const BADGE_NODE_CLEARANCE = 6

/** 선을 따라 미끄러뜨릴 때, 끝점 마커에 물리지 않도록 남겨 두는 여유. */
const BADGE_SLIDE_MARGIN = 0.06

/** `t` 를 이 간격으로 늘려 가며 후보를 찾는다. 촘촘할수록 정확하지만 느리다. */
const BADGE_SLIDE_STEP = 0.05

function badgeFootprint(badge) {
  const pillCount = Math.max(1, (badge.arrow?.counts ?? []).length)
  const long = BADGE_PILL_BASE + (pillCount - 1) * BADGE_PILL_STEP
  const short = badge.axis === 'column' ? BADGE_PILL_BASE : BADGE_ROW_HALF * 2
  return Math.hypot(long, short) / 2 + BADGE_CLEARANCE
}

/*
  선 위의 매개변수 `t` 에서, 그 선의 고정된 수직 간격을 유지한 자리.

  `side` 는 어느 쪽에 붙일지다(기본 1, 반대쪽 -1). 두 노드 사이를 **양쪽
  방향으로** 잇는 선 한 쌍(A→B 와 B→A)은 서로 나란히 놓여 있어, `t` 를 아무리
  옮겨도 두 선 사이의 수직 거리 자체가 좁으면 뱃지가 몇 종류만 실려도
  맞은편 선의 뱃지와 계속 스친다 — 실제로 여섯 종류를 실은 뱃지에서 이
  경우가 났다. 반대쪽으로 뒤집으면 두 선의 뱃지가 각자 바깥쪽으로 갈라져
  훨씬 넓게 벌어진다.
*/
function badgePointAt(badge, t, side = 1) {
  return {
    x: badge.lineStart.x + (badge.lineEnd.x - badge.lineStart.x) * t + badge.badgeShift.x * side,
    y: badge.lineStart.y + (badge.lineEnd.y - badge.lineStart.y) * t + badge.badgeShift.y * side,
  }
}

/** 후보 자리가 노드·다른 뱃지와 얼마나 겹치는지(0 = 안 겹침). */
function overlapPenalty(point, footprint, obstacles, nodes) {
  let penalty = 0
  nodes.forEach((node) => {
    const minDist = node.r + BADGE_NODE_CLEARANCE + footprint
    const dist = Math.hypot(point.x - node.x, point.y - node.y)
    if (dist < minDist) {
      penalty += minDist - dist
    }
  })
  obstacles.forEach((other) => {
    const minDist = footprint + badgeFootprint(other)
    const dist = Math.hypot(point.x - other.point.x, point.y - other.point.y)
    if (dist < minDist) {
      penalty += minDist - dist
    }
  })
  return penalty
}

/*
  `t=0.5`(선의 한가운데) · 원래 쪽(`side=1`)에서 시작해 양옆으로 번갈아
  넓혀 가며 겹치지 않는 첫 자리를 찾는다. 같은 `t` 에서는 반대쪽(`side=-1`)
  보다 원래 쪽을 먼저 본다 — 뒤집는 것은 옆으로 조금 더 미는 것보다 큰
  변화라, 작은 변화로 풀리면 굳이 뒤집지 않는다.

  가운데에 가장 가까운 자리를 남겨야 "그 화살표의 한가운데쯤"이라는 원래
  자리 감각이 최대한 남는다.

  ## 완전히 안 겹치는 자리가 없을 때

  전에는 여기서 포기하고 노드·다른 뱃지를 한꺼번에 밀어내는 자유 이동으로
  넘어갔다(`escapeCollision`). 그 이동은 선을 아예 참고하지 않아서, 장애물이
  촘촘한 자리에서는 뱃지가 자기 화살표에서 멀리 떨어진 허공에 남았다 —
  "화살표에 붙어 있어야 한다" 는 이 판의 첫 번째 규칙을 깬 것이다.

  대신 **선 위 후보 중 겹침이 가장 적은 자리**를 쓴다. `badgePointAt` 이
  만드는 점은 전부 자기 선 위(고정 수직 간격)에 있으므로, 이렇게 고르면
  뱃지는 어떤 경우에도 선을 벗어나지 않는다 — 아주 드물게 옆 뱃지와 살짝
  겹치더라도, 화살표에서 통째로 떨어져 나가는 것보다는 낫다.
*/
function findClearSlide(badge, footprint, obstacles, nodes) {
  const min = BADGE_SLIDE_MARGIN
  const max = 1 - BADGE_SLIDE_MARGIN
  const ts = [0.5]
  for (let step = BADGE_SLIDE_STEP; step <= 0.5; step += BADGE_SLIDE_STEP) {
    if (0.5 - step >= min) {
      ts.push(0.5 - step)
    }
    if (0.5 + step <= max) {
      ts.push(0.5 + step)
    }
  }

  let best = null
  let bestPenalty = Infinity
  for (const t of ts) {
    for (const side of [1, -1]) {
      const point = badgePointAt(badge, t, side)
      const penalty = overlapPenalty(point, footprint, obstacles, nodes)
      if (penalty === 0) {
        return point
      }
      if (penalty < bestPenalty) {
        bestPenalty = penalty
        best = point
      }
    }
  }
  return best
}

/** 자리를 다 정한 뒤에도 노드 원과 겹치는가 — 다른 뱃지와는 상관없다. */
function overlapsAnyNode(point, footprint, nodes) {
  return nodes.some((node) => {
    const minDist = node.r + BADGE_NODE_CLEARANCE + footprint
    return Math.hypot(point.x - node.x, point.y - node.y) < minDist
  })
}

function resolveBadgeOverlaps(badges, nodes) {
  const placedSoFar = badges.filter((badge) => badge.isSelf)

  badges
    .filter((badge) => !badge.isSelf)
    .forEach((badge) => {
      const footprint = badgeFootprint(badge)
      badge.point = findClearSlide(badge, footprint, placedSoFar, nodes)
      /*
        선 위에서 겹침이 가장 적은 자리를 골라도, 아주 촘촘한 판에서는 그
        자리가 여전히 노드 원 안일 수 있다(위 `findClearSlide` 주석 — 화살표에
        붙어 있는 것이 겹치지 않는 것보다 우선이라 감수한 대가다). 그런
        뱃지만 `crampedNode` 로 표시해 둔다 — `FlowCanvas` 가 이 값을 보고
        알약을 펼쳐 두는 대신 눌러야 펼쳐지는 요약 단추로 접어 그린다.
      */
      badge.crampedNode = overlapsAnyNode(badge.point, footprint, nodes)
      placedSoFar.push(badge)
    })
}

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

/*
  선 끝을 원 테두리에서 얼마나 띄울지.

  출발 쪽(작은 점)과 도착 쪽(화살촉)을 따로 뒀던 적이 있다 — 화살촉이 더 크니
  자리가 더 필요하다는 논리였다. 그런데 마커 자체가 이미 끝점에서 바깥으로
  그려지므로, 게이트를 다르게 두면 오히려 **점 쪽만 노드에 바짝 붙어 보였다.**
  둘을 같은 값으로 맞춘다.
*/
const EDGE_START_GAP = 16
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
function ringRadii(angles, halfWidth, halfHeight) {
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
    rx: Math.max(spacing, reach(halfWidth, maxCos)),
    ry: Math.max(spacing, reach(halfHeight, maxSin)),
  }
}

/**
 * 선의 기울기를 **글자가 뒤집히지 않는 범위**로 접는다.
 *
 * 오른쪽에서 왼쪽으로 가는 선은 각도가 180° 근처라, 그대로 돌리면 아이콘과
 * 숫자가 거꾸로 선다. 180° 를 빼면 같은 기울기의 반대 방향이라 **선과는
 * 여전히 나란하면서** 글자는 바로 선다.
 */
function uprightAngle(dx, dy) {
  const degrees = Math.atan2(dy, dx) * (180 / Math.PI)
  if (degrees > 90) {
    return degrees - 180
  }
  if (degrees < -90) {
    return degrees + 180
  }
  return degrees
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

  const axis = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y) ? 'row' : 'column'

  /*
    뱃지를 밀어낼 방향.

    가로로 누운 선은 **위쪽**, 세로로 선 선은 **오른쪽**으로 민다. 부호를
    선의 진행 방향이 아니라 화면 좌표로 고정해야, 마주 보는 두 화살표의
    뱃지가 서로 반대쪽으로 튀지 않는다.
  */
  const away = axis === 'row'
    ? (normal.y <= 0 ? normal : { x: -normal.x, y: -normal.y })
    : (normal.x >= 0 ? normal : { x: -normal.x, y: -normal.y })

  return {
    start,
    end,
    // 뱃지가 앉을 자리. 직선이라 두 끝의 한가운데이되, 평행선끼리는 선을
    // 따라 앞뒤로 어긋나 앉고, 선 자체는 가리지 않게 옆으로 비켜 앉는다.
    midpoint: {
      x: (start.x + end.x) / 2 + chord.x * slide,
      y: (start.y + end.y) / 2 + chord.y * slide,
    },
    badgeShift: {
      x: away.x * (BADGE_LINE_GAP + (axis === 'row' ? BADGE_ROW_HALF : BADGE_COLUMN_HALF)),
      y: away.y * (BADGE_LINE_GAP + (axis === 'row' ? BADGE_ROW_HALF : BADGE_COLUMN_HALF)),
    },
    /*
      뱃지 묶음을 선과 나란히 눕히는 각도(도).

      비스듬한 선 옆에 수평인 뱃지 줄을 놓으면 어느 선에 붙은 숫자인지
      헷갈린다 — 시안도 선을 따라 기울여 놓았다(`627:3967` 은 -30.38°).
      세로로 선 선은 기울이지 않는다. 90° 돌리면 아이콘과 숫자까지 옆으로
      누워 읽을 수 없고, 그때는 세로로 쌓는 것이 곧 선과 나란한 모양이다.
    */
    angle: axis === 'row' ? uprightAngle(end.x - start.x, end.y - start.y) : 0,
    axis,
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
function collapseAgents(nodes, arrows) {
  const userByOwner = new Map()
  nodes.forEach((node) => {
    if (node.kind === 'USER' && node.user_id) {
      userByOwner.set(node.user_id, node.id)
    }
  })

  /*
    **말을 한 사람**의 id.

    화살표가 나간 노드가 곧 그 회의에서 입을 연 노드다. 받기만 한 사람은
    여기 없다 — 회의에 있었더라도 판 위에서 한 일이 없으므로, 그 사람의
    대리인이 대신 말했다면 그 대리인이 판에 서야 한다.
  */
  const spoke = new Set((arrows ?? []).map((arrow) => arrow.from_node_id))

  const ownerOf = new Map()
  nodes.forEach((node) => {
    // 주인이 이 회의에서 직접 말했을 때만 접는다. 주인이 조용했다면 대리인이
    // 그 자리를 대신한 것이라, 접으면 **사람이 직접 한 말처럼 보인다.**
    const ownerId = node.kind === 'AGENT' && node.user_id
      ? userByOwner.get(node.user_id)
      : undefined
    const owner = ownerId && spoke.has(ownerId) ? ownerId : undefined
    ownerOf.set(node.id, owner ?? node.id)
  })

  /*
    주인도 대리인도 조용한 노드는 판에서 뺀다.

    필터로 화살표가 전부 걸러졌을 때 사람 다섯이 아무 선도 없이 동그라미로만
    남아 있었다. 접힌 대리인을 남기지 않는 것과 같은 이유다 — 판은 오간 것을
    그리는 자리다.
  */
  const touched = new Set()
  ;(arrows ?? []).forEach((arrow) => {
    touched.add(arrow.from_node_id)
    ;(arrow.to_node_ids ?? []).forEach((id) => touched.add(id))
  })

  return {
    kept: nodes.filter((node) => ownerOf.get(node.id) === node.id
      && (touched.size === 0 || touched.has(node.id)
        // 접혀 들어온 대리인의 몫도 주인이 들고 서 있어야 한다.
        || nodes.some((other) => ownerOf.get(other.id) === node.id && touched.has(other.id)))),
    ownerOf,
  }
}

/**
 * 같은 쌍의 화살표를 **한 선으로 합친다.**
 *
 * 서버는 `(보낸 이, 받은 이 묶음)` 마다 arrow 를 하나씩 만든다. 그래서 `A→B` 와
 * `A→B·C` 가 따로 오고, 대리인을 주인에게 접고 나면 `A→B` 와 `A의 Bordo→B` 도
 * 둘 다 `A→B` 가 된다. 그대로 그리면 두 사람 사이에 굵기도 색도 같은 선이 네댓
 * 줄씩 나란히 서는데, **어느 줄이 무엇인지 구별할 방법이 판 위에 없다.**
 * 평행선을 벌리는 장치(`PARALLEL_SPREAD`)는 겹침만 없앨 뿐 뜻을 만들지 못한다.
 *
 * 판이 답해야 하는 질문은 "A 가 B 에게 무엇을 보냈나" 하나다. 그 답의 갈래는
 * **사람이 직접 보낸 것 · 대리인이 낀 것** 둘뿐이므로 한 쌍에 선도 둘이면
 * 족하다. 나머지는 전부 그 두 선의 뱃지 묶음 안으로 들어간다.
 *
 * 합성 arrow 는 서버 arrow 와 **같은 필드 이름**을 갖는다. 패널·페이지가
 * 서버 것과 합친 것을 구별하지 않고 그대로 읽을 수 있어야 하기 때문이다.
 */
function mergedArrowId(fromId, toId, isAi) {
  return `${fromId}~${toId}~${isAi ? 'ai' : 'human'}`
}

function bucketOf(buckets, from, to, isAi) {
  const id = mergedArrowId(from.id, to.id, isAi)
  const seen = buckets.get(id)
  if (seen) {
    return seen
  }

  const bucket = {
    id,
    from,
    to,
    isAi,
    counts: new Map(),
    surfaces: [],
    sourceArrowIds: [],
    sourceLabel: null,
    latestAt: null,
    latestStamp: -Infinity,
    opacity: 1,
  }
  buckets.set(id, bucket)
  return bucket
}

/**
 * 서버 arrow 하나를 묶음에 붓는다.
 *
 * `edge_ids` 를 **Set 으로** 모은다. 같은 arrow 가 한 묶음에 두 번 들어올 수
 * 있어서다 — `to_node_ids` 가 `[강다은, 강다은의 Bordo]` 인 화살표는 접고 나면
 * 같은 노드를 두 번 가리킨다. 그때 `count` 를 그냥 더하면 건수가 두 배로 뛰고,
 * 목 데이터 검사기(`src/mocks/crosscheck.mjs`)가 보는 `count === edge_ids.length`
 * 도 깨진다. 그래서 개수는 더하지 않고 **모인 id 를 세어** 만든다.
 */
function absorbArrow(bucket, arrow) {
  if (!bucket.sourceArrowIds.includes(arrow.id)) {
    bucket.sourceArrowIds.push(arrow.id)
  }
  if (bucket.sourceLabel === null) {
    bucket.sourceLabel = arrow.direction_label ?? null
  }

  ;(arrow.counts ?? []).forEach((entry) => {
    /*
      칸 순서는 **처음 나타난 순서**를 지킨다. `Map` 이 넣은 순서를 지켜 준다.
      여기서 다시 정렬하면 서버가 정해 둔 순서(의견·요청사항·변동사항 …)와
      갈려서, 판의 뱃지 순서와 패널의 카드 순서가 서로 다른 줄로 선다.
    */
    const seat = bucket.counts.get(entry.content_type) ?? {
      content_type: entry.content_type,
      label: entry.label,
      edgeIds: new Set(),
    }
    ;(entry.edge_ids ?? []).forEach((edgeId) => seat.edgeIds.add(edgeId))
    bucket.counts.set(entry.content_type, seat)
  })

  ;(arrow.surfaces ?? []).forEach((surface) => {
    if (!bucket.surfaces.includes(surface)) {
      bucket.surfaces.push(surface)
    }
  })

  /*
    진하기는 **가장 늦은 것**을 따른다. 합친 선 하나가 오래된 발언 때문에
    흐려지면 방금 오간 것이 판에서 안 보인다 — 시간 흐름을 opacity 로만 말하는
    화면이라 이 값이 곧 "최근" 이다.
  */
  const parsed = Date.parse(arrow.latest_occurred_at ?? '')
  const stamp = Number.isNaN(parsed) ? -Infinity : parsed
  if (stamp >= bucket.latestStamp) {
    bucket.latestStamp = stamp
    bucket.latestAt = arrow.latest_occurred_at ?? null
    bucket.opacity = arrow.opacity ?? 1
  }
}

/** 묶음을 **서버 arrow 와 같은 모양**으로 굳힌다. */
function sealBucket(bucket) {
  const counts = [...bucket.counts.values()]
    // 근거(`edge_ids`)가 하나도 없는 칸은 뺀다. 숫자만 있고 열어 볼 것이 없는
    // 뱃지는 눌러도 빈 패널이 뜬다 — 안 보이는 것보다 나쁘다.
    .filter((seat) => seat.edgeIds.size > 0)
    .map((seat) => ({
      content_type: seat.content_type,
      label: seat.label,
      count: seat.edgeIds.size,
      edge_ids: [...seat.edgeIds],
    }))

  return {
    id: bucket.id,
    from_node_id: bucket.from.id,
    to_node_ids: [bucket.to.id],
    /*
      자기 대리인과 오간 묶음은 접고 나면 양 끝이 같은 사람이라, 이름을 두 번
      쓰면 `강다은 → 강다은` 이 된다. 그때만 서버가 준 문구(`강다은 → 강다은의
      Bordo`)를 그대로 쓴다 — 판에서 대리인 이름이 남는 유일한 자리다.
    */
    direction_label: bucket.from.id === bucket.to.id && bucket.sourceLabel
      ? bucket.sourceLabel
      : `${bucket.from.name} → ${bucket.to.name}`,
    // 패널이 "대리인이 날랐다" 를 말할 때 쓴다. 선 색과 같은 이야기지만, 글로
    // 말하는 쪽은 색을 볼 수 없으므로 값으로도 실어 보낸다.
    via_agent: bucket.isAi,
    counts,
    total_count: counts.reduce((sum, entry) => sum + entry.count, 0),
    latest_occurred_at: bucket.latestAt,
    opacity: bucket.opacity,
    surfaces: bucket.surfaces,
    // 어떤 서버 arrow 들이 합쳐졌는지. 판에서 숫자가 이상할 때 되짚을 실이다.
    source_arrow_ids: bucket.sourceArrowIds,
  }
}

/**
 * `visibleEdgeIds` 에 든 엣지만 남기고 뱃지 숫자를 **다시 센다.**
 *
 * 더하지 않고 다시 세는 이유는 `count === edge_ids.length` 를 깨지 않기
 * 위해서다. 남은 것이 없는 칸은 통째로 뺀다 — `0` 이라고 적힌 뱃지는 "아직 안
 * 왔다" 가 아니라 "0 건이 왔다" 로 읽힌다.
 */
function maskCounts(counts, visibleEdgeIds) {
  return (counts ?? [])
    .map((entry) => {
      const edgeIds = (entry.edge_ids ?? []).filter((edgeId) => visibleEdgeIds.has(edgeId))
      return edgeIds.length === 0 ? null : { ...entry, count: edgeIds.length, edge_ids: edgeIds }
    })
    .filter(Boolean)
}

/**
 * 캔버스 한 판을 만든다.
 *
 * @param nodes  `GET .../flow` 의 `nodes`
 * @param arrows `GET .../flow` 의 `arrows`
 * @param options `summaryRows` — 요약표 세 열 중 가장 긴 열의 줄 수.
 *                상자 높이가 곧 그래프가 시작하는 자리라 배치에 필요하다.
 *                `boardWidth` · `boardHeight` — 판이 실제로 차지할 수 있는
 *                크기(`.board-center-frame`). 0 이면 예전처럼 고정 링을 쓴다.
 *                `visibleEdgeIds` — `Set<string>` 또는 `null`. 재생이 쓴다.
 *                `null` 이면 전부 보인다. Set 이면 **뱃지 숫자만** 그 안에 든
 *                엣지로 깎이고, 배치는 거르기 전 전체 그대로다(아래 ★ 참고).
 * @returns `{ nodes, links, badges, stage, summary }`
 */
export function buildFlowLayout(
  nodes = [],
  arrows = [],
  { summaryRows = 0, boardWidth = 0, boardHeight = 0, visibleEdgeIds = null } = {},
) {
  const raw = nodes.filter(Boolean)
  // 접기 전 노드를 들고 있어야 선 색을 정할 수 있다. 접은 뒤에는 전부 사람이다.
  const rawById = new Map(raw.map((node) => [node.id, node]))
  const { kept, ownerOf } = collapseAgents(raw, arrows)
  const ordered = orderNodes(kept)
  const angles = ringAngles(ordered.length)
  const summary = { width: SUMMARY_WIDTH, height: summaryHeight(summaryRows) }

  /*
    링을 **판 크기에 맞춰 벌린다.**

    고정 링(592px 폭)은 판이 아무리 넓어도 그대로라, 1440px 화면에서 프로필
    넷이 가운데 좁게 모여 앉고 좌우가 통째로 비었다. 판이 얼마나 큰지는
    화면만 알기 때문에(`boardWidth`·`boardHeight`) 밖에서 받아서 쓴다.

    빼는 값의 뜻:
    - `NODE_RADIUS`  링 반지름은 원의 **중심**까지다. 원 바깥 테두리가 경계에
                     닿아야 하므로 반지름 하나만큼 안으로 들인다.
    - `STAGE_MARGIN` 모서리와의 틈(3px).
    세로는 위쪽을 요약표가 이미 쓰고 있으므로 그만큼 뺀 나머지를 나눈다.

    값이 안 오면(첫 렌더·측정 실패) 예전 고정값이 그대로 바닥이 된다 —
    `Math.max` 라 판이 좁아도 링이 오그라들지는 않는다.
  */
  const usableWidth = boardWidth - STAGE_MARGIN * 2 - NODE_RADIUS * 2
  const usableHeight = boardHeight - STAGE_MARGIN * 2 - summary.height - SUMMARY_GAP - NODE_RADIUS * 2
  const { rx, ry } = ringRadii(
    angles,
    Math.max(RING_HALF_WIDTH, usableWidth / 2),
    Math.max(RING_HALF_HEIGHT, usableHeight / 2),
  )

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
    서버 arrow 를 `(from, to, isAi)` 묶음에 붓는다. 합치는 이유는
    `mergedArrowId` 위 주석에 적었다.

    **거르지 않은 `arrows` 전부**를 훑는다. `visibleEdgeIds` 는 여기 끼지
    않는다 — 아래 ★ 주석 참고.
  */
  const pairBuckets = new Map()
  const selfBuckets = new Map()

  arrows.forEach((arrow) => {
    const fromRaw = rawById.get(arrow.from_node_id)
    const from = byId.get(ownerOf.get(arrow.from_node_id))
    if (!from) {
      return
    }

    /*
      이 화살표가 **받는 사람마다 어느 갈래로 갈지**를 먼저 정한다.

      바로 묶음에 부으면 안 된다. `[강다은, 강다은의 Bordo]` 처럼 한 사람과 그
      사람의 대리인이 같은 화살표에 함께 실리면, 접은 뒤 둘 다 `강다은` 인데
      갈래만 갈려 **회색 선과 주황 선 양쪽에 같은 건수가 실린다.** 판 전체
      합계로는 한 번 오간 것이 두 번 센 것이 된다.

      그때는 **주황 쪽만 남긴다.** 대리인이 끼었다는 것이 이 화면이 파는 사실
      이고, 회색으로 접어 넣으면 그 사실이 통째로 사라진다. 반대로 주황만 남기면
      "사람에게도 같이 갔다" 가 흐려지지만, 그건 화살표를 눌러 연 패널의 카드가
      말해 준다 — 판은 한 번 일어난 일을 한 번만 그려야 한다.

      목 데이터에는 아직 이런 화살표가 없다. 없을 때 미리 막아 두는 이유는,
      생겼을 때 드러나는 모습이 **"숫자가 좀 이상하다"** 뿐이라 아무도 결함으로
      읽지 않기 때문이다.
    */
    const branchOf = new Map()
    const selfBranch = new Map()

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
      const lane = to.id === from.id ? selfBranch : branchOf
      lane.set(to.id, { to, isAi: (lane.get(to.id)?.isAi ?? false) || isAi })
    })

    branchOf.forEach(({ to, isAi }) => {
      absorbArrow(bucketOf(pairBuckets, from, to, isAi), arrow)
    })

    /*
      선이 하나도 안 그려진 화살표만 자기 뱃지가 된다.

      한 화살표가 자기 대리인과 남에게 같이 갔다면 숫자는 이미 선 쪽에 붙는다.
      양쪽에 다 붙이면 **같은 건수가 두 번 일어난 것처럼 읽힌다.**
    */
    if (branchOf.size === 0) {
      selfBranch.forEach(({ to, isAi }) => {
        absorbArrow(bucketOf(selfBuckets, to, to, isAi), arrow)
      })
    }
  })

  /*
    같은 두 노드를 잇는 선이 몇 번째인지 세어 둔다.

    합치고 나면 한 쌍에 최대 넷이다 — 양방향 × (사람·대리인). 그래도 겹치는
    것은 겹치므로 오프셋은 여전히 필요하다. 넷일 때 간격은
    `(MAX_PARALLEL_OFFSET × 2) / 3 ≈ 27px` 로 좁혀지고, 그만큼 밀어도 끝점은
    원 안에서 출발한다(`√(62² − 40.3²) ≈ 47`). 방향이 달라도 겹치는 것은
    마찬가지라 정렬한 쌍을 키로 쓴다.
  */
  const pairSlots = new Map()
  const pending = [...pairBuckets.values()].map((bucket) => {
    const pairKey = [bucket.from.id, bucket.to.id].sort().join('|')
    const slot = pairSlots.get(pairKey) ?? 0
    pairSlots.set(pairKey, slot + 1)

    return {
      arrow: sealBucket(bucket),
      from: bucket.from,
      to: bucket.to,
      isAi: bucket.isAi,
      pairKey,
      slot,
    }
  })

  const links = pending.map(({ arrow, from, to, isAi, pairKey, slot }) => {
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
      // 합성 arrow 하나가 곧 선 하나라 `::받는 이` 꼬리표가 필요 없다. 예전에는
      // 한 화살표가 여러 팔로 갈라져 그 꼬리표로만 key 가 갈렸다.
      id: arrow.id,
      arrowId: arrow.id,
      arrow,
      fromId: from.id,
      toId: to.id,
      isAi,
      opacity: arrow.opacity ?? 1,
      ...lineBetween(from, to, offset, rank * forward),
    }
  })

  /*
    뱃지는 **선마다 하나**다.

    합치기 전에는 화살표 하나가 여러 팔로 갈라져서, 팔마다 숫자를 붙이면 같은
    일이 네 번 일어난 것처럼 읽혔다. 그래서 실제로 그린 첫 팔에만 붙였다
    (`isBadgeAnchor`). 이제 선 하나가 곧 한 쌍의 한 갈래라 그 장치가 필요
    없어졌다 — 붙일 자리가 애초에 하나뿐이다.

    여기서는 **거르기 전** 전체로 만든다. 무대 경계를 이 목록으로 재기
    때문이다. 실제로 내보낼 때 안 보이는 것을 걸러 낸다.
  */
  const badges = links
    .filter((link) => (link.arrow.counts ?? []).length > 0)
    .map((link) => ({
      id: link.arrowId,
      arrow: link.arrow,
      isAi: link.isAi,
      isSelf: false,
      // `resolveBadgeOverlaps` 가 겹침을 피해 이 선 위 다른 자리를 찾을 때
      // 쓴다. 최종 `point` 는 거기서 다시 정해진다 — 여기 값은 "아직 아무와도
      // 안 겹쳤을 때" 의 기본 자리(한가운데)일 뿐이다.
      lineStart: link.start,
      lineEnd: link.end,
      badgeShift: link.badgeShift,
      point: {
        x: link.midpoint.x + link.badgeShift.x,
        y: link.midpoint.y + link.badgeShift.y,
      },
      angle: link.angle,
      axis: link.axis,
    }))

  /*
    자기 대리인과 오간 것을 노드 바깥에 쌓는다.

    링 중심의 **반대쪽**으로 민다. 안쪽으로 밀면 요약표·다른 선과 겹치는데,
    바깥은 어차피 비어 있다. 한 사람에게 여럿이면 같은 방향으로 더 밀어 쌓는다.

    선과 같은 규칙으로 합쳐서 **노드당 뱃지 묶음도 최대 둘**(사람·대리인)이다.
    합치기 전에는 대리인에게 지시할 때마다 알약이 하나씩 바깥으로 쌓여서, 회의
    한 판이면 노드 옆에 숫자 기둥이 섰다.
  */
  const selfByNode = new Map()
  const selfEntries = [...selfBuckets.values()]
    .map((bucket) => ({ arrow: sealBucket(bucket), node: bucket.from, isAi: bucket.isAi }))
    .filter((entry) => entry.arrow.counts.length > 0)

  selfEntries.forEach((entry) => {
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
        // 자기 뱃지는 붙을 선이 없다. 기울일 기준도 없으므로 눕히지 않는다.
        angle: 0,
        axis: 'row',
      })
    })
  })

  resolveBadgeOverlaps(badges, placed)

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

  /*
    ★ `visibleEdgeIds` 가 손대는 **유일한** 자리다.

    재생은 0.5 초마다 이 함수를 다시 부르며 `visibleEdgeIds` 를 키운다. 그 사이
    노드 자리·선 각도·무대 크기가 한 픽셀이라도 움직이면 판 전체가 0.5 초마다
    덜컹거려서 **무엇이 늘어났는지를 볼 수가 없다.** 늘어난 것을 보라고 만든
    기능인데 그것 하나가 안 보이게 된다.

    그래서 위쪽은 전부 **거르지 않은 `arrows`** 로 계산했다 — 접기·정렬·각도·
    반지름·평행선 슬롯·오프셋, 그리고 `xs`·`ys` 경계까지. 거르기는 다 그린 뒤
    뱃지 숫자에만 건다.

    안 보이는 선을 배열에서 빼지 않고 `isVisible` 로 **표시만** 하는 것도 같은
    결이다. 빼 버리면 읽는 쪽이 배열 순서나 길이에 기대고 있을 때 조용히
    어긋나고, 다시 나타날 때 React 가 노드를 새로 만든다.

    한 합성 arrow 를 선과 뱃지가 같이 들고 있으므로 깎은 것을 **한 번만 만들어
    나눠 쓴다.** 따로 만들면 같은 화살표인데 객체가 둘이라, 참조로 비교하는
    코드가 생기는 순간 어긋난다.
  */
  const maskedArrows = new Map()
  const maskArrow = (arrow) => {
    if (!visibleEdgeIds) {
      return arrow
    }

    const seen = maskedArrows.get(arrow.id)
    if (seen) {
      return seen
    }

    const counts = maskCounts(arrow.counts, visibleEdgeIds)
    const masked = {
      ...arrow,
      counts,
      total_count: counts.reduce((sum, entry) => sum + entry.count, 0),
    }
    maskedArrows.set(arrow.id, masked)
    return masked
  }

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
      const arrow = maskArrow(link.arrow)

      return {
        ...link,
        arrow,
        // 거르기가 없으면 늘 보인다. 걸렸을 때만 "남은 칸이 있느냐" 를 본다 —
        // 근거가 하나도 안 남은 선은 그 시점에 아직 일어나지 않은 일이다.
        isVisible: !visibleEdgeIds || arrow.counts.length > 0,
        start,
        end,
        midpoint: at(link.midpoint),
        d: `M${round(start.x)} ${round(start.y)} L${round(end.x)} ${round(end.y)}`,
      }
    }),
    // 뱃지는 반대로 **빼서** 내보낸다. 선은 자리를 지켜야 판이 안 흔들리지만,
    // 알약은 숫자가 0 이면 그릴 것이 없다.
    badges: badges
      .map((badge) => ({
        ...badge,
        arrow: maskArrow(badge.arrow),
        x: badge.point.x + shiftX,
        y: badge.point.y + shiftY,
      }))
      .filter((badge) => (badge.arrow.counts ?? []).length > 0),
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
