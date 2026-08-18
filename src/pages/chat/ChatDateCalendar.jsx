import { useState } from 'react'

import { fetchActiveDates } from './chat.data.js'
import { useResource } from '../../lib/useResource.js'
import { LoadError, Loading } from '../../shared/components/LoadState.jsx'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function shiftMonth(month, step) {
  const [year, index] = month.split('-').map(Number)
  const at = new Date(year, index - 1 + step, 1)
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
}

/**
 * 대화한 날짜로 뛰는 달력.
 *
 * 고치기 전에는 날짜 구분선이 **버튼 모양인데 아무 일도 안 했다.** 눌러 본
 * 사용자는 화면이 멈춘 줄 안다. 서버에는 `/active-dates` 가 있어서, 그 방에서
 * 실제로 대화가 오간 날이 어느 날인지 알 수 있다.
 *
 * 대화가 없는 날은 **지우지 않고 못 누르게만** 한다. 지우면 달력이 아니라
 * 목록이 되어서, 8월 14일이 그 달의 몇 번째 주 금요일인지 알 수 없다.
 */
export function ChatDateCalendar({ roomId, initialMonth, selectedDate, onPick, onClose }) {
  const [month, setMonth] = useState(initialMonth)
  const { data, error, loading } = useResource(
    (signal) => fetchActiveDates(roomId, month, signal),
    [roomId, month],
  )

  const [year, index] = month.split('-').map(Number)
  const dayCount = new Date(year, index, 0).getDate()
  const leading = new Date(year, index - 1, 1).getDay()
  const active = new Set(data?.active_dates ?? [])

  return (
    <div className="chat-overlay" role="dialog" aria-label="날짜로 이동" aria-modal="true">
      {/* 바깥을 눌러 닫는다. 키보드로도 닫을 수 있게 아래에 닫기 버튼을 둔다. */}
      <button className="chat-overlay-backdrop" type="button" aria-label="닫기" onClick={onClose} />
      <div className="chat-calendar">
        <header className="chat-calendar-header">
          <button
            type="button"
            aria-label="이전 달"
            disabled={loading || !data?.has_prev_month}
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
          >
            ‹
          </button>
          <strong>{`${year}년 ${index}월`}</strong>
          <button
            type="button"
            aria-label="다음 달"
            disabled={loading || !data?.has_next_month}
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
          >
            ›
          </button>
        </header>

        {loading && !data ? <Loading label="대화한 날짜를 확인하는 중입니다…" /> : null}
        {error && !data ? <LoadError error={error} /> : null}

        {data ? (
          <>
            <div className="chat-calendar-grid" role="grid">
              {WEEKDAYS.map((label) => (
                <span className="chat-calendar-weekday" key={label}>{label}</span>
              ))}
              {Array.from({ length: leading }, (_, i) => (
                <span key={`lead-${i}`} />
              ))}
              {Array.from({ length: dayCount }, (_, i) => {
                const day = i + 1
                const date = `${month}-${String(day).padStart(2, '0')}`
                const hasChat = active.has(date)
                return (
                  <button
                    className={[
                      'chat-calendar-day',
                      hasChat ? 'has-chat' : '',
                      selectedDate === date ? 'selected' : '',
                    ].filter(Boolean).join(' ')}
                    key={date}
                    type="button"
                    disabled={!hasChat}
                    title={hasChat ? `${date} 대화 보기` : '이 날은 대화가 없습니다.'}
                    onClick={() => onPick(date)}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            {active.size === 0 ? (
              <p className="chat-calendar-note">이 달에는 오간 대화가 없습니다.</p>
            ) : null}
          </>
        ) : null}

        <footer className="chat-calendar-footer">
          <button type="button" onClick={onClose}>닫기</button>
        </footer>
      </div>
    </div>
  )
}
