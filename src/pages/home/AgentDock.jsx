import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  sendAgentMessage,
} from './home.api.js'

/**
 * 홈 하단의 대리인 대화.
 *
 * 입력창·전송·추가·필터가 전부 핸들러 없는 껍데기였다. 눌러도 아무 일이
 * 없으니 "고장난 화면" 으로 읽힌다.
 *
 * ## 왜 답이 바로 안 오는가를 화면에 드러낸다
 *
 * `POST /me/agent/conversations/{id}/messages` 는 **202** 로 답한다. 서버는
 * 메시지를 적어 두기만 하고 대리인의 답은 워커가 나중에 만든다
 * (`run.status: "RECEIVED"`). 그래서 보통의 채팅처럼 "보냈다 → 곧 답" 이
 * 아니다.
 *
 * 이걸 감추면 사용자는 답이 안 오는 것을 **자기 메시지가 안 갔다**고 읽고
 * 같은 말을 여러 번 보낸다. 그래서 두 가지를 나눠 보여준다.
 *
 *     보냈다          내 말풍선이 목록에 남는다
 *     기다리는 중     대리인 자리에 `답을 준비하고 있습니다` 가 뜬다
 *
 * ## 답을 어떻게 받아 오나
 *
 * 실시간 채널(`/ws`)이 아직 이 대화에 붙어 있지 않다. 그래서 보낸 뒤 잠깐
 * 동안만 목록을 다시 읽어 본다. 계속 도는 폴링을 두지 않는 이유는, 답이
 * 영영 안 올 수도 있는데(워커가 아직 없다) 그 사이 홈이 계속 요청을 쏘면
 * 서버 로그가 이 화면 하나로 덮이기 때문이다. 정해진 횟수만 보고 멈추면서
 * **왜 멈췄는지 화면에 남긴다.**
 */

const icons = {
  add: '/chat-icons/add-round.svg',
  list: '/chat-icons/menu.svg',
  send: '/chat-icons/send-hor.svg',
}

/** 답을 기다리며 다시 읽어 보는 간격과 횟수. */
const POLL_MS = 3000
const POLL_TRIES = 10

/**
 * `inline` 은 회의 화면의 `Bordo 브리핑` 패널 맨 아래에 박아 넣을 때 쓴다.
 *
 * 홈에서는 화면 오른쪽 아래에 떠 있는 알약이지만(`position: fixed`), 브리핑
 * 패널에서는 **떠 있으면 안 된다** — 판을 덮고, 패널 너비가 줄어도 따라
 * 줄지 않는다. 대화·전송·폴링은 똑같으므로 입력창을 하나 더 만들지 않고
 * 자리만 바꾼다.
 */
export function AgentDock({ inline = false }) {
  const [open, setOpen] = useState(false)
  const [showList, setShowList] = useState(false)
  const [conversations, setConversations] = useState([])
  const [conversationId, setConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const streamRef = useRef(null)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  /*
    `+` 로 연 것인지.

    판을 열면 목록을 읽고 **마지막 대화를 자동으로 잇는다**. 그 규칙이
    `+` 에는 반대로 걸린다 — 새 대화를 비워 두고 판을 열면, 곧이어
    도착한 목록이 그 빈자리를 마지막 대화로 도로 채운다. 누른 사람
    입장에서는 `+` 가 그냥 이전 대화를 여는 버튼으로 보인다.

    state 가 아니라 ref 인 이유는 이 값이 화면을 바꾸지 않기 때문이다.
    state 로 두면 값을 세울 때마다 렌더가 한 번씩 더 돈다.
  */
  const wantsNewRef = useRef(false)

  // 열려 있을 때만 목록을 읽는다. 홈에 들어오자마자 부르면 첫 화면 요청이
  // 하나 더 늘어나는데, dock 을 열지 않는 사람이 더 많다.
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const controller = new AbortController()
    let alive = true

    fetchConversations(controller.signal)
      .then((body) => {
        if (!alive) {
          return
        }
        const rows = body?.results ?? []
        setConversations(rows)
        if (wantsNewRef.current) {
          // `+` 가 연 판이다. 여기서 마지막 대화를 이으면 방금 비운
          // 자리가 도로 채워진다.
          wantsNewRef.current = false
          return
        }
        // 마지막으로 하던 대화를 이어서 연다. 매번 새 대화로 시작하면
        // 어제 물어본 것을 다시 찾을 방법이 없다.
        setConversationId((current) => current ?? rows[0]?.id ?? null)
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setError(err?.message || '대화 목록을 불러오지 못했습니다.')
        }
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [open])

  /*
    쓰던 글이 없으면 바깥을 눌렀을 때 도로 접는다.

    입력칸에 초점이 닿기만 해도 펼쳐지는데(`onFocus`), 닫는 길은 `×` 하나뿐
    이었다. 그래서 물어볼 생각 없이 스쳐 지나간 사람에게도 대화 상자가 열린
    채 남는다 — 회의 화면에서는 그만큼 브리핑이 가려진다.

    **쓰던 글이 있으면 접지 않는다.** 접으면서 초안을 감추면 다시 폈을 때
    남아 있는지 확인할 방법이 없어, 사용자는 날아간 것으로 읽고 다시 친다.

    `pointerdown` 으로 바깥을 가리는 이유는 `blur` 로는 **읽으려고 대화
    안을 누른 것**과 나가는 것을 구별할 수 없어서다. 글자는 초점을 받지
    않으므로 `relatedTarget` 이 비고, 읽는 도중에 접힌다.
  */
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const closeIfIdle = (event) => {
      if (draft.trim() || rootRef.current?.contains(event.target)) {
        return
      }
      setOpen(false)
      setShowList(false)
    }

    document.addEventListener('pointerdown', closeIfIdle)
    return () => document.removeEventListener('pointerdown', closeIfIdle)
  }, [draft, open])

  // 고른 대화의 메시지.
  //
  // 여기서 목록을 비우지 않는다. 대화를 바꾸거나 새로 시작하는 자리에서
  // 이미 비우고 있고, effect 안에서 setState 를 부르면 렌더가 한 번 더 돈다.
  useEffect(() => {
    if (!open || !conversationId) {
      return undefined
    }

    const controller = new AbortController()
    let alive = true

    fetchConversationMessages(conversationId, controller.signal)
      .then((body) => {
        if (alive) {
          setMessages(body?.results ?? [])
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setError(err?.message || '대화를 불러오지 못했습니다.')
        }
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [open, conversationId])

  const stopWaiting = useCallback(() => {
    window.clearInterval(streamRef.current)
    streamRef.current = null
  }, [])

  // 화면을 떠날 때 기다리던 것을 멈춘다. 안 멈추면 사라진 컴포넌트가 계속
  // 서버를 부른다.
  useEffect(() => stopWaiting, [stopWaiting])

  /**
   * 답이 왔는지 정해진 횟수만 확인한다.
   *
   * 마지막 메시지가 내 것이 아니게 되면 답이 온 것이다. 개수로 세지 않는
   * 이유는, 대리인이 두 개를 이어서 남기거나 내가 하나 더 보내는 경우
   * 개수만으로는 무엇이 늘었는지 알 수 없기 때문이다.
   */
  const waitForReply = useCallback((id) => {
    stopWaiting()
    let left = POLL_TRIES

    streamRef.current = window.setInterval(async () => {
      left -= 1

      try {
        const body = await fetchConversationMessages(id)
        const rows = body?.results ?? []
        setMessages(rows)

        const last = rows[rows.length - 1]
        if (last && last.role?.toLowerCase() !== 'user') {
          stopWaiting()
          setWaiting(false)
          setNotice('')
          return
        }
      } catch {
        // 한 번 실패해도 답 자체가 없어진 것은 아니다. 남은 횟수로 계속 본다.
      }

      if (left <= 0) {
        stopWaiting()
        setWaiting(false)
        // 실패가 아니다. 아직 안 왔을 뿐이라는 것을 그대로 말한다.
        setNotice('대리인이 아직 답하지 않았습니다. 잠시 뒤 다시 열어 보십시오.')
      }
    }, POLL_MS)
  }, [stopWaiting])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) {
      return
    }

    setSending(true)
    setError('')
    setNotice('')

    try {
      let id = conversationId
      if (!id) {
        // 첫 질문이면 대화부터 만든다. 제목은 서버가 첫 메시지로 잡아 준다.
        const conversation = await createConversation()
        id = conversation.id
        wantsNewRef.current = false
        setConversationId(id)
        setConversations((current) => [conversation, ...current])
      }

      const saved = await sendAgentMessage(id, body)
      setDraft('')
      // 서버가 돌려준 것을 그대로 붙인다. 화면이 만든 임시 메시지를 붙이면
      // 다시 읽을 때 같은 말이 두 번 보인다.
      setMessages((current) => [...current, saved])
      setWaiting(true)
      waitForReply(id)
    } catch (err) {
      setError(err?.message || '보내지 못했습니다.')
    } finally {
      setSending(false)
    }
  }

  /**
   * 새 대화.
   *
   * **판을 여는 것까지가 이 버튼의 일이다.** 접혀 있을 때 눌러도 안쪽
   * 상태만 비우고 판은 그대로여서, 화면에는 아무 일도 일어나지 않았다 —
   * 누른 사람은 고장 난 버튼과 구별할 수 없다. 홈에서 dock 은 기본이
   * 접힌 상태이므로 `+` 를 누르는 거의 모든 경우가 그 상태였다.
   *
   * 여기서 서버에 대화를 미리 만들지는 않는다. 열어 놓고 물어볼 것을
   * 정하지 못한 채 닫는 사람이 더 많은데, 그때마다 빈 대화가 목록에
   * 쌓인다. 대화는 첫 메시지를 보내는 순간 `send()` 가 만든다.
   */
  const startNew = () => {
    stopWaiting()
    setConversationId(null)
    setMessages([])
    setWaiting(false)
    setNotice('')
    setError('')
    setShowList(false)
    wantsNewRef.current = true
    setOpen(true)
    // 새 대화 다음에 할 일은 언제나 묻는 것이다. 초점을 안 옮기면 빈
    // 판만 뜨고 커서는 그대로라, 어디에 쳐야 하는지 다시 찾아야 한다.
    inputRef.current?.focus()
  }

  const pick = (id) => {
    stopWaiting()
    // 새 대화의 메시지가 도착하기 전까지 이전 대화가 남아 있으면, 잠깐이지만
    // **다른 대화 내용이 이 대화인 것처럼** 보인다.
    setMessages([])
    wantsNewRef.current = false
    setConversationId(id)
    setWaiting(false)
    setNotice('')
    setShowList(false)
  }

  return (
    <div
      className={['chat-dock', inline ? 'is-inline' : '', open ? 'is-open' : ''].filter(Boolean).join(' ')}
      ref={rootRef}
      role="group"
      aria-label="Bordo 채팅"
    >
      {open ? (
        <div className="dock-panel">
          <div className="dock-panel-head">
            <strong>{showList ? '대화 목록' : 'Bordo 에게 물어보기'}</strong>
            <button
              className="dock-close"
              type="button"
              aria-label="접기"
              data-tip="접기"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>

          {showList ? (
            <div className="dock-list">
              {conversations.length === 0 ? (
                <p className="dock-empty">아직 나눈 대화가 없습니다.</p>
              ) : conversations.map((conversation) => (
                <button
                  className={conversation.id === conversationId ? 'dock-list-row on' : 'dock-list-row'}
                  key={conversation.id}
                  type="button"
                  onClick={() => pick(conversation.id)}
                >
                  <strong>{conversation.title}</strong>
                  <span>{conversation.last_message_preview || '아직 주고받은 말이 없습니다.'}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dock-thread">
              {messages.length === 0 && !waiting ? (
                <p className="dock-empty">
                  자리를 비운 사이에 무슨 일이 있었는지 물어보십시오.
                </p>
              ) : null}

              {messages.map((message) => (
                <p
                  className={message.role?.toLowerCase() === 'user' ? 'dock-line mine' : 'dock-line'}
                  key={message.id}
                >
                  {message.body}
                </p>
              ))}

              {/* 큐에 들어갔다는 것을 자리로 보여준다. 답이 늦는 이유가
                  화면 밖에 있으면 사용자는 자기 메시지를 의심한다. */}
              {waiting ? (
                <p className="dock-line dock-waiting" role="status" aria-live="polite">
                  대리인이 답을 준비하고 있습니다…
                </p>
              ) : null}

              {notice ? <p className="dock-notice">{notice}</p> : null}
              {error ? <p className="dock-error" role="alert">{error}</p> : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="dock-bar">
        <div className="chat-tools">
          <button type="button" aria-label="새 대화" data-tip="새 대화" onClick={startNew}>
            <img src={icons.add} alt="" />
          </button>
          <button
            type="button"
            aria-label="대화 목록"
            data-tip="대화 목록"
            aria-expanded={open && showList}
            onClick={() => {
              setOpen(true)
              setShowList((current) => !(open && current))
            }}
          >
            <img src={icons.list} alt="" />
          </button>
        </div>

        <input
          className="chat-input"
          ref={inputRef}
          type="text"
          value={draft}
          aria-label="Bordo에게 물어보기"
          placeholder="Bordo에게 물어보세요..."
          disabled={sending}
          onFocus={() => { setOpen(true); setShowList(false) }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // 줄바꿈이 필요한 입력이 아니다. Enter 로 보내고 조합 중인
            // 한글은 건드리지 않는다 — `isComposing` 을 안 보면 받침을
            // 치는 도중에 메시지가 나간다.
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              send()
            }
          }}
        />

        <button
          className="chat-send"
          type="button"
          aria-label="전송"
          disabled={sending || !draft.trim()}
          onClick={send}
        >
          <img src={icons.send} alt="" />
        </button>
      </div>
    </div>
  )
}
