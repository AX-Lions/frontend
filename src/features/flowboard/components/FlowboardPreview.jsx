const steps = [
  { title: 'Problem', body: '문제와 대상 사용자 정의' },
  { title: 'Flow', body: '가장 강한 사용 시나리오 1개' },
  { title: 'Demo', body: '심사위원에게 보여줄 결과 화면' },
]

export function FlowboardPreview() {
  return (
    <aside id="flowboard" className="flowboard" aria-label="MVP 플로우 미리보기">
      <div className="flowboard-header">
        <span>Build Flow</span>
        <strong>3 steps</strong>
      </div>

      <ol className="flow-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}
