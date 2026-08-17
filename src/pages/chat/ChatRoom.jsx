import { useMemo, useState } from 'react'

import { icons } from './chat.icons.js'
import { fetchMessages, sendMessage } from './chat.data.js'
import { formatTime, withDayDividers } from './chat.format.js'
import { BordoAvatar, Icon, IconButton } from './chat.ui.jsx'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

function ChatMessage({ row }) {
  if (row.kind === 'day') {
    return (
      <button className="date-divider" type="button">
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
  const [roomTool, setRoomTool] = useState('')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const canSend = messageText.trim().length > 0 && !sending && Boolean(roomId)

  const { data, error, loading, setData } = useResource(
    (signal) => (roomId ? fetchMessages(roomId, {}, signal) : Promise.resolve(null)),
    [roomId],
  )

  const rows = useMemo(() => withDayDividers(data?.results ?? []), [data])

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
          <strong>{room?.name ?? ''}</strong>
          <span>{room?.context ?? ''}</span>
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

      <div className="chat-message-scroll">
        {!roomId ? (
          <Empty>왼쪽에서 대화를 고르십시오.</Empty>
        ) : loading && !data ? (
          <Loading label="대화를 불러오는 중입니다…" />
        ) : error && !data ? (
          <LoadError error={error} />
        ) : rows.length === 0 ? (
          <Empty>아직 나눈 이야기가 없습니다.</Empty>
        ) : rows.map((row) => (
          <ChatMessage key={row.id} row={row} />
        ))}
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
    </main>
  )
}
