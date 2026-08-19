import { useState } from 'react'

import {
  confirmMessageImportant,
  deleteMessage,
  editMessage,
  setMessageImportant,
} from './chat.data.js'
import { formatTime } from './chat.format.js'
import { BordoAvatar, RequestIcon } from './chat.ui.jsx'

/**
 * 메시지 한 줄과 거기서 할 수 있는 일.
 *
 * 백엔드에 수정 · 삭제 · 중요 표시 · 중요 확인 네 라우트가 있는데 화면에서
 * 부를 방법이 하나도 없었다. 특히 **중요 확인이 없으면 상단 `중요 채팅` 섹션을
 * 비울 방법이 아예 없다** — 한 번 중요로 찍힌 대화가 영원히 거기 남는다.
 *
 * 동작을 말풍선 옆 `⋮` 하나에 모은다. 버튼을 늘어놓으면 말풍선보다 도구가 커진다.
 */
export function ChatMessageRow({ message, focused, myAgentRoom, onChanged, onImportantChanged }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const deleted = Boolean(message.deleted_at)
  const time = formatTime(message.sent_at)

  /*
    내 쪽에 앉는 말.

    내가 쓴 것과 **내 대리인이 나 대신 한 것**이 여기 함께 온다. 상대에게는
    둘 다 나에게서 온 말이고, 내 화면에서만 왼쪽에 떨어져 있으면 "내가 없는
    동안 내 쪽에서 무슨 말이 나갔는지" 가 남의 말과 섞여 안 읽힌다.

    **내 Bordo 와 단둘이 있는 방만 예외다.** 거기서 내 Bordo 는 나를 대신하는
    쪽이 아니라 내가 말을 거는 상대다. 규칙을 그대로 두면 물음과 답이 전부
    오른쪽에 쌓여 대화가 아니라 혼잣말처럼 보인다.

    고치고 지우는 것은 `is_mine` 만이다 — 대리인이 한 문장은 내가 쓴 것이
    아니라 서버가 수정을 거절한다.
  */
  const byMyAgent = Boolean(message.is_from_my_agent) && !myAgentRoom
  const onMySide = Boolean(message.is_mine) || byMyAgent

  /**
   * 서버가 돌려준 메시지로 갈아 끼운다.
   *
   * 화면이 스스로 값을 바꾸지 않는 이유 — `is_important` 를 내리면 서버는
   * 확인 기록까지 지운다. 화면에서 필드 하나만 뒤집으면 그 규칙을 흉내 내야 하고,
   * 서버 규칙이 바뀔 때마다 두 곳이 갈린다.
   *
   * `important` 를 따로 받는 이유 — 중요 표시·해제·확인은 **이 줄 밖에도 보인다.**
   * 좌측 `중요 채팅` 목록과 사이드바 `!` 뱃지가 같은 서버 상태를 그려서, 여기서만
   * 갈아 끼우면 말풍선의 `확인` 을 눌러도 목록에서는 안 사라진다. 같은 버튼이 두
   * 군데인데 한쪽만 동작하니 사용자는 계속 누른다.
   *
   * 성공한 뒤에만 알린다. 실패한 변경까지 알리면 아무것도 안 바뀐 목록을
   * 다시 읽게 된다.
   */
  const run = async (task, { important = false } = {}) => {
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const updated = await task()
      if (updated) {
        onChanged(updated)
      }
      if (important) {
        onImportantChanged?.()
      }
      setMenuOpen(false)
      setEditing(false)
    } catch (err) {
      // 규약상 `error.message` 는 사용자에게 그대로 보여줄 한국어다. 수정 시간이
      // 지났다거나 대리인 발언이라 못 고친다는 사유가 여기 담겨 온다.
      setError(err?.message || '처리하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const menu = deleted ? null : (
    <div className="message-tools">
      <button
        className="message-tools-toggle"
        type="button"
        aria-label="메시지 메뉴"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        ⋮
      </button>
      {menuOpen ? (
        <div className="message-menu">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(
              () => setMessageImportant(message.id, !message.is_important),
              { important: true },
            )}
          >
            {message.is_important ? '중요 해제' : '중요 표시'}
          </button>
          {message.is_important && !message.important_confirmed_at ? (
            // 표시를 내리는 것과 다르다. `is_important` 는 남고 내 확인 기록만
            // 생겨서, 상단 `중요 채팅` 에서만 빠진다.
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => confirmMessageImportant(message.id), { important: true })}
            >
              확인
            </button>
          ) : null}
          {message.is_mine ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(message.body)
                setEditing(true)
                setMenuOpen(false)
              }}
            >
              수정
            </button>
          ) : null}
          {message.is_mine ? (
            <button className="danger" type="button" disabled={busy} onClick={() => run(() => deleteMessage(message.id))}>
              삭제
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )

  const bubble = (tone) => {
    if (deleted) {
      return <p className="message-bubble deleted">삭제된 메시지입니다</p>
    }

    if (editing) {
      return (
        <form
          className="message-edit"
          onSubmit={(event) => {
            event.preventDefault()
            const body = draft.trim()
            if (!body) {
              setError('내용을 비울 수 없습니다.')
              return
            }
            run(() => editMessage(message.id, body))
          }}
        >
          <textarea
            aria-label="메시지 수정"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div>
            <button type="submit" disabled={busy}>저장</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setError('') }}>
              취소
            </button>
          </div>
        </form>
      )
    }

    return (
      <>
        {message.body ? <p className={`message-bubble ${tone}`}>{message.body}</p> : null}
        {message.attachments?.length ? (
          <ul className={`message-files ${tone}`}>
            {message.attachments.map((file) => (
              <li key={file.id}>
                <span>{file.name}</span>
                {/*
                  누를 수 있는 링크로 만들지 않았다. 서버가 넣는 `url` 은
                  `/media/chat/...` 자리표시자이고 저장소가 아직 안 붙어 있어서,
                  누르면 404 다. **붙었다는 사실**은 보여주되 받을 수 있는 척은
                  하지 않는다.
                */}
                <em>내려받기는 저장소 연결 후</em>
              </li>
            ))}
          </ul>
        ) : null}
      </>
    )
  }

  const marks = (
    <>
      {message.is_important ? (
        <span
          className={message.important_confirmed_at ? 'message-mark confirmed' : 'message-mark'}
          data-tip={message.important_confirmed_at ? '확인한 중요 메시지' : '중요 메시지'}
        >
          <RequestIcon muted={Boolean(message.important_confirmed_at)} small />
        </span>
      ) : null}
      {message.edited_at ? <span className="message-edited">수정됨</span> : null}
    </>
  )

  if (onMySide) {
    const className = [
      'message-row me',
      byMyAgent ? 'by-agent' : '',
      focused ? 'focused' : '',
    ].filter(Boolean).join(' ')

    return (
      <div className={className} data-message-id={message.id}>
        {menu}
        <span className="message-side">
          {marks}
          {/* 몇 명이 읽었는지도 서버가 준다. 안 그리면 보낸 사람은 상대가
              봤는지 알 방법이 없다. */}
          {message.read_count > 0 ? <span className="message-read">{`읽음 ${message.read_count}`}</span> : null}
          <time>{time}</time>
        </span>
        <span className="message-body">
          {/*
            누가 한 말인지 적는다.

            내 쪽 말풍선에는 원래 이름이 없다 — 내가 쓴 것이 뻔해서다. 대리인이
            대신 한 말은 그 전제가 깨지므로, **여기만** 이름을 붙인다. 색만으로
            가르면 나중에 되짚어 읽을 때 "이걸 내가 썼던가" 를 매번 다시 판단하게
            된다.
          */}
          {byMyAgent ? <em className="message-agent-caption">{message.sender?.name}</em> : null}
          {bubble(byMyAgent ? 'agent' : 'orange')}
          {error ? <span className="message-error" role="alert">{error}</span> : null}
        </span>
      </div>
    )
  }

  return (
    <div className={focused ? 'message-row bot focused' : 'message-row bot'} data-message-id={message.id}>
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
          <span className="message-body">
            {/*
              대리인이 한 말은 **색이 다르다.**

              `{이름}의 Bordo` 라는 이름과 아바타로만 갈라 두었는데, 대화가
              길어지면 이름은 연속된 말풍선에서 한 번만 보이고 아바타는
              작아서, 지나고 나서 읽을 때 **어느 말이 사람이 한 것이고 어느
              말이 대리인이 대신 한 것인지** 구별되지 않았다. 자리를 비운 사이
              오간 말을 되짚는 것이 이 화면의 일이라, 그 구별이 말풍선 자체에
              있어야 한다. `sender.is_agent` 는 서버가 이미 주고 있었다.
            */}
            {bubble(message.sender?.is_agent ? 'agent' : 'gray')}
            {error ? <span className="message-error" role="alert">{error}</span> : null}
          </span>
          <span className="message-side">
            {marks}
            <time>{time}</time>
          </span>
        </span>
      </div>
      {menu}
    </div>
  )
}
