import { useEffect, useRef, useState } from 'react'

import { fetchEdge } from './flowBoard.data'

/*
  스크롤을 걸음마다 맨 아래로 붙이되, 브라우저 기본 `scrollTo(smooth)` 대신
  직접 애니메이션한다 — 기본값은 걸음마다 새로 걸릴 때 브라우저·배율에 따라
  거의 안 보이거나 뚝 끊겨 보였다("스크롤을 좀 더 부드럽게" 요청). 매번 지금
  위치에서부터 다시 계산해서, 스크롤이 끝나기 전에 다음 줄이 붙어도 방향이
  갑자기 안 꺾인다.
*/
function smoothScrollTo(el, target, duration = 420) {
  const start = el.scrollTop
  const change = target - start
  if (Math.abs(change) < 1) {
    return () => {}
  }

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) {
    el.scrollTop = target
    return () => {}
  }

  const startTime = performance.now()
  let frameId = null

  const step = (now) => {
    const t = Math.min(1, (now - startTime) / duration)
    // ease-out cubic. 도착할수록 느려져야 "쓰윽" 미끄러지듯 멎는다 —
    // 등속이면 끝에서 뚝 멈춘 것처럼 보인다.
    const eased = 1 - (1 - t) ** 3
    el.scrollTop = start + change * eased
    if (t < 1) {
      frameId = requestAnimationFrame(step)
    }
  }
  frameId = requestAnimationFrame(step)

  return () => {
    if (frameId != null) {
      cancelAnimationFrame(frameId)
    }
  }
}

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
  // 의 `groupedTimeline`). 그 전부의 상세를 읽어 온다.
  const edgeIds = revealed.flatMap((item) => item.related_edge_ids ?? [item.edge_id])
  const idsKey = edgeIds.join(',')

  /*
    이미 받아 온 것은 다시 안 부른다.

    예전에는 `useEdgeDetails(edgeIds)` 로 한 번에 읽었는데, 그 훅은 `edgeIds`
    가 바뀔 때마다 **키(join 한 문자열)가 다르므로 통째로 새로 부른다.**
    걸음마다 `edgeIds` 는 늘어나기만 하는 배열이라, 스무 걸음짜리 회의를
    끝까지 재생하면 첫 화살표가 스무 번 다시 불려 나갔다 — 눈에 보이는 문제는
    없었지만(옛 데이터가 화면에 남아 있어 깜빡이진 않았다) 매 걸음 이미 받은
    것까지 통째로 다시 요청하는 것 자체가 낭비였다.

    여기서는 **요청한 적 있는 id** 를 따로 기억해 두고(`requestedRef`), 새
    걸음이 늘려 놓은 `edgeIds` 에서 그중 없는 것만 걸러 부른다. 받은 결과는
    누적 맵(`detailByEdgeId`)에 얹기만 하고 지우지 않는다.
  */
  const requestedRef = useRef(new Set())
  const [detailByEdgeId, setDetailByEdgeId] = useState(() => new Map())

  useEffect(() => {
    // 정리 함수가 돌 때 `requestedRef.current` 가 다른 것을 가리키고 있을 수
    // 있어 여기서 한 번 붙잡아 둔다(eslint `exhaustive-deps` 가 잡아 준다).
    const requested = requestedRef.current
    const missing = edgeIds.filter((id) => !requested.has(id))
    if (missing.length === 0) {
      return undefined
    }
    missing.forEach((id) => requested.add(id))

    const controller = new AbortController()
    let alive = true
    /*
      **받아 온 것만 「요청함」 으로 남긴다.**

      `idsKey` 는 걸음마다 바뀌므로 다음 걸음이 오면 이 효과가 정리되며
      아직 오지 않은 요청을 끊는다. 그런데 id 는 요청을 보내기 전에 이미
      `requestedRef` 에 넣어 두므로, 끊긴 것들은 **다시는 안 불린다** —
      화면은 인용문 대신 `item.title` 로 조용히 대신 그린다. 오류도 빈
      칸도 없어서, 보는 사람은 그 화살표에 원래 인용문이 없는 줄 안다.

      한 걸음이 1.1초라 로컬에서는 거의 안 나지만, 느린 연결에서는 걸음마다
      한 줄씩 진짜 내용을 잃는다. 그래서 못 받은 것은 표시를 도로 지워
      다음 걸음이 다시 부르게 한다.
    */
    const settled = new Set()

    Promise.all(missing.map((id) => fetchEdge(id, controller.signal)
      .then((row) => { settled.add(id); return row })
      .catch(() => null)))
      .then((rows) => {
        if (!alive) {
          return
        }
        setDetailByEdgeId((current) => {
          const next = new Map(current)
          rows.forEach((row, index) => {
            if (row) {
              next.set(missing[index], row)
            }
          })
          return next
        })
      })

    return () => {
      alive = false
      controller.abort()
      missing.forEach((id) => {
        if (!settled.has(id)) {
          requested.delete(id)
        }
      })
    }
    // `idsKey` 하나로 충분하다 — `missing` 은 그 안에서 다시 계산한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  /*
    `step` 만 봐서는 늦게 붙는다.

    새 걸음이 오면 그 줄의 카드부터 먼저 뜬다 — 인용문이 아직 없어
    `item.title` 로 짧게 그려진다. 위 요청이 실제 인용문을 받아오면 카드가
    늘어나는데, 그 갱신은 `step` 이 아니라 `detailByEdgeId` 가 바뀌며
    일어난다. `step` 만 의존성에 두면 짧을 때 한 번 내렸다가 길어질 때는
    안 따라가, 스크롤이 매 걸음 한 카드씩 뒤처진다 — 실제로 그렇게 났다.
  */
  const scrollRef = useRef(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) {
      return undefined
    }
    return smoothScrollTo(el, el.scrollHeight)
  }, [step, detailByEdgeId])

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
              {/*
                한 줄씩 시차를 두고 나타난다(`--playback-log-line-delay`,
                `flowBoard.css`). 묶인 인용문이 한꺼번에 뜨면 방금 카드가
                통째로 나타난 것과 구분이 안 가 몇 줄이 새로 왔는지 못
                따라간다 — 순서대로 하나씩 짚어 줘야 "쌓인다" 는 게 실제로
                읽힌다.
              */}
              {memberIds.map((edgeId, index) => {
                const quote = detailByEdgeId.get(edgeId)?.delivery_context?.[0]?.utterance || item.title
                return (
                  <p key={edgeId} style={{ '--playback-log-line-delay': `${index * 110}ms` }}>
                    {quote}
                  </p>
                )
              })}
            </article>
          )
        })}
      </div>
    </aside>
  )
}
