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

/**
 * 그 사람이 있는 곳의 지금 시각. `14:32`
 *
 * 방 머리에 참여자별로 띄운다. **시간대가 갈리는 팀에서 "지금 말을 걸어도
 * 되는 시간인가" 가 이 서비스의 첫 질문**이라, 이름 옆에 그곳 시각이 있어야
 * 자리를 비운 사람에게 대리인을 보낼지 직접 물을지 판단할 수 있다.
 *
 * 24시간제로 찍는다. `오후 2:32` 는 다섯 사람을 한 줄에 늘어놓기엔 길고,
 * 새벽인지 한밤인지를 읽는 데는 숫자가 더 빠르다.
 *
 * 시간대를 못 읽으면 빈 문자열이다 — `Intl` 은 모르는 시간대에 예외를 던진다.
 * 서버가 프로필에 시간대를 안 채워 준 사람이 있으므로 그때는 조용히 뺀다.
 */
/*
  시간대별 포맷터를 담아 둔다.

  `Intl.DateTimeFormat` 을 만드는 것은 **싸지 않다.** 안 담아 두면 참여자
  다섯 명짜리 방에서 1 분마다 열 개(시각용·시각용 시 추출) 를 새로 만들고,
  같은 시각을 여러 화면에 걸면 그만큼 곱해진다. 시간대 문자열은 몇 개 안 되고
  프로세스가 사는 동안 안 바뀐다.

  못 만든 시간대는 `null` 로 기억한다 — 서버가 프로필에 이상한 값을 채워
  두면 `try` 가 1 분마다 다시 던진다.
*/
const timeFormatters = new Map()
const hourFormatters = new Map()

function formatterFor(cache, timezone, options) {
  if (cache.has(timezone)) {
    return cache.get(timezone)
  }
  let made
  try {
    made = new Intl.DateTimeFormat(options.locale, { ...options.parts, timeZone: timezone })
  } catch {
    made = null
  }
  cache.set(timezone, made)
  return made
}

export function zoneTime(timezone, now = new Date()) {
  if (!timezone) {
    return ''
  }
  const formatter = formatterFor(timeFormatters, timezone, {
    locale: 'ko-KR',
    parts: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  })
  return formatter ? formatter.format(now) : ''
}

/**
 * 그곳이 지금 몇 시인가. 못 읽으면 `null`.
 *
 * `zoneTime` 이 만든 문자열을 다시 파싱하지 않는다 — 형식이 바뀌면 조용히
 * 어긋난다. 숫자가 필요하면 숫자로 뽑는다.
 */
export function zoneHour(timezone, now = new Date()) {
  if (!timezone) {
    return null
  }
  const formatter = formatterFor(hourFormatters, timezone, {
    locale: 'en-US',
    parts: { hour: '2-digit', hourCycle: 'h23' },
  })
  return formatter ? Number(formatter.format(now)) : null
}

/**
 * 지금 말을 걸어도 되는 시간인가.
 *
 * 08:00–22:00 을 깨어 있는 시간으로 본다. 정확한 근무 시간은 사람마다 다르지만,
 * 이 표시가 답하려는 것은 "출근했나" 가 아니라 **"자고 있나"** 다 — 새벽에
 * 보낸 말이 답을 못 받는 것과, 답을 받을 수 있는데 안 오는 것은 다른 상황이고
 * 그때 할 일도 다르다(전자는 대리인에게 맡긴다).
 */
export function isAwakeHour(timezone, now = new Date()) {
  const hour = zoneHour(timezone, now)
  if (hour === null) {
    return true
  }
  return hour >= 8 && hour < 22
}

/**
 * 보는 사람과 시간대가 다른가.
 *
 * 같으면 그곳 시각이 내 시계와 똑같다. 다른 사람만 눈에 띄게 한다.
 */
export function inOtherZone(timezone) {
  if (!timezone) {
    return false
  }
  return timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone
}

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
