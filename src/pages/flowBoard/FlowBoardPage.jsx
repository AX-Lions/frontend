import { useEffect, useMemo, useRef, useState } from 'react'

import { useSearchParam } from '../../app/navigation.js'
import './flowBoard.css'
import { FlowBriefingSidebar } from './FlowBriefingSidebar'
import { FlowCanvas } from './FlowCanvas'
import { FlowEdgePanel, FlowNodePanel } from './FlowInspectorPanel'
import { FlowNavigationSidebar } from './FlowNavigationSidebar'
import { FlowPlaybackLog } from './FlowPlaybackLog.jsx'
import { FlowRail } from './FlowRail'
// 팀 전환하기는 홈에서 먼저 생겼다. 회의 화면에도 같은 팝업이 필요해져
// 여기서 그대로 가져다 쓴다 — 팝업 하나 때문에 `pages/home` 전체를
// `shared` 로 옮기면 그쪽에 남는 `NewProjectDialog` 등도 다 옮겨야 한다.
import { TeamSwitchDialog } from '../home/TeamSwitchDialog.jsx'
import { icons, toneLabels } from './flowBoard.api'
import { fetchBriefing, toneOf } from './flowBoard.data'
import { buildFlowLayout } from './flowLayout'

/**
 * 판 위에 얹힌 회의 제목 줄의 높이.
 * `.board-center-frame { min-height: calc(100% - 64px) }` 과 짝이다.
 */
const MEETING_TITLE_HEIGHT = 64
import {
  MEETING_MODE,
  WORK_MODE,
  useEdgeDetails,
  useFlowBoardMeeting,
  useFlowGraph,
  useFlowTimeline,
  useMe,
  useProjectMeetings,
} from './useFlowBoardData'
import { FlowAgendaPanel } from './FlowAgendaPanel.jsx'
import { useFlowBoard } from './useFlowBoard'
import { useFlowBoardUi } from './useFlowBoardUi'
import { useFlowPlayback } from './useFlowPlayback'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

/**
 * 요약표 3열.
 *
 * 서버는 `discovered_issues` · `changes` · `next_plans` 세 배열로 준다. 제목은
 * 화면 라벨을 따른다 — 중앙 요약표 헤더가 `변동 사항` 이라 `changes` 를
 * `변동 사항` 으로 읽는다.
 */
/*
  한 칸은 문자열일 수도, 상세가 딸린 객체일 수도 있다.

  **문자열을 계속 받는 것이 중요하다.** 상세(맥락·갈린 지점)는 이 화면이
  먼저 요구한 것이라 서버는 당분간 지금처럼 문자열만 내려 준다. 객체만
  받게 만들면 그날 요약표가 통째로 빈칸이 된다.

  상세가 없는 칸은 `detail` 이 `null` 이고, 눌렀을 때 안건 패널 대신
  브리핑이 열린다 — 열어 봐야 아무것도 없는 패널을 띄우지 않는다.
*/
function toSummaryItem(item) {
  if (typeof item === 'string') {
    return { text: item, detail: null }
  }
  const text = item?.text ?? ''
  // `맥락도 갈린 지점도 결론도 없는 객체` 는 문자열과 다를 바 없다.
  const hasDetail = Boolean(item?.context || item?.debates?.length || item?.resolution)
  return { text, detail: hasDetail ? item : null }
}

function toSummaryColumns(summary) {
  if (!summary) {
    return []
  }
  const column = (title, items) => ({ title, items: (items ?? []).map(toSummaryItem) })
  return [
    column('발견한 문제', summary.discovered_issues),
    column('변동 사항', summary.changes),
    column('이후 계획', summary.next_plans),
  ]
}

/** 주소에 회의를 남긴다. 새로고침해도 방금 고른 회의가 그대로 열려야 한다. */
function rememberMeetingInUrl(meetingId) {
  const url = new URL(window.location.href)
  url.searchParams.set('meeting', meetingId)
  window.history.replaceState({}, '', url)
}

export function FlowBoardPage() {
  const entryParams = new URLSearchParams(window.location.search)
  const [mode, setMode] = useState(MEETING_MODE)
  const [switchingTeam, setSwitchingTeam] = useState(false)

  /*
    주소의 회의·프로젝트를 **계속 지켜본다.**

    한 번만 읽으면 뒤로 가기가 먹통이 된다. 주소는 `?meeting=A` 로 돌아갔는데
    화면은 회의 B 그대로고, 그 상태로 새로고침하면 갑자기 A 로 바뀐다.

    헤더에서 고른 회의(`pick`)는 **그 주소에 대해서만** 유효하다. 주소가
    달라지면 고른 것은 버린다 — 주소가 이긴다. 그래야 뒤로 가기로 돌아온
    회의가 화면에 뜬다.
  */
  const urlMeetingId = useSearchParam('meeting')
  const urlProjectId = useSearchParam('project')
  const [pick, setPick] = useState(null)
  const pickedMeetingId = pick && pick.forUrl === urlMeetingId ? pick.id : null
  const setPickedMeetingId = (id) => setPick({ forUrl: urlMeetingId, id })
  const [panel, setPanel] = useState(
    entryParams.get('source') === 'bordo-briefing' ? { kind: 'briefing' } : null,
  )
  const [activeChip, setActiveChip] = useState(null)
  const [activeSummaryItem, setActiveSummaryItem] = useState(null)

  /*
    고른 것이 아니라 **끈 것**을 담는다.

    고른 것을 담으면 목록이 도착하기 전에는 "아직 모른다"(null)와 "아무것도 안
    골랐다"(빈 배열)를 구별해야 하고, 목록이 오는 순간 effect 로 초기화해야 한다.
    끈 것을 담으면 처음이 빈 배열 하나뿐이라 그 단계가 통째로 없어진다.
  */
  const [excludedContents, setExcludedContents] = useState([])

  const me = useMe()
  const meeting = useFlowBoardMeeting(pickedMeetingId, urlMeetingId, urlProjectId)
  const meetingId = meeting.data?.meetingId ?? null
  // 회의 상세에서 꺼내지 않는다. **회의가 없는 프로젝트도 자기 id 와 이름을
  // 알아야** 하는데, 그때는 상세가 없다.
  const projectId = meeting.data?.projectId ?? null
  const projectName = meeting.data?.projectName ?? ''

  /*
    브리핑을 **실제로 열었을 때만** 읽음으로 올린다.

    이 화면은 패널을 열든 말든 회의를 열 때 브리핑을 부른다. 그래서 회의 화면에
    잠깐 들른 것만으로 홈의 `Bordo 브리핑 보러가기` 가 사라졌다 — 사용자는 읽은
    적이 없는데 읽은 것이 된다. 자동 조회는 `markRead: false` 로 바꿨고, 올리는
    것은 여기 한 곳이다.

    회의마다 한 번만 보낸다. 패널을 닫았다 다시 열 때마다 보내면 같은 요청이
    의미 없이 반복된다 — 이미 읽음인 것을 다시 읽음으로 만들 뿐이다.

    실패는 삼킨다. 읽음 표시를 못 올렸다고 브리핑을 못 보여 줄 이유가 없다.
  */
  const markedMeetingRef = useRef(null)
  const briefingOpen = panel?.kind === 'briefing'
  useEffect(() => {
    if (!briefingOpen || !meetingId || markedMeetingRef.current === meetingId) {
      return
    }
    markedMeetingRef.current = meetingId
    fetchBriefing(meetingId).catch(() => {})
  }, [briefingOpen, meetingId])

  const ui = useFlowBoardUi()
  const timeline = useFlowTimeline(mode, meetingId, projectId)
  const meetingList = useProjectMeetings(projectId, ui.isMeetingMenuOpen)

  /*
    회의 목록은 바깥을 눌러도 닫혀야 한다.

    열린 목록이 판 왼쪽 위를 덮고 있어, 안 닫히면 그 아래에 있는 것을 대신
    가로챈다 — 사용자는 왜 안 눌리는지 모른 채 같은 자리를 다시 누른다.
    `Escape` 도 같은 이유로 받는다. 키보드로 연 사람에게는 그쪽이 먼저다.

    `pages/home/Sidebar.jsx` 의 회의 드롭다운이 같은 모양을 쓴다.

    판 드래그와는 부딪히지 않는다. `useFlowBoard` 의 `BOARD_INTERACTIVE` 에
    `.meeting-menu` 와 `.meeting-title button` 이 들어 있어, 팝업 안을 누르는
    것은 패닝으로 먹히지 않는다.
  */
  const meetingMenuRef = useRef(null)
  // `ui` 를 통째로 의존성에 넣으면 `useFlowBoardUi` 가 렌더마다 새 객체를 주므로
  // 리스너를 매 렌더 떼었다 다시 단다. 꺼내 쓰는 둘만 본다.
  const { isMeetingMenuOpen, setIsMeetingMenuOpen } = ui
  useEffect(() => {
    if (!isMeetingMenuOpen) {
      return undefined
    }
    const close = (event) => {
      if (!meetingMenuRef.current?.contains(event.target)) {
        setIsMeetingMenuOpen(false)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setIsMeetingMenuOpen(false)
      }
    }
    /*
      버블 단계가 아니라 **캡처 단계**에서 듣는다.

      판 위 화살표에는 `FlowCanvas` 가 누를 자리를 넓힌 보이지 않는 선
      (`.flow-link-hit`)이 깔려 있고, 그 선은 판 드래그가 시작되지 않도록
      `pointerdown` 에서 `stopPropagation()` 을 부른다. 그 넓은 선이 판의 빈
      자리처럼 보이는 곳도 꽤 덮고 있어서, 버블 단계에서 들으면 그 위를
      누를 때마다 이 이벤트가 `document` 까지 못 올라와 메뉴가 안 닫혔다.
      캡처 단계는 버블보다 먼저(위에서 아래로) 도니 그 `stopPropagation()`
      보다 앞서 실행된다.
    */
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [isMeetingMenuOpen, setIsMeetingMenuOpen])

  /*
    좌측 `시간순 인덱스`. 회의에서 오간 전달 내용을 한 건씩 시간 오름차순으로
    세운 목록이고, **맥락 재생의 대본**이기도 하다.
  */
  const timelineItems = useMemo(() => timeline.data?.results ?? [], [timeline.data])

  /*
    조회는 **늘 거르지 않은 한 번**이다.

    내용 종류 필터가 남아 있지만 조건으로 서버에 싣지 않고 화면에서 건다.
    이유는 두 가지다.

    ① 서버에 실으면 응답이 바뀌어 **노드가 사라지고 링이 다시 잡힌다.**
       종류 하나를 껐다 켤 때마다 사람들이 자리를 바꿔 앉으면, 판이 무엇을
       거른 것인지가 아니라 판이 통째로 바뀐 것으로 읽힌다.
    ② 거른 응답에서 종류 목록을 뽑으면 `의견` 을 끄는 순간 `의견` 칸 자체가
       사라져 **다시 켤 방법이 없다.** 예전에는 그것 때문에 거르지 않은 조회를
       하나 더 두었는데(`useFlowOptions`), 화면에서 거르면 그 조회가 필요 없다.

    맥락 재생과 장치도 하나로 합쳐진다 — 둘 다 "어느 엣지를 그릴지" 한 집합으로
    말한다.
  */
  const flow = useFlowGraph({ mode, meetingId, projectId })

  /*
    내용 종류 필터.

    목록은 **거르지 않은 조회**에서 받는다(위 주석 ①②). 판에 한 번도 안 나온
    종류는 애초에 칸이 없다 — 서버가 그렇게 준다.
  */
  const allContents = useMemo(
    () => flow.data?.filter_options?.content_types ?? [],
    [flow.data],
  )
  const pickedContents = useMemo(
    () => allContents.filter((value) => !excludedContents.includes(value)),
    [allContents, excludedContents],
  )

  const contentRows = allContents.map((value) => ({
    value,
    name: toneLabels[toneOf(value)] ?? value,
    tone: toneOf(value),
    checked: !excludedContents.includes(value),
  }))

  const toggleContent = (value) => setExcludedContents((current) => (
    current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  ))

  // 전부 끄면 그릴 것이 없다. 판이 비는 것이 맞고, 그때는 안내를 겹쳐 띄운다.
  const nothingPicked = allContents.length > 0 && pickedContents.length === 0

  /*
    종류 필터를 통과한 줄.

    `seq` 는 **거르기 전 회의 전반의 번호 그대로**다. 걸러 놓고 1부터 다시
    매기면 우측 패널 카드의 번호와 갈리고, 무엇보다 `요청사항만 보기` 로
    3번이었던 것이 1번이 되어 회의 어디쯤 이야기였는지가 사라진다.
  */
  const pickedTimeline = useMemo(
    () => timelineItems
      .filter((item) => !excludedContents.includes(item.content_type))
      /*
        `order` 는 **거른 뒤 목록에서 몇 번째 줄인지**다. 재생은 보이는 줄을
        순서대로 짚으므로 진행 상태를 이 값으로 재야 한다. 화면에 찍히는 번호는
        그대로 `seq`(회의 전반 순번)다 — 둘을 한 값으로 묶으면 필터를 거는 순간
        둘 중 하나가 반드시 틀린다.
      */
      .map((item, index) => ({ ...item, order: index + 1 })),
    [timelineItems, excludedContents],
  )

  /*
    같은 제목("회의 일정 조율" 처럼)이 여러 번 오간 것을 한 줄로 묶는다.

    한 주제를 두고 여러 차례 주고받으면 시간순 인덱스에 같은 제목이 그
    횟수만큼 반복됐다 — 목록을 훑는 사람은 "몇 번째 회의 일정 조율" 이
    아니라 "이 주제가 언제 오갔나" 를 본다. 처음 나온 자리를 그 주제의
    자리로 삼고, 같은 제목의 나머지는 그 자리에 묶어 넣는다.

    `related_edge_ids` 를 여기서 만든다 — 판 강조(`highlightedEdgeIds`)가
    이미 `item.related_edge_ids ?? [item.edge_id]` 를 읽으므로, 묶은 결과에
    이 필드를 채워 두면 그쪽 코드를 안 건드리고도 "이 줄을 고르면 소속된
    화살표 전부가 함께 강조된다" 가 그대로 성립한다. 개별 항목이 이미
    `related_edge_ids` 를 갖고 있을 수도 있어(그 항목 자체가 여러 화살표를
    가리키는 결론일 때) 그것까지 모두 펼쳐 합친다.

    `seq`·`order` 는 묶은 뒤의 자리로 다시 매긴다 — 그래야 목록에 찍히는
    번호가 화면에 보이는 줄 수와 맞고, 같은 번호가 반복되지 않는다.
  */
  const groupedTimeline = useMemo(() => {
    const groups = []
    const byTitle = new Map()
    pickedTimeline.forEach((item) => {
      let group = byTitle.get(item.title)
      if (!group) {
        group = { ...item, memberItems: [], related_edge_ids: [] }
        byTitle.set(item.title, group)
        groups.push(group)
      }
      group.memberItems.push(item)
      ;(item.related_edge_ids ?? [item.edge_id]).forEach((id) => {
        if (!group.related_edge_ids.includes(id)) {
          group.related_edge_ids.push(id)
        }
      })
    })
    return groups.map((group, index) => ({ ...group, seq: index + 1, order: index + 1 }))
  }, [pickedTimeline])

  /*
    맥락 재생.

    좌측 목록의 `총 몇 건` 만 알면 되므로 대본 자체는 넘기지 않는다 — 훅이
    목록을 들고 있으면 회의를 바꿀 때마다 배열 신원이 바뀌어 타이머가 괜히
    다시 걸린다. 거른 목록을 기준으로 센다 — 화면에 안 보이는 줄을 기다리며
    판이 0.5초씩 멈춰 있으면 재생이 멎은 것으로 보인다.
  */
  const playback = useFlowPlayback(groupedTimeline.length)
  const { stop: stopPlayback } = playback

  /*
    회의·모드가 바뀌면 재생을 끈다.

    `총 건수` 만 보고 끄면 **건수가 우연히 같은 회의로 넘어갔을 때 안 꺼진다.**
    그러면 새 판 위에서 남의 회의 순서대로 화살표가 돋아난다.
  */
  useEffect(() => {
    stopPlayback()
  }, [meetingId, mode, stopPlayback])

  /*
    지금 판에 보여야 하는 엣지. **종류 필터와 맥락 재생이 같은 집합에 실린다.**

    둘을 따로 두면 "필터로 꺼진 것" 과 "아직 재생이 안 닿은 것" 을 판이 두 가지
    방식으로 지우게 되고, 겹쳤을 때 어느 쪽이 이기는지가 코드 두 군데에 흩어진다.

    아무것도 안 거르고 재생도 안 하면 `null` 이다 — 거르지 않는다는 뜻이라
    배치가 예전과 한 글자도 다르지 않게 나온다. 재생이 **끝났을 때도** 필터만
    남으므로 끝까지 누적된 판이 그대로 있다.

    재생 중 `step` 이 0 이면 빈 `Set` 이다. 화살표가 하나도 없는 판에서 시작해야
    "지워졌다가 하나씩 쌓인다" 가 눈에 보인다.
  */
  const visibleEdgeIds = useMemo(() => {
    /*
      재생 중에는 **묶은 단위**로 짚는다 — 한 걸음이 곧 한 주제라, 그 주제에
      묶인 화살표 전부가 같은 걸음에서 한꺼번에 돋아난다. 재생이 아닐 때는
      (필터만 걸렸을 때) 묶지 않은 목록 그대로 쓴다 — 필터는 주제 단위가
      아니라 종류 단위라 묶을 이유가 없다.
    */
    const script = playback.isPlaying
      ? groupedTimeline.slice(0, playback.step)
      : pickedTimeline
    if (!playback.isPlaying && excludedContents.length === 0) {
      return null
    }
    /*
      **묶음이 걸러진 것을 다시 끌고 들어오지 못하게 막는다.**

      한 줄이 여러 화살표를 대표할 수 있다(`related_edge_ids` — 같은 안건에
      묶인 것들). 그 목록을 그대로 펼치면 **종류가 다른 형제 화살표까지 같이
      켜진다.** 그래서 `요청사항` 하나만 켰는데 판에는 결론도 의견도 그대로
      남고, 둘 다 켜야 비로소 화면과 체크가 맞는 것처럼 보였다.

      줄이 아니라 **화살표 하나하나의 종류**로 다시 거른다. 인덱스에 없는
      id 는 종류를 알 수 없으므로 남긴다 — 모른다고 지우면 필터를 하나만 켜도
      판이 뭉텅이로 비어 버린다.
    */
    const typeOf = new Map(timelineItems.map((item) => [item.edge_id, item.content_type]))
    const dropped = (id) => {
      const type = typeOf.get(id)
      return type !== undefined && excludedContents.includes(type)
    }

    const shown = new Set()
    script.forEach((item) => {
      (item.related_edge_ids ?? [item.edge_id]).forEach((id) => {
        if (!dropped(id)) {
          shown.add(id)
        }
      })
    })
    return shown
  }, [playback.isPlaying, playback.step, groupedTimeline, pickedTimeline,
      excludedContents, timelineItems])

  /*
    엣지 하나가 회의 전반에서 몇 번째인지.

    좌측 목록과 우측 패널이 **같은 번호**를 써야 한 쪽에서 본 것을 다른 쪽에서
    되찾을 수 있다. 번호를 매기는 곳이 둘이면 그날로 갈린다.
  */
  const seqOf = useMemo(() => {
    const bySeq = new Map(timelineItems.map((item) => [item.edge_id, item.seq]))
    return (edgeId) => bySeq.get(edgeId) ?? null
  }, [timelineItems])

  const summaryColumns = useMemo(
    () => toSummaryColumns(meeting.data?.summary),
    [meeting.data],
  )

  /*
    요약표에서 가장 긴 열의 줄 수.

    배치보다 **먼저** 구해야 한다. 요약표가 판 맨 위에 고정되면서 상자의
    아래 경계가 곧 그래프가 시작하는 자리가 됐다. 높이를 모르면 노드를
    어디부터 앉힐지 정할 수 없다 — 넉넉히 잡으면 상자와 노드 사이가 허옇게
    뜨고, 모자라게 잡으면 상자가 노드를 덮는다.

    작업 모드는 요약표 자리에 "아직 서버에 없습니다" 안내문만 뜨므로 0 이다.
  */
  const summaryRows = useMemo(
    () => (mode === WORK_MODE
      ? 0
      : summaryColumns.reduce((rows, column) => Math.max(rows, column.items.length), 0)),
    [mode, summaryColumns],
  )

  /*
    판이 실제로 차지할 수 있는 크기.

    링 반지름을 여기 맞춰 벌려야 프로필이 판 모서리에 붙는다(`flowLayout` 의
    `usableWidth` 주석 참고). 재는 대상은 **`.flow-board`(스크롤 상자)** 다 —
    안쪽 `.board-center-frame` 은 `width: max-content` 라 내용이 커지면 같이
    커진다. 그것을 재면 판이 커질 때마다 링이 또 커지는 **되먹임**이 된다.

    `MEETING_TITLE_HEIGHT` 는 판 위에 얹힌 회의 제목 줄 몫이다
    (`.board-center-frame { min-height: calc(100% - 64px) }` 과 짝).
  */
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 })


  /*
    `visibleEdgeIds` 는 **그린 것을 깎기만 한다.** 노드 자리·선 각도·무대 크기는
    거르지 않은 전체로 계산된다(`flowLayout` 참고). 재생이 0.5초마다 다시
    그리는데 그때 배치까지 다시 잡히면 판이 통째로 덜컹거려, 무엇이 늘어났는지
    를 볼 수가 없다.
  */
  const layout = useMemo(
    () => buildFlowLayout(flow.data?.nodes ?? [], flow.data?.arrows ?? [], {
      summaryRows,
      boardWidth: boardSize.width,
      boardHeight: boardSize.height - MEETING_TITLE_HEIGHT,
      visibleEdgeIds,
    }),
    [flow.data, summaryRows, boardSize.width, boardSize.height, visibleEdgeIds],
  )

  // 무대 크기를 배치에서 가져온다. 776×931 이 `BOARD_CONTENT_BOUNDS` · SVG
  // viewBox · CSS 세 곳에 각각 적혀 있어, 한 곳만 고치면 판이 어긋났다.
  const contentBounds = useMemo(
    () => ({ left: 0, top: 0, width: layout.stage.width, height: layout.stage.height }),
    [layout.stage.width, layout.stage.height],
  )

  const {
    boardRef,
    handleBoardPointerDown,
    handleBoardPointerMove,
    isPanning,
    maxZoom,
    minZoom,
    renderedZoom,
    stopBoardPan,
    zoom,
    zoomIn,
    zoomOut,
    zoomPercent,
  } = useFlowBoard(contentBounds)

  /*
    판을 **콜백 ref 로** 잡는다.

    `boardRef.current` 를 보는 effect 로는 안 된다. 이 화면은 회의를 읽는
    동안 다른 것을 그리다가(위쪽 `if (meeting.loading …) return`) 나중에야
    판을 붙이는데, ref 객체는 그때도 같은 객체라 **effect 가 다시 돌지
    않는다.** 처음 한 번 `null` 을 보고 끝나서 판 크기가 영영 0 이었다.
    콜백 ref 는 붙는 순간 불리므로 그 시점을 놓치지 않는다.
  */
  const [boardEl, setBoardEl] = useState(null)
  const attachBoard = (node) => {
    boardRef.current = node
    setBoardEl(node)
  }

  useEffect(() => {
    if (!boardEl) {
      return undefined
    }
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect
      setBoardSize((current) => (
        // 소수점만 흔들려도 배치를 다시 계산하면 렌더가 끝없이 돈다.
        Math.abs(current.width - box.width) < 1 && Math.abs(current.height - box.height) < 1
          ? current
          : { width: box.width, height: box.height }
      ))
    })
    observer.observe(boardEl)
    return () => observer.disconnect()
  }, [boardEl])

  const edgeIds = panel?.kind === 'edge' ? panel.edgeIds : []
  const edgeDetails = useEdgeDetails(edgeIds)

  /*
    판에서 나를 가리키는 노드.

    전에는 **내 대리인 노드**(`kind: 'AGENT'`)를 찾았다. 대리인을 주인에게
    접으면서 그 노드가 없어졌다 — 그대로 두면 `null` 이 되어 내 자리 표시가
    사라지고, **브리핑으로 들어가는 입구도 같이 없어진다.** 대리인이 내 노드
    안으로 들어왔으므로 이제 내 노드가 그 입구다.
  */
  const myNodeId = useMemo(() => {
    const myId = me.data?.id
    return myId
      ? (flow.data?.nodes ?? []).find((n) => n.kind === 'USER' && n.user_id === myId)?.id ?? null
      : null
  }, [flow.data, me.data])

  /*
    강조할 화살표.

    시간순 인덱스 한 줄을 고르면 그 줄의 `related_edge_ids`, 브리핑 태그를
    고르면 그 칩의 `edge_ids`. 둘을 교집합으로 묶지 않는 이유는, 겹치는 것이
    없을 때 판 전체가 흐려져 **필터가 고장 난 것처럼 보이기** 때문이다.

    재생 중에는 아무것도 강조하지 않는다. 안 그러면 강조가 걸린 채로 화살표가
    돋아나 **누적되는 것이 아니라 하나만 켜지는 것처럼** 보인다.
  */
  const highlightedEdgeIds = useMemo(() => {
    if (playback.isPlaying) {
      return null
    }
    if (ui.activeTimelineItem) {
      const item = ui.activeTimelineItem
      return new Set(item.related_edge_ids ?? [item.edge_id])
    }
    /*
      요약표에서 고른 칸도 인덱스와 같은 자격이다. 판이 안 따라 움직이면
      **패널만 바뀌고 왼쪽은 그대로**라, 방금 읽은 이야기가 판 어디에서
      오간 것인지 알 길이 없다.

      인덱스보다 뒤에 두는 이유는 인덱스가 사용자가 명시적으로 켜 둔 필터라
      서다 — 요약표를 누른다고 그 필터가 조용히 밀려나면 안 된다.
    */
    if (panel?.kind === 'agenda') {
      return new Set(panel.item.related_edge_ids ?? [])
    }
    if (activeChip) {
      const chip = (meeting.data?.briefing?.location_chips ?? [])
        .find((c) => c.content_type === activeChip)
      return chip ? new Set(chip.edge_ids ?? []) : null
    }
    return null
  }, [playback.isPlaying, ui.activeTimelineItem, activeChip, meeting.data, panel])

  const switchMode = (next) => {
    if (next === mode) {
      return
    }
    setMode(next)
    // 종류 목록이 모드마다 통째로 다르다(회의 6종 ↔ 작업 5종). 끈 것을 들고
    // 넘어가면 **다른 모드에는 있지도 않은 코드가 조건에 남아**, 목록에서는
    // 전부 켜져 보이는데 판은 걸러진 채로 그려진다.
    setExcludedContents([])
    setActiveSummaryItem(null)
    ui.setActiveTimelineItem(null)
    setPanel(null)
  }

  /*
    시간순 인덱스 한 줄을 눌렀다.

    **오른쪽 패널에 그 줄을 편다.** 왼쪽에서 제목만 보고 마는 목록이면 순번을
    매길 이유가 없다 — 순번은 "이걸 열어서 읽어라" 로 이어질 때 값이 생긴다.

    `arrow` 를 손으로 만들어 넘긴다. 화살표 패널은 `counts` 로 무엇을 읽을지
    정하는데, 여기서 열 것은 화살표 전체가 아니라 **그 한 건**이라 그렇게
    생긴 화살표가 판에 없다. `id` 에 `timeline::` 을 붙여 판의 화살표 id 와
    절대 겹치지 않게 한다 — 겹치면 엉뚱한 선이 골라진 것으로 그려진다.
  */
  /*
    시간순 인덱스 한 줄을 화살표 패널 모양으로 바꾼다.

    `selectTimelineItem`(사람이 눌렀을 때)과 재생 중 자동으로 여는 자리가
    같은 모양을 만들어야 한다. 따로 두면 둘 중 하나만 고쳐질 때 "손으로
    누르면 이렇게 뜨는데 재생 중엔 다르게 뜬다" 는 어긋남이 생긴다.
  */
  /*
    한 줄이 이제 주제 하나(같은 제목으로 묶인 화살표 여럿)일 수 있다.
    `memberItems` 가 있으면 그 전부에서 종류별 개수를 센다 — 없으면(예:
    브리핑 카드에서 엣지 하나로 곧장 열 때) 그 항목 하나만 있는 것으로 본다.
    `FlowEdgePanel` 은 `arrow.counts` 종류마다 알약을 그리고 `edgeIds` 전체의
    상세를 읽어 오므로, 여기서 여러 화살표를 한 데 모아 넘기면 패널은 그
    주제에 걸린 모든 이야기를 한 번에 보여준다 — 따로 고칠 곳이 없다.
  */
  const edgePanelFor = (item) => {
    const members = item.memberItems ?? [item]
    const countsByType = new Map()
    members.forEach((member) => {
      const existing = countsByType.get(member.content_type)
      if (existing) {
        existing.count += 1
        existing.edge_ids.push(member.edge_id)
      } else {
        countsByType.set(member.content_type, {
          content_type: member.content_type,
          label: member.label,
          count: 1,
          edge_ids: [member.edge_id],
        })
      }
    })

    return {
      kind: 'edge',
      badgeId: null,
      count: null,
      arrow: {
        id: `timeline::${item.edge_id}`,
        direction_label: item.direction_label,
        counts: [...countsByType.values()],
      },
      direction: item.direction_label,
      edgeIds: members.map((member) => member.edge_id),
    }
  }

  const selectTimelineItem = (item) => {
    const same = ui.activeTimelineItem?.edge_id === item.edge_id
    ui.toggleTimelineItem(item)

    if (same) {
      setPanel(null)
      return
    }
    setPanel(edgePanelFor(item))
  }


  /*
    브리핑 카드(확인·근거)에서 가리키는 엣지 하나를 연다.

    카드가 들고 있는 것은 `edge_id` 뿐이라, 패널을 그리는 데 필요한
    `content_type`·`label`·`direction_label` 은 시간순 인덱스에서 찾아야
    한다. `selectTimelineItem` 과 같은 모양의 패널을 만드는 이유도 그래서다 —
    다른 모양이면 화살표 패널이 그 엣지를 못 읽는다.
  */
  const openEdgeById = (edgeId) => {
    const item = timelineItems.find((row) => row.edge_id === edgeId)
    if (item) {
      selectTimelineItem(item)
    }
  }

  /*
    다른 화면(예: 요청함의 승인 팝업)에서 `?edge=` 를 달고 들어왔다.

    `?source=bordo-briefing` 처럼 마운트 시점에 한 번만 읽으면 되는 값이
    아니다 — 그건 즉시 열 수 있는 고정 패널이지만, 화살표 패널은 시간순
    인덱스가 도착해야 어떤 종류인지 알 수 있다. 그래서 목록이 채워지길
    기다렸다가 한 번만 연다 — 매번 열면 사용자가 스스로 닫은 패널이 다시 튀어
    나온다.
  */
  const openedFromUrlRef = useRef(false)
  useEffect(() => {
    const targetEdgeId = entryParams.get('edge')
    if (!targetEdgeId || openedFromUrlRef.current || timelineItems.length === 0) {
      return undefined
    }
    const item = timelineItems.find((row) => row.edge_id === targetEdgeId)
    if (!item) {
      return undefined
    }
    // `setTimeout` 로 한 틱 미룬다. effect 본문에서 곧장 `setState` 를 부르면
    // 같은 커밋 안에서 렌더가 한 번 더 걸린다(`react-hooks/set-state-in-effect`,
    // `useFlowPlayback.js` 에 같은 사정이 적혀 있다).
    const timer = setTimeout(() => {
      openedFromUrlRef.current = true
      selectTimelineItem(item)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineItems])

  /*
    재생을 시작할 때 켜져 있던 것을 끈다.

    고른 줄·요약표 칸·열린 패널을 그대로 두면, 판이 비워지는 순간 오른쪽에는
    아직 안 나타난 내용이 펼쳐져 있고 왼쪽에는 그 줄만 진하게 켜져 있다.
    재생은 처음부터 다시 훑겠다는 뜻이므로 읽던 자리도 같이 접는다.
  */
  const startPlayback = () => {
    ui.setActiveTimelineItem(null)
    setActiveSummaryItem(null)
    setPanel(null)
    playback.start()
  }

  const selectNode = (node) => {
    // 내 노드를 누르면 브리핑(내 대리인이 한 일), 남을 누르면 그 사람 패널.
    setPanel(node.id === myNodeId
      ? { kind: 'briefing', nodeId: node.id }
      : { kind: 'node', nodeId: node.id, node })
  }

  /*
    화살표 뱃지 하나를 눌렀다.

    누른 뱃지에 걸린 엣지만 읽지 않는다. 패널 머리에 `의견 3 · 요청사항 5 ·
    변동사항 2` 가 나란히 서는 자리라(시안 `601:10010`), **그 화살표에 걸린
    것 전부**를 읽어야 그 줄을 그릴 수 있다. 누른 뱃지는 어느 묶음을 가리켜
    열었는지로만 쓴다.
  */
  const selectBadge = (badgeId, count, arrow) => {
    setPanel({
      kind: 'edge',
      badgeId,
      count,
      arrow,
      direction: arrow.direction_label,
      edgeIds: (arrow.counts ?? []).flatMap((entry) => entry.edge_ids ?? []),
    })
  }

  /*
    화살표(선)를 직접 눌렀다.

    뱃지만 눌리던 자리였다. 그런데 뱃지는 종류마다 하나씩이라 **화살표 전체가
    무엇을 날랐는지 보려면 아무 종류나 하나 눌러야** 했고, 종류가 하나뿐인
    화살표에서는 그 하나가 곧 전체인지 알 수 없었다. 시안(`601:9343`)은 선을
    눌러 그 화살표의 패널을 연다.

    `count` 를 안 넘긴다 — 가리켜 열 묶음이 없으므로 알약이 아무것도 안 켜진
    채로 뜬다. 뱃지로 열었을 때만 그 종류가 켜져 있는 것이 맞다.
  */
  const selectLink = (link) => {
    setPanel({
      kind: 'edge',
      badgeId: null,
      count: null,
      arrow: link.arrow,
      direction: link.arrow.direction_label,
      edgeIds: (link.arrow.counts ?? []).flatMap((entry) => entry.edge_ids ?? []),
    })
  }

  if (meeting.loading && !meeting.data) {
    return <div className="flow-board-page"><Loading label="회의를 불러오는 중입니다…" /></div>
  }

  if (meeting.error && !meeting.data) {
    return (
      <div className="flow-board-page">
        <LoadError error={meeting.error} onRetry={meeting.reload} />
      </div>
    )
  }

  // 회의가 하나도 없으면 **판이 아니라 안내를 그린다.**
  //
  // 여기서 막지 않으면 읽기는 성공했으므로 위 두 갈래를 지나쳐 보드가 그대로
  // 그려진다. 제목은 빈 문자열, 요약표는 빈 칸, 화살표 개수는 0 — 사용자에게는
  // **고장 난 화면으로 보인다.** "아직 회의가 없다" 와 "못 불러왔다" 는 다르다.
  //
  // 프로젝트 이름을 앞에 붙인다. 이 자리에는 헤더가 없어서, 사이드바에서 누른
  // 것이 열렸는지 확인할 단서가 이 한 줄뿐이다. 이름 없이 `회의가 없습니다`
  // 만 뜨면 **엉뚱한 프로젝트가 열린 것과 구별되지 않는다** — 방금 고친 결함이
  // 그 모습이었다.
  if (!meetingId) {
    return (
      <div className="flow-board-page">
        <FlowRail />
        <Empty>
          {projectName ? `${projectName}에는 ` : ''}
          아직 열린 회의가 없습니다. 회의가 끝나면 여기에 흐름이 그려집니다.
        </Empty>
      </div>
    )
  }

  const selectedNode = panel?.kind === 'node' ? panel.node : null
  const selectedNodeId = panel?.nodeId ?? null
  const briefing = meeting.data?.briefing ?? null
  const participantOf = (node) => (meeting.data?.detail?.participants ?? [])
    .find((p) => p.user_id === node.user_id)

  // 서버가 `8/17 글로벌 회의 일정 및 개발 방향 논의` · `8.10 - 8.16 작업 흐름`
  // 처럼 완성해 준다. 날짜를 클라이언트가 찍으면 브라우저 시간대로 나가 같은
  // 회의를 사람마다 다른 날짜로 본다.
  const headerLabel = flow.data?.meeting_label
    ?? flow.data?.period_label
    ?? meeting.data?.detail?.title
    ?? ''

  return (
    <div className="flow-board-page">
      <FlowRail collapsed={ui.isFlowSidebarCollapsed} />

      <FlowNavigationSidebar
        activeCategory={mode}
        activeEdgeId={ui.activeTimelineItem?.edge_id ?? null}
        contentFilters={contentRows}
        icons={icons}
        isCollapsed={ui.isFlowSidebarCollapsed}
        isContentCollapsed={ui.isContentCollapsed}
        isScrolled={ui.isSidebarScrolled}
        isTimelineCollapsed={ui.isTimelineCollapsed}
        onCategorySelect={switchMode}
        onContentCollapseToggle={ui.toggleContentCollapse}
        onContentToggle={toggleContent}
        onScroll={(event) => ui.setIsSidebarScrolled(event.currentTarget.scrollTop > 0)}
        onSidebarToggle={ui.toggleFlowSidebar}
        onTeamSwitch={() => setSwitchingTeam(true)}
        onTimelineCollapseToggle={ui.toggleTimelineCollapse}
        onTimelineSelect={selectTimelineItem}
        /*
          `start` 만 갈아 끼운다. 재생을 시작할 때 읽던 자리를 접는 것은 판을
          아는 이 화면의 몫이라 훅에 넣을 수 없고, 사이드바는 `playback.start`
          하나만 부르므로 여기서 바꿔 주는 것이 가장 짧다.
        */
        playback={{ ...playback, start: startPlayback }}
        teamName={meeting.data?.detail?.project_name}
        timeline={groupedTimeline}
        /* 껐기 때문에 빈 것과 원래 없는 것은 다르다. 앞엣것을 `오간 내용이
           없습니다` 로 말하면 사용자는 자기가 끈 것을 잊고 고장으로 읽는다. */
        timelineEmptyText={nothingPicked
          ? '내용 종류가 전부 꺼져 있습니다.'
          : (mode === WORK_MODE ? '이 기간에 오간 작업이 없습니다.' : '이 회의에서 오간 내용이 없습니다.')}
      />

      <main className={(panel || playback.isPlaying || playback.isFinished) ? 'flow-workspace has-record-panel' : 'flow-workspace'}>
        <section
          className={isPanning ? 'flow-board is-panning' : 'flow-board'}
          aria-label="회의 플로우보드"
          ref={attachBoard}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={stopBoardPan}
          onPointerCancel={stopBoardPan}
        >
          <header className="meeting-title" ref={meetingMenuRef}>
            {/*
              사이드바를 접으면 여는 단추가 여기로 온다.

              예전에는 접힌 사이드바의 머리(`team-header`)가 화면 왼쪽 위에
              **떠 있는 흰 카드**로 남아 그 안의 `«` 로만 다시 펼 수 있었다.
              접었는데 왼쪽에 카드가 하나 떠 있으면 접은 것으로 보이지 않고,
              카드가 판 위를 덮기도 했다. 접힌 뒤 왼쪽 끝에 남는 것은 회의
              제목 줄 하나이므로, 여는 단추도 그 줄 맨 앞에 둔다.
            */}
            {ui.isFlowSidebarCollapsed ? (
              <button
                className="meeting-title-menu"
                type="button"
                aria-label="사이드바 펼치기"
                data-tip="사이드바 펼치기"
                aria-expanded="false"
                onClick={ui.toggleFlowSidebar}
              >
                <img src={icons.menu} alt="" />
              </button>
            ) : null}
            <h1>{headerLabel}</h1>
            <button
              type="button"
              aria-label="회의 선택"
              data-tip="다른 회의 보기"
              aria-expanded={ui.isMeetingMenuOpen}
              onClick={ui.toggleMeetingMenu}
            >
              <img className={ui.isMeetingMenuOpen ? 'is-open' : ''} src={icons.expandDown} alt="" />
            </button>

            {/* 아이콘만 180도 돌고 아무것도 안 뜨던 자리다. 회의를 바꿀 방법이
                주소를 손으로 고치는 것뿐이었다. */}
            {ui.isMeetingMenuOpen ? (
              <div className="meeting-menu" role="listbox" aria-label="회의 목록">
                {meetingList.loading && !meetingList.data ? <Loading label="회의 목록을 읽는 중입니다…" /> : null}
                {meetingList.error ? <LoadError error={meetingList.error} onRetry={meetingList.reload} /> : null}
                {meetingList.data?.results?.length === 0 ? <Empty>이 프로젝트에 회의가 없습니다.</Empty> : null}
                {(meetingList.data?.results ?? []).map((item) => (
                  <button
                    className={item.id === meetingId ? 'is-active' : ''}
                    type="button"
                    key={item.id}
                    role="option"
                    aria-selected={item.id === meetingId}
                    onClick={() => {
                      setPickedMeetingId(item.id)
                      rememberMeetingInUrl(item.id)
                      setPanel(null)
                      /*
                        `useFlowBoardUi` 리팩터로 `activeIndex` 가
                        `activeTimelineItem` 이 됐는데(그쪽 주석 참고) 여기만
                        옛 이름(`setActiveIndex`, 존재하지 않는 함수)을 그대로
                        불러 **클릭마다 여기서 예외가 났다.** 그 아래
                        `setIsMeetingMenuOpen(false)` 까지 못 가서, 회의를
                        골라도 목록이 안 닫혔다.
                      */
                      ui.setActiveTimelineItem(null)
                      ui.setIsMeetingMenuOpen(false)
                    }}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            ) : null}
          </header>

          <div className="board-center-frame">
            <div
              className="board-zoom-surface"
              style={{
                width: layout.stage.width * renderedZoom,
                height: layout.stage.height * renderedZoom,
              }}
            >
              <FlowCanvas
                activeBadgeId={panel?.badgeId ?? null}
                highlightedEdgeIds={highlightedEdgeIds}
                layout={layout}
                myNodeId={myNodeId}
                onBadgeSelect={selectBadge}
                onLinkSelect={selectLink}
                onNodeSelect={selectNode}
                selectedArrowId={panel?.kind === 'edge' ? panel.arrow?.id : null}
                selectedNodeId={selectedNodeId}
                style={{ transform: `scale(${renderedZoom})` }}
              >
                <article
                  className="summary-board"
                  style={{
                    left: layout.summary.left,
                    top: layout.summary.top,
                    width: layout.summary.width,
                    minHeight: layout.summary.height,
                  }}
                >
                  {/* 작업 모드에는 요약표가 없다. `주요 작업 / 주요 변경 /
                      공유·연결` 은 계획에만 있고 엔드포인트가 없어서, 회의
                      요약을 그대로 띄우면 **작업 화면에서 회의 이야기를 읽게 된다.** */}
                  {mode === WORK_MODE ? (
                    <Empty>작업 모드 요약표는 아직 서버에 없습니다.</Empty>
                  ) : summaryColumns.length === 0 ? (
                    <Empty>아직 정리된 회의 요약이 없습니다.</Empty>
                  ) : summaryColumns.map((column) => (
                    <section className="summary-column" key={column.title}>
                      <h2>{column.title}</h2>
                      <div>
                        {column.items.length === 0 ? (
                          <p className="summary-column-empty">없음</p>
                        ) : column.items.map((item, i) => {
                          // 같은 문구가 두 번 나올 수 있다. 문구를 key 로 쓰면
                          // 하나가 사라지고, 누를 때도 둘이 같이 눌린다.
                          const itemKey = `${column.title}-${i}`

                          /*
                            말풍선은 붙이지 않는다. 안내 말풍선은 그림만 있는
                            단추의 뜻을 알려 주는 자리인데, 여기는 글이 이미
                            적혀 있어서 같은 글이 아래에 한 번 더 뜬다.

                            상세가 없는 칸도 **같은 안건 패널**을 연다 — 전에는
                            그런 칸을 누르면 안건 패널 대신 브리핑 전체가
                            불쑥 떴다. 방금 누른 그 줄과는 상관없는 다른
                            패널로 화면이 통째로 바뀌는 쪽이, 맥락 없는 패널이
                            뜨는 것보다 더 헷갈렸다. `FlowAgendaPanel` 은
                            맥락·갈린 지점·결론이 없으면 그 줄만 조용히
                            건너뛰므로(그쪽 파일 참고), 상세가 없어도 빈
                            패널로 보이지 않는다.
                          */
                          return (
                            <button
                              className={activeSummaryItem === itemKey ? 'is-active' : ''}
                              type="button"
                              key={itemKey}
                              data-tip={item}
                              onClick={() => {
                                const same = activeSummaryItem === itemKey
                                setActiveSummaryItem(same ? null : itemKey)
                                if (same) {
                                  setPanel({ kind: 'briefing' })
                                  return
                                }
                                setPanel({
                                  kind: 'agenda',
                                  column: column.title,
                                  item: item.detail ?? { text: item.text },
                                })
                              }}
                            >
                              {item.text}
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </article>
              </FlowCanvas>

              {/*
                조회 상태를 판 위에 겹쳐 보여 준다. 캔버스를 지우고 스피너만
                띄우면 필터를 한 칸 누를 때마다 판이 사라졌다 나타나 깜빡인다.
              */}
              {flow.loading && !flow.data ? (
                <div className="board-status"><Loading label="흐름을 그리는 중입니다…" /></div>
              ) : null}
              {flow.error && !flow.data ? (
                <div className="board-status"><LoadError error={flow.error} onRetry={flow.reload} /></div>
              ) : null}
              {/* 종류를 전부 끄면 그릴 것이 없다. 판이 빈 것과 조회가 실패한 것을
                  구별해 주지 않으면 사용자는 자기가 끈 것을 잊고 고장으로 읽는다. */}
              {nothingPicked ? (
                <div className="board-status"><Empty>내용 종류가 전부 꺼져 있습니다. 하나 이상 켜 주세요.</Empty></div>
              ) : null}
              {!flow.loading && !flow.error && !nothingPicked && layout.nodes.length === 0 ? (
                <div className="board-status">
                  <Empty>{mode === WORK_MODE ? '이 기간에 오간 작업이 없습니다.' : '이 회의에서 오간 내용이 없습니다.'}</Empty>
                </div>
              ) : null}
            </div>
          </div>

          {/*
            확대한 동안에만 그린다(110% · 120%).

            판이 이 화면의 전부라, 100% 로 보고 있을 때 그 위에 겹쳐 뜬 상자는
            아무 일도 하지 않으면서 판만 가린다. 배율을 되돌릴 곳은 배율을
            바꾼 뒤에 필요하다.

            **대신 100% 에서 확대로 들어가는 길은 `Ctrl`(`Cmd`) + 휠 하나뿐이다.**
            이건 알고 있는 사람만 쓰는 길이라, 확대를 처음 하려는 사람은 방법을
            찾지 못한다. 예전에 같은 이유로 이 상자를 늘 그리도록 되돌린 적이
            있다 — 그때와 달리 이번에는 판을 가리지 않는 쪽을 골랐다.

            되돌릴 거리는 이 조건 하나다. `zoom > minZoom` 을 지우면 된다.
          */}
          {zoom > minZoom ? (
            <div className="zoom-controls" aria-label="플로우보드 확대 축소">
              <button type="button" aria-label="축소" data-tip="축소" onClick={zoomOut} disabled={zoom <= minZoom}>
                -
              </button>
              <output aria-live="polite">{zoomPercent}%</output>
              <button type="button" aria-label="확대" data-tip="확대" onClick={zoomIn} disabled={zoom >= maxZoom}>
                +
              </button>
            </div>
          ) : null}
        </section>

        {playback.isPlaying || playback.isFinished ? (
          /*
            재생이 끝나도 닫지 않는다.

            전에는 `isPlaying` 이 꺼지는 순간(끝까지 다 본 순간) 이 패널도
            같이 사라졌다 — 방금 다 본 회의록을 다시 훑어볼 새도 없이
            치워지는 것이라, 사람이 직접 닫기 전까지는(`onClose` 가 부르는
            `stopPlayback`) 열어 둔다. `isFinished` 는 `useFlowPlayback.js`
            참고 — "끝까지 봤다" 를 `isPlaying` 과 별도로 들고 있는 값이다.
          */
          <FlowPlaybackLog
            onClose={stopPlayback}
            step={playback.step}
            timeline={groupedTimeline}
          />
        ) : null}

        {/*
          아래 네 패널은 재생 중이거나 방금 끝났을 때는 안 연다 — 그 자리는
          위 「전체 회의록」이 쓰고 있다. 캔버스에서 노드·화살표를 눌러도
          `setPanel` 자체는 그대로 불리므로(누르는 동작을 막지는 않는다),
          여기서 안 걸러 두면 재생이 끝난 뒤 무언가를 누르는 순간 두 패널이
          동시에 뜬다.
        */}
        {!playback.isPlaying && !playback.isFinished && panel?.kind === 'briefing' ? (
          briefing ? (
            <FlowBriefingSidebar
              activeChip={activeChip}
              briefing={briefing}
              icons={icons}
              isScrolled={ui.isBriefScrolled}
              onChipToggle={(contentType) => setActiveChip((c) => (c === contentType ? null : contentType))}
              onClose={() => setPanel(null)}
              onOpenEdge={openEdgeById}
              onScroll={(event) => ui.setIsBriefScrolled(event.currentTarget.scrollTop > 0)}
            />
          ) : (
            <aside className="briefing-panel inspector-panel" aria-label="Bordo 브리핑">
              <header className="briefing-header">
                <h2>Bordo 브리핑</h2>
                <button className="panel-close" type="button" aria-label="패널 닫기" data-tip="닫기" onClick={() => setPanel(null)}>
                  ×
                </button>
              </header>
              {/* 브리핑은 불참자에게만 만들어진다. 참석한 사람에게는 404 다 —
                  오류가 아니라 "브리핑받을 것이 없다" 이므로 그렇게 말한다. */}
              <Empty>이 회의에는 받을 브리핑이 없습니다.</Empty>
            </aside>
          )
        ) : null}

        {!playback.isPlaying && !playback.isFinished && panel?.kind === 'agenda' ? (
          <FlowAgendaPanel
            column={panel.column}
            icons={icons}
            item={panel.item}
            onBack={() => {
              setPanel({ kind: 'briefing' })
              // 켜진 칸도 같이 끈다. 남겨 두면 브리핑이 떠 있는데 요약표
              // 한 칸만 진하게 켜져 있어, 그 칸을 보여 주는 중인 줄 안다.
              setActiveSummaryItem(null)
            }}
            onClose={() => {
              setPanel(null)
              // 패널을 닫으면 요약표의 켜진 칸도 같이 끈다. 남겨 두면 판에는
              // 아무것도 안 열렸는데 요약표 한 칸만 진하게 켜져 있다.
              setActiveSummaryItem(null)
            }}
          />
        ) : null}

        {!playback.isPlaying && !playback.isFinished && panel?.kind === 'node' && selectedNode ? (
          <FlowNodePanel
            meetingId={meetingId}
            node={selectedNode}
            participant={participantOf(selectedNode)}
            seqOf={seqOf}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {!playback.isPlaying && !playback.isFinished && panel?.kind === 'edge' ? (
          <FlowEdgePanel
            /*
              화살표가 바뀌면 **패널을 새로 만든다.**

              같은 컴포넌트를 그대로 두고 값만 갈아 끼우면 안에 들고 있던
              검색어와 고른 알약이 그대로 남는다. 실제로 한 화살표에서 `토큰`
              을 검색해 두고 다른 화살표를 누르면, 그쪽에는 그 낱말이 없어
              **비어 있는 패널**이 떴다. 뱃지로 열어도 그 종류가 안 켜졌다 —
              첫 상태는 처음 만들어질 때 한 번만 읽히기 때문이다.

              `key` 를 바꿔 다시 만들게 하는 것이 리액트가 상태를 되돌리는
              방법이다. effect 에서 되돌리면 렌더가 한 번 더 돌고, 그 사이
              한 프레임 동안 남의 검색 결과가 비친다.
            */
            key={`${panel.arrow?.id}::${panel.badgeId ?? ''}`}
            arrow={panel.arrow}
            count={panel.count}
            direction={panel.direction}
            edges={edgeDetails}
            seqOf={seqOf}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </main>

      {switchingTeam ? <TeamSwitchDialog onClose={() => setSwitchingTeam(false)} /> : null}
    </div>
  )
}
