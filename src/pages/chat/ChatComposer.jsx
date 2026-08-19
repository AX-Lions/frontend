import { useRef, useState } from 'react'

import { icons } from './chat.icons.js'
import { deleteAttachment, sendMessage, uploadAttachment } from './chat.data.js'
import { Icon } from './chat.ui.jsx'

function readableSize(bytes) {
  if (!bytes) {
    return ''
  }
  if (bytes < 1024) {
    return `${bytes}B`
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)}KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * 입력창.
 *
 * 왼쪽 버튼 두 개에 `onClick` 이 없었다. 아이콘만 있고 눌러도 아무 일이 없으니,
 * 사용자는 첨부가 안 되는 것인지 고장 난 것인지 알 수 없다.
 *
 * 두 버튼에 서버가 실제로 받는 일을 하나씩 맡겼다.
 * - `+` 는 파일 올리기(`POST /chat/rooms/{id}/attachments`)
 * - 슬라이더는 `AI 대리인 설정` 을 연다
 *
 * 슬라이더는 원래 `중요로 보내기` 였다. 설정을 뜻하는 모양에 전혀 다른 일이
 * 걸려 있어, 누른 사람은 설정을 기대하는데 보내는 방식이 바뀌었다. 시안이
 * 가리키는 것도 대리인 설정이라 그쪽으로 맞춘다.
 *
 * 보낼 때 중요로 지정하는 길은 없앴지만 **기능이 사라진 것은 아니다.** 보낸 뒤
 * 말풍선 메뉴에서 `중요 표시` 를 누르면 된다(`ChatMessageRow`). 좌측 `중요 채팅`
 * 목록도 그 상태를 그대로 그린다.
 *
 * 첨부는 **보내기 전에 먼저 올라간다.** 서버가 그렇게 나눠 놨는데, 올려만 두고
 * 안 보내면 24시간 뒤 만료된다. 그래서 아직 안 보낸 첨부도 화면에 보여야 한다 —
 * 안 보이면 사용자는 파일이 사라진 줄 안다.
 */
export function ChatComposer({ roomId, onSent, onOpenAgentSettings }) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  // 본문이 비어도 첨부만 있으면 보낼 수 있다. 서버 규칙이 그렇다 —
  // 둘 다 비었을 때만 거절한다.
  const canSend = Boolean(roomId) && !busy && (text.trim().length > 0 || attachments.length > 0)

  const pickFiles = async (event) => {
    const files = [...(event.target.files ?? [])]
    // 같은 파일을 다시 고를 수 있게 값을 비운다. 안 그러면 두 번째 선택에서
    // `change` 가 안 난다.
    event.target.value = ''
    if (files.length === 0) {
      return
    }

    setBusy(true)
    setError('')
    try {
      for (const file of files) {
        const uploaded = await uploadAttachment(roomId, file)
        setAttachments((current) => [...current, uploaded])
      }
    } catch (err) {
      setError(err?.message || '파일을 올리지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const drop = async (attachment) => {
    setAttachments((current) => current.filter((a) => a.id !== attachment.id))
    try {
      await deleteAttachment(attachment.id)
    } catch {
      // 이미 사라진 첨부일 수 있다. 화면에서 뺀 것은 되돌리지 않는다 —
      // 사용자가 지우겠다고 한 것을 서버 사정으로 되살리면 더 혼란스럽다.
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSend) {
      return
    }

    setBusy(true)
    setError('')
    try {
      // 중복 전송은 도메인 키로 막는다. `Idempotency-Key` 는 계약에만 있고
      // 아직 동작하지 않는다.
      const sent = await sendMessage(roomId, {
        body: text.trim(),
        clientMessageId: crypto.randomUUID(),
        attachmentIds: attachments.map((a) => a.id),
      })
      onSent(sent)
      setText('')
      setAttachments([])
    } catch (err) {
      // 입력한 것을 지우지 않는다. 지우면 다시 칠 수밖에 없다.
      setError(err?.message || '보내지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-composer-wrap">
      {error ? <p className="chat-send-error" role="alert">{error}</p> : null}

      {attachments.length > 0 ? (
        <ul className="composer-attachments">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <span>{attachment.name}</span>
              <em>{readableSize(attachment.size_bytes)}</em>
              <button type="button" aria-label={`${attachment.name} 빼기`} onClick={() => drop(attachment)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form className={canSend ? 'chat-composer can-send' : 'chat-composer'} onSubmit={submit}>
        <input
          className="composer-file"
          ref={fileRef}
          type="file"
          multiple
          tabIndex={-1}
          aria-hidden="true"
          onChange={pickFiles}
        />
        <button
          type="button"
          aria-label="파일 첨부"
          title="파일 첨부"
          disabled={!roomId || busy}
          onClick={() => fileRef.current?.click()}
        >
          <Icon src={icons.addSmall} />
        </button>
        <button
          type="button"
          aria-label="AI 대리인 설정"
          title="AI 대리인 설정"
          onClick={onOpenAgentSettings}
        >
          <Icon src={icons.filter} />
        </button>
        <input
          aria-label="채팅 입력"
          placeholder="채팅을 입력하세요..."
          value={text}
          disabled={!roomId}
          onChange={(event) => setText(event.target.value)}
        />
        <button className="send" type="submit" aria-label="전송" disabled={!canSend}>
          <Icon src={icons.send} />
        </button>
      </form>
    </div>
  )
}
