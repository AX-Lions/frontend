import { toneIcons, toneLabels } from './flowBoard.api'

export function FlowMetricBadge({ tone }) {
  return (
    <span className={`metric-icon ${tone}`} aria-label={toneLabels[tone]}>
      <img src={toneIcons[tone]} alt="" />
    </span>
  )
}
