import { useEffect, useMemo, useRef, useState } from 'react'

import { icons } from './chat.icons.js'
import { ChatDateCalendar } from './ChatDateCalendar.jsx'
import { fetchMessages, fetchRoom, sendMessage, toPreview } from './chat.data.js'
import { formatTime, localDate, localMonth, withDayDividers } from './chat.format.js'
import { BordoAvatar, Icon, IconButton } from './chat.ui.jsx'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

function ChatMessage({ row, onOpenCalendar }) {
  if (row.kind === 'day') {
    return (
      <button
        className="date-divider"
        type="button"
        title={`${row.label} · 다른 날짜로 이동`}
        onClick={() => onOpenCalendar(row.date)}
      >
        {row.label}
        <Icon src={icons.expandRight} />
      </button>
    )
  }

  const { message } = row
  const time = formatTime(message.sent_at)

  if (message.is_mine) {
    return (
      <div className="message-row me">
        <time>{time}</time>
        <p className="message-bubble orange">{message.body}</p>
      </div>
    )
  }

  return (
    <div className="message-row bot">
      {/* 대리인이 보낸 것과 사람이 보낸 것을 가른다. 화면에서 대리인은
          `{이름}의 Bordo` 로 불리고 아바타도 다르다. */}
      {message.sender?.is_agent || !message.sender?.avatar_url ? (
        <BordoAvatar />
      ) : (
        <img className="chat-avatar" src={message.sender.avatar_url} alt="" />
      )}
      <div>
        <strong>{message.sender?.name ?? ''}</strong>
        <span>
          <p className="message-bubble gray">{message.body}</p>
          <time>{time}</time>
        </span>
      </div>
    </div>
  )
}

export function ChatRoom({ room, roomId, onClose }) {
  /*
    목록에 없는 방은 그 자체로 읽는다.

    사이드바는 팀 단체방을 **id 로만** 준다(`group_chat_room_id`). 트리 어디에도
    방 객체가 없어서, `모두 채팅 바로가기` 로 연 방은 제목 칸이 비어 있었다.
    이름 없는 대화창은 어느 방인지 알 수 없다.

    목록에 있는 방은 다시 읽지 않는다. 방을 옮길 때마다 이미 가진 값을 한 번 더
    받는 요청이 나가는 것을 피한다.
  */
  const hasListRow = Boolean(room)
  const detail = useResource(
    (signal) => (roomId && !hasListRow ? fetchRoom(roomId, signal) : Promise.resolve(null)),
    [roomId, hasListRow],
  )
  const header = room ?? toPreview(detail.data)

  const [roomTool, setRoomTool] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  // 달력에서 고른 날. 서버는 `date` 와 `before` 를 함께 못 받는다 — 날짜로 뛰는
  // 것과 위로 이어 보는 것은 기준점이 다르다.
  const [jumpDate, setJumpDate] = useState(null)
  const [calendarMonth, setCalendarMonth] = useState(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderError, setOlderError] = useState('')
  const canSend = messageText.trim().length > 0 && !sending && Boolean(roomId)

  const { data, error, loading, setData } = useResource(
    (signal) => (roomId
      ? fetchMessages(roomId, { date: jumpDate ?? undefined }, signal)
      : Promise.resolve(null)),
    [roomId, jumpDate],
  )

  const messages = useMemo(() => data?.results ?? [], [data])
  const rows = useMemo(() => withDayDividers(messages), [messages])

  const scrollRef = useRef(null)

  /*
    맨 아래로 내린다.

    고치기 전에는 방을 열면 **50건 중 가장 오래된 것**이 화면 맨 위에 있었다.
    최근 대화를 보려면 매번 손으로 끝까지 내려야 했다.

    의존성이 `마지막 메시지 id` 인 것이 중요하다. 메시지 수로 잡으면 위로 이어
    붙였을 때도 조건이 바뀌어 **읽던 자리를 잃고 맨 아래로 튄다.** 마지막 것이
    그대로면 위에 뭘 붙이든 여기서는 아무 일도 하지 않는다.
  */
  const lastMessageId = messages.length ? messages[messages.length - 1].id : null
  useEffect(() => {
    const element = scrollRef.current
    if (!element || !lastMessageId) {
      return
    }
    // 날짜로 뛴 경우는 그날 처음부터 봐야 한다. 그날 마지막 줄을 보여주면
    // 사용자는 왜 이 자리인지 알 수 없다.
    element.scrollTop = jumpDate ? 0 : element.scrollHeight
  }, [lastMessageId, jumpDate])

  /**
   * 위로 50건 더.
   *
   * 서버가 `next_before` 와 `has_older` 를 주는데 화면이 한 번도 안 썼다.
   * 50건 이전을 볼 방법이 아예 없어서, 어제 이야기가 사라진 것처럼 보였다.
   */
  const loadOlder = async () => {
    const cursor = data?.next_before
    if (!cursor || loadingOlder) {
      return
    }

    setLoadingOlder(true)
    setOlderError('')
    const element = scrollRef.current
    // 아래쪽에서 잰다. 위에 내용이 붙으면 `scrollTop` 기준은 밀리지만
    // `scrollHeight - scrollTop` 은 그대로다.
    const fromBottom = element ? element.scrollHeight - element.scrollTop : 0

    try {
      const older = await fetchMessages(roomId, { before: cursor })
      setData((current) => ({
        ...(current ?? {}),
        results: [...(older.results ?? []), ...(current?.results ?? [])],
        next_before: older.next_before,
        has_older: older.has_older,
      }))
      // 붙인 만큼 위로 밀린다. 보고 있던 줄이 제자리에 있게 되돌린다.
      window.requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - fromBottom
        }
      })
    } catch (err) {
      setOlderError(err?.message || '이전 대화를 불러오지 못했습니다.')
    } finally {
      setLoadingOlder(false)
    }
  }

  const toggleRoomTool = (nextTool) => {
    setRoomTool((current) => (current === nextTool ? '' : nextTool))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSend) {
      return
    }

    const body = messageText.trim()
    setSending(true)
    setSendError('')
    try {
      // 중복 전송은 도메인 키로 막는다. `Idempotency-Key` 는 계약에만 있고
      // 아직 동작하지 않는다.
      const sent = await sendMessage(roomId, { body, clientMessageId: crypto.randomUUID() })
      // 날짜로 뛰어 과거를 보던 중이면 최근으로 돌아온다. 안 그러면 방금 보낸
      // 말이 화면 어디에도 없다.
      setJumpDate(null)
      setData((current) => ({
        ...(current ?? { results: [] }),
        results: [...(current?.results ?? []), sent],
      }))
      setMessageText('')
    } catch (err) {
      // 입력한 것을 지우지 않는다. 지우면 다시 칠 수밖에 없다.
      setSendError(err?.message || '보내지 못했습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="chat-room" aria-label="채팅창">
      <header className="chat-room-header">
        {/*
          `onClick` 이 없어 **눌러도 아무 일도 일어나지 않았다.** 화살표가 있으니
          사용자는 눌러 보고, 안 되면 화면이 멈춘 줄 안다.

          대화를 닫아 목록만 남긴다. 브라우저 뒤로가기를 부르면 채팅 화면 자체를
          떠나 버리는데, 이 자리의 화살표가 뜻하는 것은 **대화에서 나오기**다.
        */}
        <button className="back-button" type="button" aria-label="뒤로가기" onClick={onClose}>
          <Icon src={icons.expandLeft} />
        </button>
        <div className="chat-room-title">
          <strong>{header?.name ?? ''}</strong>
          <span>{header?.context ?? ''}</span>
        </div>
        <div className="chat-room-actions">
          <IconButton label="검색" active={roomTool === 'search'} onClick={() => toggleRoomTool('search')}>
            <Icon src={icons.search} />
          </IconButton>
          <IconButton label="전체 화면" active={roomTool === 'fullscreen'} onClick={() => toggleRoomTool('fullscreen')}>
            <Icon src={icons.fullscreen} />
          </IconButton>
          <IconButton label="메뉴" active={roomTool === 'menu'} onClick={() => toggleRoomTool('menu')}>
            <Icon src={icons.menu} />
          </IconButton>
        </div>
      </header>

      {jumpDate ? (
        <div className="chat-jump-banner" role="status">
          <span>{`${jumpDate} 의 대화를 보고 있습니다.`}</span>
          <button type="button" onClick={() => setJumpDate(null)}>최근 대화로</button>
        </div>
      ) : null}

      <div className="chat-message-scroll" ref={scrollRef}>
        {!roomId ? (
          <Empty>왼쪽에서 대화를 고르십시오.</Empty>
        ) : loading && !data ? (
          <Loading label="대화를 불러오는 중입니다…" />
        ) : error && !data ? (
          <LoadError error={error} />
        ) : rows.length === 0 ? (
          <Empty>
            {jumpDate ? '이 날에는 오간 대화가 없습니다.' : '아직 나눈 이야기가 없습니다.'}
          </Empty>
        ) : (
          <>
            {data?.has_older ? (
              <div className="chat-older">
                <button type="button" disabled={loadingOlder} onClick={loadOlder}>
                  {loadingOlder ? '불러오는 중…' : '이전 대화 더 보기'}
                </button>
                {olderError ? <p role="alert">{olderError}</p> : null}
              </div>
            ) : (
              // 끝까지 왔다는 것도 알려 준다. 아무것도 없으면 아직 덜 불러온 것과
              // 구분되지 않는다.
              <p className="chat-older-end">대화의 처음입니다.</p>
            )}
            {rows.map((row) => (
              <ChatMessage key={row.id} row={row} onOpenCalendar={setCalendarMonth} />
            ))}
          </>
        )}
      </div>

      {sendError ? <p className="chat-send-error" role="alert">{sendError}</p> : null}

      <form className={canSend ? 'chat-composer can-send' : 'chat-composer'} onSubmit={submit}>
        <button type="button" aria-label="첨부파일">
          <Icon src={icons.addSmall} />
        </button>
        <button type="button" aria-label="설정">
          <Icon src={icons.filter} />
        </button>
        <input
          aria-label="채팅 입력"
          placeholder="채팅을 입력하세요..."
          value={messageText}
          disabled={!roomId}
          onChange={(event) => setMessageText(event.target.value)}
        />
        <button className="send" type="submit" aria-label="전송" disabled={!canSend}>
          <Icon src={icons.send} />
        </button>
      </form>

      {calendarMonth && roomId ? (
        <ChatDateCalendar
          initialMonth={localMonth(calendarMonth)}
          roomId={roomId}
          selectedDate={jumpDate ?? localDate(new Date())}
          onClose={() => setCalendarMonth(null)}
          onPick={(date) => {
            setJumpDate(date)
            setCalendarMonth(null)
          }}
        />
      ) : null}
    </main>
  )
}
