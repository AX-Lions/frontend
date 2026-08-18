import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { FlowMetricBadge } from './FlowMetricBadge'
import { toneOf } from './flowBoard.data'

/**
 * 노드 하나 · 화살표 뱃지 하나를 눌렀을 때 열리는 우측 패널.
 *
 * ## 사람 패널은 절반만 그린다
 *
 * 새 디자인은 사람을 고르면 그 사람의 `작업 한눈에 보기` 와 `전달한 내용` 을
 * 보여 준다. **백엔드에 사람 스코프 엔드포인트가 없다**
 * (`GET /projects/{id}/flow/participants/{user_id}` 가 계획에만 있다).
 *
 * 목으로 채우지 않는다. "아직 없다" 와 "가짜"는 다르고, 가짜를 채워 두면
 * API 가 붙었을 때 아무도 눈치채지 못한다. 대신 **고른 상태와 이름·참석
 * 여부까지는 지금 동작한다** — 노드를 눌러도 아무 일이 없던 것과는 다르다.
 */

const ATTENDANCE_LABEL = {
  PENDING: '참석 미정',
  PRESENT: '참석',
  ABSENT: '불참',
  DELEGATED: '대리 참석',
}

const SURFACE_LABEL = {
  SERVICE: '서비스',
  DISCORD: 'Discord',
}

function PanelShell({ children, onClose, subtitle, title }) {
  return (
    <aside className="briefing-panel inspector-panel" aria-label={title}>
      <header className="briefing-header">
        <h2>{title}</h2>
        <button className="panel-close" type="button" aria-label="패널 닫기" onClick={onClose}>
          ×
        </button>
        {subtitle ? <p className="inspector-subtitle">{subtitle}</p> : null}
      </header>
      <div className="briefing-scroll inspector-scroll">{children}</div>
    </aside>
  )
}

export function FlowNodePanel({ node, onClose, participant }) {
  const isAgent = node.kind === 'AGENT'
  const attendance = participant ? ATTENDANCE_LABEL[participant.attendance] : null

  return (
    <PanelShell
      title={node.name}
      subtitle={isAgent ? 'AI 대리인' : (attendance ?? '참여자')}
      onClose={onClose}
    >
      <section className="inspector-section">
        <h3>작업 한눈에 보기</h3>
        <Empty>사람별 작업 요약은 아직 서버에 없습니다.</Empty>
      </section>

      <section className="inspector-section">
        <h3>전달한 내용</h3>
        <Empty>사람별 전달 내역은 아직 서버에 없습니다.</Empty>
      </section>

      {participant?.delegated ? (
        <p className="inspector-note">이 회의는 대리인이 대신 참석했습니다.</p>
      ) : null}
    </PanelShell>
  )
}

/**
 * 화살표 뱃지 상세.
 *
 * `fetchEdge` 는 정의만 되고 **아무도 부르지 않았다.** 뱃지를 눌러도 상세가
 * 열리지 않은 이유다. 뱃지 하나가 엣지 여럿을 묶고 있어(`의견 3`) 묶인 것을
 * 다 읽어 목록으로 편다.
 *
 * 시각은 그리지 않는다. 서버가 완성해 준 문자열이 이 응답에는 없고, 원본
 * `occurred_at` 을 클라이언트가 찍으면 브라우저 시간대로 나가 같은 화살표를
 * 사람마다 다른 시각으로 본다.
 */
export function FlowEdgePanel({ count, direction, edges, onClose }) {
  const tone = toneOf(count.content_type)

  return (
    <PanelShell title={count.label} subtitle={direction} onClose={onClose}>
      {edges.loading && !edges.data ? <Loading label="화살표를 여는 중입니다…" /> : null}
      {edges.error && !edges.data ? <LoadError error={edges.error} onRetry={edges.reload} /> : null}

      {edges.data ? (
        <section className="inspector-section">
          <header className="inspector-count">
            <FlowMetricBadge tone={tone} />
            <b>{count.count}</b>
          </header>

          {edges.data.length === 0 ? (
            <Empty>이 뱃지에 걸린 내용을 불러오지 못했습니다.</Empty>
          ) : (
            <div className="inspector-card-list">
              {edges.data.map(({ edge, agenda, document }) => (
                <article className="inspector-card" key={edge.id}>
                  <strong>{edge.label}</strong>
                  <small>{edge.direction_label}</small>
                  <div className="inspector-chips">
                    {edge.surface ? <span>{SURFACE_LABEL[edge.surface] ?? edge.surface}</span> : null}
                    {agenda ? <span>{agenda.title}</span> : null}
                    {document ? <span>{document.title}</span> : null}
                  </div>
                  {/* 작업 모드에서만 채워진다. 회의 모드에서는 빈 문자열이라 안 그린다. */}
                  {edge.source_url ? (
                    <a href={edge.source_url} target="_blank" rel="noreferrer">
                      {edge.source || '원본'} 열기
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </PanelShell>
  )
}
