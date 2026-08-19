import { useEffect, useMemo, useRef, useState } from 'react'

import { icons } from './chat.icons.js'
import { ChatComposer } from './ChatComposer.jsx'
import { ChatDateCalendar } from './ChatDateCalendar.jsx'
import { ChatMessageRow } from './ChatMessageRow.jsx'
import { ChatRoomSearch } from './ChatRoomSearch.jsx'
import { fetchDailySummary, fetchMessages, fetchRoom, toPreview } from './chat.data.js'
import { localDate, localMonth, withDayDividers } from './chat.format.js'
import { Icon, IconButton } from './chat.ui.jsx'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

/** 날짜 구분선. 누르면 그 달의 달력을 연다. */
function DayDivider({ row, onOpenCalendar }) {
  return (
    <button
      className="date-divider"
      type="button"
      data-tip={`${row.label} · 다른 날짜로 이동`}
      onClick={() => onOpenCalendar(row.date)}
    >
      {row.label}
      <Icon src={icons.expandRight} />
    </button>
  )
}

/**
 * 그 날 대화 한 줄 요약.
 *
 * 날짜로 뛰었을 때만 보인다. "이 날 무슨 이야기가 오갔지"가 이 제품의 질문
 * 자체라서, 과거 날짜를 열었을 때 요약이 있으면 50건을 읽지 않아도 된다.
 *
 * `status` 를 서버가 따로 주는 이유가 있다. **`요약 준비 중` 과 `요약할 게
 * 없음` 은 다르다.** 둘 다 빈 화면으로 두면 사용자는 기능이 고장 났다고 본다.
 */
function DailySummary({ roomId, date }) {
  const { data, error, loading } = useResource(
    (signal) => fetchDailySummary(roomId, date, signal),
    [roomId, date],
  )

  if (loading && !data) {
    return null
  }
  if (error || !data) {
    // 요약은 곁다리다. 못 읽었다고 대화 위에 오류를 띄우면 대화가 안 열린
    // 것처럼 보인다.
    return null
  }

  return (
    <div className="daily-summary">
      <strong>{`${date} 요약`}</strong>
      {data.status === 'READY' && data.one_line ? (
        <p>{data.one_line}</p>
      ) : (
        <p className="pending">
          {data.message_count > 0
            ? '이 날의 요약은 아직 만들어지지 않았습니다.'
            : '이 날에는 요약할 대화가 없습니다.'}
        </p>
      )}
      {data.my_todos?.length ? (
        <ul>
          {data.my_todos.map((todo, index) => (
            <li key={`${todo}-${index}`}>{todo}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function ChatRoom({
  room,
  roomId,
  fullscreen,
  onClose,
  onImportantChanged,
  onOpenSettings,
  onToggleFullscreen,
}) {
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
  // 달력에서 고른 날. 서버는 `date` 와 `before` 를 함께 못 받는다 — 날짜로 뛰는
  // 것과 위로 이어 보는 것은 기준점이 다르다.
  const [jumpDate, setJumpDate] = useState(null)
  const [calendarMonth, setCalendarMonth] = useState(null)
  // 검색 결과에서 찾아온 메시지. 그 자리로 스크롤하고 표시를 남긴다.
  const [focusMessageId, setFocusMessageId] = useState(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [olderError, setOlderError] = useState('')

  const { data, error, loading, reload, setData } = useResource(
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
    // `roomTool` 이 의존성에 있는 것은 검색을 열면 대화 목록이 아예 사라지기
    // 때문이다. 닫고 돌아오면 새 요소라 스크롤이 0 에서 시작한다.
  }, [lastMessageId, jumpDate, roomTool])

  /*
    검색 결과에서 찾아온 줄로 옮긴다.

    위 효과보다 **뒤에** 있어야 한다. 날짜로 뛰면 위 효과가 맨 위로 올리는데,
    찾아온 줄이 그날 한가운데 있으면 사용자는 왜 이 화면인지 알 수 없다.
    효과는 선언된 순서로 도니, 여기서 덮는다.
  */
  useEffect(() => {
    if (!focusMessageId) {
      return
    }
    const target = scrollRef.current?.querySelector(`[data-message-id="${focusMessageId}"]`)
    target?.scrollIntoView({ block: 'center' })
  }, [focusMessageId, lastMessageId])

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

  /**
   * 서버가 돌려준 메시지로 그 줄만 갈아 끼운다.
   *
   * 목록 전체를 다시 읽지 않는 이유 — 위로 이어 붙인 페이지가 통째로 날아가고,
   * 사용자는 중요 표시 하나 눌렀는데 읽던 자리를 잃는다.
   *
   * 다만 **중요 표시는 이 줄 안에서 끝나지 않는다.** 좌측 `중요 채팅` 목록과
   * 사이드바 `!` 뱃지가 같은 값을 그린다. 대화창은 지금 어떤 목록이 열려 있는지
   * 모르므로 그쪽은 `onImportantChanged` 로 위(`ChatPage`)에 맡긴다.
   */
  const replaceMessage = (updated) => {
    setData((current) => ({
      ...(current ?? {}),
      results: (current?.results ?? []).map((m) => (m.id === updated.id ? updated : m)),
    }))
  }

  const toggleRoomTool = (nextTool) => {
    setRoomTool((current) => (current === nextTool ? '' : nextTool))
  }

  const appendSent = (sent) => {
    // 날짜로 뛰어 과거를 보던 중이면 최근으로 돌아온다. 안 그러면 방금 보낸
    // 말이 화면 어디에도 없다.
    setJumpDate(null)
    setData((current) => ({
      ...(current ?? { results: [] }),
      results: [...(current?.results ?? []), sent],
    }))
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
          <IconButton
            label="검색"
            active={roomTool === 'search'}
            disabled={!roomId}
            onClick={() => toggleRoomTool('search')}
          >
            <Icon src={icons.search} />
          </IconButton>
          {/* 전체 화면은 목록을 접는 것이다. 예전에는 버튼 색만 바뀌고
              화면은 그대로였다. */}
          <IconButton label={fullscreen ? '전체 화면 끄기' : '전체 화면'} active={fullscreen} onClick={onToggleFullscreen}>
            <Icon src={icons.fullscreen} />
          </IconButton>
          <div className="room-menu-wrap">
            <IconButton
              label="메뉴"
              active={roomTool === 'menu'}
              disabled={!roomId}
              onClick={() => toggleRoomTool('menu')}
            >
              <Icon src={icons.menu} />
            </IconButton>
            {roomTool === 'menu' ? (
              <div className="room-menu">
                <button type="button" onClick={() => { setRoomTool(''); onOpenSettings() }}>
                  채팅 설정
                </button>
                <button
                  type="button"
                  onClick={() => { setRoomTool(''); setCalendarMonth(jumpDate ?? localDate(new Date())) }}
                >
                  날짜로 이동
                </button>
                <button type="button" onClick={() => { setRoomTool(''); reload() }}>
                  대화 새로 읽기
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* 검색 중에는 대화 목록을 대신 차지한다. 둘을 위아래로 나누면 결과도
          대화도 반씩 잘려 어느 쪽도 읽을 수 없다. */}
      {roomTool === 'search' && roomId ? (
        <ChatRoomSearch
          roomId={roomId}
          onClose={() => setRoomTool('')}
          onPick={(date, messageId) => {
            setJumpDate(date)
            setFocusMessageId(messageId)
            setRoomTool('')
          }}
        />
      ) : null}

      {roomTool !== 'search' && jumpDate ? (
        <div className="chat-jump-banner" role="status">
          <span>{`${jumpDate} 의 대화를 보고 있습니다.`}</span>
          <button
            type="button"
            onClick={() => {
              setJumpDate(null)
              setFocusMessageId(null)
            }}
          >
            최근 대화로
          </button>
        </div>
      ) : null}

      {roomTool !== 'search' && jumpDate && roomId ? (
        <DailySummary date={jumpDate} roomId={roomId} />
      ) : null}

      {roomTool === 'search' ? null : (
      <div className="chat-message-scroll" ref={scrollRef}>
        {!roomId ? (
          <Empty>왼쪽에서 대화를 고르십시오.</Empty>
        ) : loading && !data ? (
          <Loading label="대화를 불러오는 중입니다…" />
        ) : error && !data ? (
          <LoadError error={error} onRetry={reload} />
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
            {rows.map((row) => (row.kind === 'day' ? (
              <DayDivider key={row.id} row={row} onOpenCalendar={setCalendarMonth} />
            ) : (
              <ChatMessageRow
                focused={row.message.id === focusMessageId}
                key={row.id}
                message={row.message}
                onChanged={replaceMessage}
                onImportantChanged={onImportantChanged}
              />
            )))}
          </>
        )}
      </div>
      )}

      <ChatComposer roomId={roomId} onSent={appendSent} />

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
