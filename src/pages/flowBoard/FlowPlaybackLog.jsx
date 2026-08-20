import { useEffect, useRef } from 'react'

import { useEdgeDetails } from './useFlowBoardData'

/**
 * 맥락 재생 중에 뜨는 「전체 회의록」.
 *
 * 예전에는 재생을 시작하면 오른쪽 패널이 그대로 닫혀 있었다(`startPlayback`
 * 이 시작할 때 패널을 접는다). 나중에 한 걸음마다 방금 드러난 화살표
 * 하나로 패널을 갈아 끼우게 고쳤는데, 그러면 스무 걸음짜리 회의를 재생할 때
 * 열아홉 번째 줄을 보다가 눈을 떼면 그 자리를 다시 찾을 수 없었다 —
 * 재생은 "다시 훑어 보는" 동작이라 방금 지나간 줄이 계속 남아 있어야 한다.
 *
 * 그래서 여기서는 갈아 끼우지 않고 **드러난 것을 전부 위에서부터 아래로
 * 쌓는다.** 왼쪽 시간순 인덱스와 같은 순서(오래된 것이 위)라 두 목록이
 * 같은 이야기를 하고, 새 줄이 생길 때마다 스크롤을 맨 아래로 붙여서 지금 막
 * 드러난 줄이 항상 화면에 들어오게 한다.
 */
export function FlowPlaybackLog({ onClose, step, timeline }) {
  const revealed = timeline.slice(0, step)
  // 한 줄이 이제 같은 제목으로 묶인 화살표 여럿일 수 있다(`FlowBoardPage.jsx`
  // 의 `groupedTimeline`). 그 전부의 상세를 한 번에 읽어 온다.
  const edgeIds = revealed.flatMap((item) => item.related_edge_ids ?? [item.edge_id])
  const edges = useEdgeDetails(edgeIds)

  const detailByEdgeId = new Map((edges.data ?? []).map((row) => [row.edge.id, row]))

  /*
    `step` 만 봐서는 늦게 붙는다.

    새 걸음이 오면 그 줄의 카드부터 먼저 뜬다 — 인용문이 아직 없어
    `item.title` 로 짧게 그려진다. `useEdgeDetails` 가 실제 인용문을 받아오면
    카드가 늘어나는데, 그 갱신은 `step` 이 아니라 `edges.data` 가 바뀌며
    일어난다. `step` 만 의존성에 두면 짧을 때 한 번 내렸다가 길어질 때는
    안 따라가, 스크롤이 매 걸음 한 카드씩 뒤처진다 — 실제로 그렇게 났다.
  */
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [step, edges.data])

  return (
    <aside className="briefing-panel inspector-panel playback-log" aria-label="전체 회의록">
      <header className="briefing-header">
        <h2>전체 회의록</h2>
        <button className="panel-close" type="button" aria-label="패널 닫기" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="briefing-scroll playback-log-scroll" ref={scrollRef}>
        {revealed.map((item) => {
          const memberIds = item.related_edge_ids ?? [item.edge_id]
          const detail = detailByEdgeId.get(memberIds[0])
          // 「무엇에 대한 이야기였나」는 안건이 그 자리다. 안건이 없는
          // 엣지는 붙은 문서가, 그마저 없으면 종류 라벨이 대신한다
          // (`FlowInspectorPanel` 의 카드 제목과 같은 우선순위).
          const topic = detail?.agenda?.title ?? detail?.document?.title ?? item.label

          return (
            <article className="playback-log-item" key={item.edge_id}>
              <div className="playback-log-head">
                <strong>{item.direction_label}</strong>
                <span>{topic}</span>
              </div>
              {/*
                같은 주제로 묶인 화살표가 여럿이면 인용문도 그만큼 쌓인다 —
                한 주제가 오간 순서를 그대로 보여준다. 대화 없이 대리인이
                혼자 남긴 메모처럼 인용문이 비는 엣지는 시간순 인덱스의
                제목으로 대신한다.
              */}
              {memberIds.map((edgeId) => {
                const quote = detailByEdgeId.get(edgeId)?.delivery_context?.[0]?.utterance || item.title
                return <p key={edgeId}>{quote}</p>
              })}
            </article>
          )
        })}
      </div>
    </aside>
  )
}
