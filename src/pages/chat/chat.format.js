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

/**
 * `2026-08-14` — 보는 사람의 시간대 기준 날짜.
 *
 * `toISOString().slice(0, 10)` 을 쓰면 안 된다. 그건 UTC 기준이라 한국에서
 * 새벽 1시에 보낸 메시지가 **전날로 묶인다.**
 *
 * 서버의 `active-dates` · `?date=` 는 장고 시간대(Asia/Seoul) 기준이라, 다른
 * 시간대에서 보면 하루가 어긋날 수 있다. 지금은 팀이 모두 같은 시간대라
 * 문제가 안 되지만, 시간대가 갈리는 순간 서버가 날짜 기준을 정해 줘야 한다.
 */
export function localDate(at) {
  const year = at.getFullYear()
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `2026-08` — 달력이 한 번에 읽는 단위. */
export function localMonth(date) {
  return date.slice(0, 7)
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
    const at = new Date(message.sent_at)
    const key = localDate(at)
    if (key !== lastDay) {
      // `date` 를 같이 실어 둔다. 구분선을 누르면 그 달의 달력을 여는데,
      // 화면에서 `2026년 8월 14일 금요일` 을 되파싱하는 것보다 낫다.
      out.push({ kind: 'day', id: `day-${key}`, date: key, label: DAY.format(at) })
      lastDay = key
    }
    out.push({ kind: 'message', id: message.id, message })
  })

  return out
}
