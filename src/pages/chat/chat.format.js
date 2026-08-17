/**
 * 채팅 화면에서 시각을 찍는 규칙.
 *
 * ## 여기서는 클라이언트가 포맷한다
 *
 * 홈·플로우의 시각은 서버가 완성해 내려준다(`displayed_at` · `time_range`).
 * 회의는 **참여자마다 다른 시간대**에서 보므로 서버가 계산해야 어긋나지 않는다.
 *
 * 채팅은 다르다. `오전 11:23` 은 **보는 사람의 지금**을 기준으로 읽히는 값이고,
 * 메시지마다 문자열을 만들어 내려보내면 응답이 커진다. 그래서 여기서 만든다.
 */

const TIME = new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
})

export function formatTime(iso) {
  if (!iso) {
    return ''
  }
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? '' : TIME.format(at)
}

function dayKey(iso) {
  const at = new Date(iso)
  return `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`
}

/**
 * 날짜가 바뀌는 자리에 구분선을 끼운다.
 *
 * 서버는 메시지만 준다. 구분선은 **화면에서만 쓰는 것**이라 목록에 섞어 두면
 * 나중에 메시지 수를 세거나 마지막 메시지를 찾을 때 걸린다. 그래서 그리기
 * 직전에만 만든다.
 */
export function withDayDividers(messages) {
  const out = []
  let lastDay = null

  messages.forEach((message) => {
    const key = dayKey(message.sent_at)
    if (key !== lastDay) {
      out.push({ kind: 'day', id: `day-${key}`, label: DAY.format(new Date(message.sent_at)) })
      lastDay = key
    }
    out.push({ kind: 'message', id: message.id, message })
  })

  return out
}
