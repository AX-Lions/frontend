/**
 * 팀의 **기준 시간대** 고르기 목록.
 *
 * ## 왜 전체 목록이 아닌가
 *
 * 브라우저는 `Intl.supportedValuesOf('timeZone')` 로 400개가 넘는 IANA 이름을
 * 준다. 그것을 그대로 뿌리면 `America/Indiana/Tell_City` 같은 줄이 대부분이라,
 * 정작 팀이 고를 도시를 찾지 못한다. 시안도 `UTC + 09:00 / 서울 · 도쿄` 처럼
 * **오프셋과 도시**로 보여 준다.
 *
 * 그래서 대표 도시만 추린다. 검색은 도시 이름 · 오프셋 · IANA 이름 셋 다
 * 걸리므로, 목록에 없는 곳을 아는 사람은 `Asia/Kathmandu` 로 찾을 수 있다.
 *
 * ## 오프셋을 박아 두지 않는 이유
 *
 * 서머타임 때문에 같은 도시의 오프셋이 계절마다 바뀐다. 박아 두면 반년 동안
 * 한 시간 틀린 값을 보여 준다. 부를 때 브라우저에 물어본다.
 */

export const TIME_ZONES = [
  { id: 'Pacific/Auckland', cities: '오클랜드 · 웰링턴' },
  { id: 'Australia/Sydney', cities: '시드니 · 멜버른' },
  { id: 'Asia/Seoul', cities: '서울 · 도쿄' },
  { id: 'Asia/Shanghai', cities: '베이징 · 상하이' },
  { id: 'Asia/Singapore', cities: '싱가포르 · 마닐라' },
  { id: 'Asia/Jakarta', cities: '자카르타 · 방콕' },
  { id: 'Asia/Kolkata', cities: '뉴델리 · 뭄바이' },
  { id: 'Asia/Dubai', cities: '두바이 · 아부다비' },
  { id: 'Europe/Moscow', cities: '모스크바 · 이스탄불' },
  { id: 'Europe/Berlin', cities: '베를린 · 파리' },
  { id: 'Europe/London', cities: '런던 · 리스본' },
  { id: 'UTC', cities: '협정 세계시' },
  { id: 'America/Sao_Paulo', cities: '상파울루 · 부에노스아이레스' },
  { id: 'America/New_York', cities: '뉴욕 · 토론토' },
  { id: 'America/Chicago', cities: '시카고 · 멕시코시티' },
  { id: 'America/Denver', cities: '덴버 · 캘거리' },
  { id: 'America/Los_Angeles', cities: '로스앤젤레스 · 밴쿠버' },
  { id: 'Pacific/Honolulu', cities: '호놀룰루' },
]

/** `UTC + 09:00`. 못 알아보는 시간대면 빈 문자열 — 줄을 지우지는 않는다. */
export function offsetLabel(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date())
    const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
    if (name === 'GMT') {
      return 'UTC + 00:00'
    }
    const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name)
    return match ? `UTC ${match[1]} ${match[2]}:${match[3]}` : ''
  } catch {
    return ''
  }
}

/** 브라우저가 보는 지금 위치. 시안의 `현재 위치` 묶음이 이것이다. */
export function currentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * 현재 위치가 목록에 없으면 그것도 한 줄로 만들어 준다.
 *
 * 목록에 없다고 `현재 위치` 칸을 비우면, 카트만두에 있는 사람은 자기 시간대를
 * 고를 길이 사라진다.
 */
export function zoneOf(id) {
  return TIME_ZONES.find((zone) => zone.id === id) ?? { id, cities: id.replace(/_/g, ' ') }
}

export function matchesZone(zone, needle) {
  if (!needle) {
    return true
  }
  const text = `${zone.cities} ${zone.id} ${offsetLabel(zone.id)}`.toLowerCase()
  return text.includes(needle.toLowerCase())
}
