import { AgentDock } from '../home/AgentDock.jsx'

/**
 * 요약표 한 칸을 눌렀을 때 열리는 안건 상세.
 *
 * ## 왜 브리핑을 밀어내고 통째로 바꾸나
 *
 * 요약표의 한 줄은 **결론만 적힌 문장**이다(`디자인 시안 마감을 8/18 로
 * 앞당김`). 회의에 없던 사람이 이 서비스에 오는 이유는 그 줄이 아니라
 * "어쩌다 그렇게 됐는데?" 라서, 누른 뒤에 보여 줄 것은 브리핑 전체가 아니라
 * **그 한 줄의 뒷이야기**다. 브리핑 위에 얹으면 패널이 두 배로 길어져 정작
 * 방금 누른 것을 보려고 또 스크롤해야 한다.
 *
 * 대신 맨 위에 `브리핑으로` 를 둔다. 통째로 바꾸면서 돌아갈 길을 안 주면
 * 사용자는 패널을 닫았다가 다시 열어야 하는데, 닫으면 판까지 넓어졌다
 * 좁아져서 화면이 한 번 출렁인다.
 *
 * ## 상세가 없는 칸은 여기 안 온다
 *
 * 서버는 당분간 요약표를 문자열로만 내려 준다. 그런 칸까지 이 패널을 열면
 * 맥락도 갈린 지점도 빈 화면이 떠서 **그 안건에 논의가 없었던 것으로 읽힌다.**
 * 그래서 고르는 쪽(`FlowBoardPage`)이 상세 있는 칸만 이리로 보낸다.
 */
export function FlowAgendaPanel({ column, icons, item, onBack, onClose }) {
  const debates = item.debates ?? []
  const edgeCount = (item.related_edge_ids ?? []).length

  return (
    <aside className="briefing-panel agenda-panel" aria-label="안건 상세">
      <header className="briefing-header agenda-header">
        {/* 왼쪽 화살표 파일이 이 화면 아이콘 묶음에 없다. 오른쪽 것을 돌려
            쓴다 — 같은 굵기·같은 크기라 새 파일을 넣는 것보다 어긋날 일이 적다. */}
        <button className="agenda-back" type="button" onClick={onBack}>
          <img src={icons.expandRight} alt="" aria-hidden="true" />
          브리핑으로
        </button>
        <button className="panel-close" type="button" aria-label="패널 닫기" data-tip="닫기" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="briefing-scroll agenda-scroll">
        <section className="agenda-lead">
          {/* 어느 열에서 눌렀는지를 남긴다. `발견한 문제` 와 `이후 계획` 은
              같은 안건을 다른 시점에서 말한 것이라, 열 이름이 없으면 두 줄이
              같은 얘기를 두 번 하는 것처럼 보인다. */}
          <p className="agenda-column">{column}</p>
          <h2>{item.text}</h2>
          {item.agenda_title ? (
            <p className="agenda-origin">회의 안건 · {item.agenda_title}</p>
          ) : null}
        </section>

        {item.context ? (
          <section className="agenda-section">
            <h3>어쩌다 나온 얘기인가</h3>
            <p>{item.context}</p>
          </section>
        ) : null}

        {debates.length > 0 ? (
          <section className="agenda-section">
            <h3>갈린 지점</h3>
            <ul className="agenda-debates">
              {debates.map((one) => (
                <li key={`${one.speaker}-${one.stance}`}>
                  <div className="agenda-debate-head">
                    <strong>{one.speaker}</strong>
                    <span>{one.stance}</span>
                  </div>
                  <p>{one.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {item.resolution ? (
          <section className="agenda-section">
            <h3>어떻게 됐나</h3>
            <p>{item.resolution}</p>
          </section>
        ) : null}

        {/*
          아직 안 정해진 것은 결론과 **같은 무게로 두지 않는다.** 나란히 두면
          결론이 두 개인 것처럼 읽혀서, 못 온 사람이 이미 정해진 줄 알고 그
          위에서 다음 일을 시작한다.
        */}
        {item.open_question ? (
          <section className="agenda-section agenda-open">
            <h3>아직 안 정해진 것</h3>
            <p>{item.open_question}</p>
          </section>
        ) : null}

        {edgeCount > 0 ? (
          <p className="agenda-edges">
            판에서 이 안건이 오간 화살표 <b>{edgeCount}</b>개를 함께 강조하고 있습니다.
          </p>
        ) : null}
      </div>

      <AgentDock inline />
    </aside>
  )
}
