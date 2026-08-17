import { useState } from 'react'

import { searchMessages } from './chat.data.js'
import { formatTime } from './chat.format.js'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

/**
 * 방 안 검색.
 *
 * 고치기 전에는 돋보기 버튼이 **자기 색만 바꾸고** 끝이었다. 검색창이 아예
 * 없어서 무엇을 하는 버튼인지 알 수 없었다.
 *
 * 결과를 누르면 그 날짜의 대화로 이동한다. 서버가 결과마다 `date` 를 같이
 * 주는 이유가 그것이다 — 메시지 하나만 띄우면 앞뒤 맥락이 없어 검색의 뜻이
 * 없다.
 *
 * 입력할 때마다 부르지 않고 제출할 때만 부른다. 채팅 검색은 `body__icontains`
 * 라 방이 클수록 무겁고, 한 글자마다 왕복하면 지운 글자에 대한 응답이 나중에
 * 도착해 **엉뚱한 결과가 남는다.**
 */
export function ChatRoomSearch({ roomId, onPick, onClose }) {
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  const { data, error, loading } = useResource(
    (signal) => (submitted ? searchMessages(roomId, submitted, signal) : Promise.resolve(null)),
    [roomId, submitted],
  )

  const results = data?.results ?? []

  return (
    <section className="chat-search" aria-label="대화 검색">
      <form
        className="chat-search-bar"
        onSubmit={(event) => {
          event.preventDefault()
          setSubmitted(query.trim())
        }}
      >
        <input
          aria-label="대화 검색어"
          placeholder="이 대화에서 찾을 말을 입력하세요"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={!query.trim()}>찾기</button>
        <button type="button" onClick={onClose}>닫기</button>
      </form>

      <div className="chat-search-results">
        {!submitted ? (
          <Empty>찾을 말을 입력하고 Enter 를 누르십시오.</Empty>
        ) : loading && !data ? (
          <Loading label="찾는 중입니다…" />
        ) : error ? (
          <LoadError error={error} />
        ) : results.length === 0 ? (
          <Empty>{`'${submitted}' 이(가) 들어간 말이 없습니다.`}</Empty>
        ) : (
          <>
            <p className="chat-search-count">{`${data.count}건`}</p>
            {results.map((row) => (
              <button
                className="chat-search-hit"
                key={row.message.id}
                type="button"
                onClick={() => onPick(row.date, row.message.id)}
              >
                <span className="chat-search-hit-meta">
                  <strong>{row.message.sender?.name ?? ''}</strong>
                  <time>{`${row.date} ${formatTime(row.message.sent_at)}`}</time>
                </span>
                <span className="chat-search-hit-body">{row.message.body}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
