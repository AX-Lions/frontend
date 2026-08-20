import { useEffect, useMemo, useRef, useState } from 'react'

import { icons } from './chat.icons.js'
import { ChatComposer } from './ChatComposer.jsx'
import { ChatDateCalendar } from './ChatDateCalendar.jsx'
import { ChatMessageRow } from './ChatMessageRow.jsx'
import { ChatRoomSearch } from './ChatRoomSearch.jsx'
import { fetchDailySummary, fetchMessages, fetchRoom, toPreview } from './chat.data.js'
import {
  inOtherZone, isAwakeHour, localDate, localMonth, withDayDividers, zoneTime,
} from './chat.format.js'
import { Icon, IconButton } from './chat.ui.jsx'
import { useMinuteTick } from '../../lib/minuteClock.js'
import { RECONNECTED, useProjectEvents } from '../../lib/projectEvents.js'
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

/**
 * 방 머리의 참여자 줄.
 *
 * ## 왜 방 머리인가
 *
 * 이 서비스가 답하는 질문이 "내가 없는 동안 무슨 일이 있었지" 인데, 그 반대편
 * 질문이 **"지금 이 사람한테 말을 걸어도 되나"** 다. 상대가 새벽 3시거나 자리를
 * 비웠으면 답을 기다릴 것이 아니라 대리인에게 맡길 일이고, 그 판단은 말을 걸기
 * **전에** 서야 한다. 그래서 입력칸이 아니라 방 머리에 둔다.
 *
 * ## 할 말이 있는 사람만 나온다
 *
 * 처음에는 참여자 전원의 시각을 늘어놓았다. 팀이 대부분 같은 시간대라
 * **같은 숫자가 다섯 번 반복되고**, 정작 다른 나라에 있는 한 사람이 그 줄에
 * 묻혔다. 지금은 둘 중 하나에 걸리는 사람만 남긴다.
 *
 *     나와 시간대가 다르다   나라와 그곳 시각을 적는다
 *     자리를 비웠다          그 사람의 Bordo 가 받는 중이라고 적는다
 *
 * 같은 시간대에 자리도 지키는 사람은 아무 말도 할 것이 없다 — 내 시계가 곧
 * 그 사람 시계이고, 보내면 본인이 받는다.
 *
 * ## 1:1 에서는 나를 뺀다
 *
 * 내 시각은 내 시계에 이미 있고, 두 칸 중 한 칸이 늘 나 자신이면 줄이 낭비된다.
 */
function MemberClocks({ members, type }) {
  /*
    1 분마다 다시 그린다. 방에 오래 머무는 화면이라, 안 고치면 열었을 때의
    시각이 그대로 굳어 **틀린 시각을 근거로 판단하게 된다.**

    `setInterval(…, 60_000)` 을 직접 걸지 않는다 — 분 경계와 어긋나고, 탭이
    뒤로 가면 멈추고, 시계가 여럿이면 각자 다른 초에 바뀐다. 셋 다 왜 문제인지는
    `lib/minuteClock.js` 에 적어 뒀다.
  */
  const now = new Date(useMinuteTick())

  const direct = type === 'DIRECT' || type === 'PEER_AGENT'
  const shown = (members ?? [])
    .filter((member) => !member.is_me)
    .map((member) => ({
      ...member,
      clock: zoneTime(member.timezone, now),
      awake: isAwakeHour(member.timezone, now),
      elsewhere: inOtherZone(member.timezone),
      away: member.presence === 'AWAY',
    }))
    // 1:1 은 상대 한 사람뿐이라 늘 보여준다 — 그 사람이 곧 이 방이다.
    // 단체방은 말할 것이 있는 사람만 남긴다.
    .filter((member) => direct || member.away || (member.elsewhere && member.clock))

  if (shown.length === 0) {
    return null
  }

  return (
    <div className="member-clocks" aria-label="참여자 상태">
      {shown.map((member) => (
        <span
          className={[
            'member-clock',
            member.away ? 'is-away' : '',
            member.awake ? '' : 'is-resting',
          ].filter(Boolean).join(' ')}
          key={member.id}
          data-tip={member.away
            ? `${member.name}님은 자리를 비웠습니다 · ${member.agent_name}가 받는 중`
            : `${member.name} · ${member.timezone}${member.awake ? '' : ' · 쉬는 시간대'}`}
        >
          <i aria-hidden="true" />
          <b>{member.name}</b>
          {/*
            나라는 **나와 시간대가 다를 때만** 적는다. 같은 나라 사람 옆에
            `대한민국` 이 붙어 있으면 그 글자가 줄의 절반을 먹으면서 아무것도
            알려 주지 않는다.
          */}
          {member.elsewhere && member.clock ? (
            <span className="member-where">{member.country}</span>
          ) : null}
          {/*
            시각은 시간대가 다르거나, 1:1 이면 적는다.

            1:1 에서 같은 시간대라도 남기는 이유 — 그 칸이 비면 알약에 이름만
            남아 방 제목을 한 번 더 쓴 꼴이 된다. 상대가 지금 몇 시인지가
            이 방에서 유일하게 새로운 사실이다.
          */}
          {(member.elsewhere || direct) && member.clock ? <time>{member.clock}</time> : null}
          {/* 자리를 비웠으면 누가 대신 받는지까지 적는다. `자리 비움` 만으로는
              말을 걸지 말라는 뜻인지, 걸어도 되는지 알 수 없다. */}
          {member.away ? <span className="member-away-by">{member.agent_name} 응답 중</span> : null}
        </span>
      ))}
    </div>
  )
}

export function ChatRoom({
  room,
  roomId,
  fullscreen,
  presence,
  onClose,
  onImportantChanged,
  onOpenAgentSettings,
  onOpenSettings,
  onPresenceChange,
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
  const roomMenuRef = useRef(null)
  /*
    `메뉴`(햄버거) 드롭다운은 바깥을 눌러도 닫혀야 한다.

    전에는 같은 단추를 다시 누르거나 안의 항목 셋 중 하나를 눌러야만 닫혔다
    — 판 옆이나 대화창 아무 데나 눌러서는 안 닫혀 계속 떠 있었다.
    `FlowBoardPage.jsx` 의 회의 목록 드롭다운과 같은 사정으로 **캡처
    단계**에서 듣는다 — 그쪽에 적어 둔 이유(넓은 화살표 히트 영역의
    `stopPropagation()`)는 여기 없지만, 다른 곳에서 같은 문제가 생기지
    않도록 처음부터 같은 방식으로 맞춘다.
  */
  useEffect(() => {
    if (roomTool !== 'menu') {
      return undefined
    }
    const close = (event) => {
      if (!roomMenuRef.current?.contains(event.target)) {
        setRoomTool('')
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setRoomTool('')
      }
    }
    document.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [roomTool])
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

  /*
    상대가 보낸 말이 새로고침 없이 온다.

    ## 온 것을 그리지 않고, 온 김에 다시 읽는다

    이벤트에는 `message_id` 만 있고 본문이 없다. 그대로 그리면 **권한 검사를
    안 거친 것이 화면에 뜬다** — 소켓은 방 단위가 아니라 프로젝트 단위라, 내가
    안 들어간 방의 말도 같은 채널로 흘러온다. 그래서 신호만 받고 목록은
    `fetchMessages` 로 다시 읽는다. 서버가 보여 줄 것만 보여 준다.

    ## 내가 보낸 것은 흘려보낸다

    보낸 직후 서버가 돌려준 것을 이미 목록에 얹었다(`appendSent`). 여기서 또
    다시 읽으면 같은 말을 두 번 그리거나 화면이 한 번 깜빡인다. 내가 누구인지는
    서버가 방 참여자에 표시해 준다(`members[].is_me`) — 그 값이 없으면 거를 수
    없을 뿐, 다시 읽는 것 자체는 안전하므로 그냥 읽는다.

    ## 다시 붙었으면 통째로 다시 읽는다

    끊겨 있던 동안 지나간 이벤트는 다시 오지 않는다. 이걸 빼면 잠깐 끊긴 뒤로
    **조용히 낡은 화면**을 보게 된다 — 화면은 멀쩡해 보이는데 대화만 멈춰 있는,
    사용자가 알아차릴 수 없는 종류의 고장이다.
  */
  const myMemberId = (header?.members ?? []).find((member) => member.is_me)?.id ?? null
  useProjectEvents(header?.projectId, (event) => {
    if (event.event_type === RECONNECTED) {
      reload()
      return
    }
    if (event.event_type !== 'chat.message.created') {
      // `agent.question.answered` 도 같은 채널로 온다. 이번 범위가 아니다.
      return
    }

    const payload = event.payload ?? {}
    // 프로젝트 채널에는 그 프로젝트의 **모든 방**이 흐른다. 지금 보고 있는
    // 방이 아니면 이 화면이 할 일은 없다(사이드바 뱃지는 별개 범위).
    if (String(payload.room_id) !== String(roomId)) {
      return
    }
    if (myMemberId && String(payload.sender_id) === String(myMemberId)) {
      return
    }
    reload()
  })

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
        <button className="back-button" type="button" aria-label="뒤로가기" data-tip="뒤로가기" onClick={onClose}>
          <Icon src={icons.expandLeft} />
        </button>
        <div className="chat-room-title">
          <strong>{header?.name ?? ''}</strong>
          <span>{header?.context ?? ''}</span>
          <MemberClocks members={header?.members} type={header?.type} />
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
              화면은 그대로였다.

              켜져 있을 때는 아이콘도 줄이는 쪽으로 바꾼다. 버튼 색만으로는
              지금이 켜진 것인지 이 버튼이 그냥 눌린 것인지 알 수 없어,
              나가는 길을 찾느라 다시 한 번 눌러 보게 된다. */}
          <IconButton label={fullscreen ? '전체 화면 끄기' : '전체 화면'} active={fullscreen} onClick={onToggleFullscreen}>
            <Icon src={fullscreen ? icons.exitFullscreen : icons.fullscreen} />
          </IconButton>
          <div className="room-menu-wrap" ref={roomMenuRef}>
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
                /*
                  **내 Bordo 와 단둘이 있는 방**인가.

                  다른 방에서 내 Bordo 가 한 말은 내가 없는 동안 나 대신 나간
                  말이라 내 쪽(오른쪽)에 앉는다. 그런데 이 방에서는 내 Bordo 가
                  대신 말하는 상대가 아니라 **말을 주고받는 상대 그 자체**다.
                  같은 규칙을 그대로 두면 나와 내 Bordo 의 말이 전부 오른쪽에
                  쌓여, 누가 물었고 누가 답했는지가 사라진다.
                */
                myAgentRoom={header?.type === 'AI'}
                onChanged={replaceMessage}
                onImportantChanged={onImportantChanged}
              />
            )))}
          </>
        )}
      </div>
      )}

      <ChatComposer
        roomId={roomId}
        /*
          자리를 비운 동안은 입력칸 바로 위에서 그 사실을 말한다.

          목록 맨 위의 스위치만으로는 부족하다. 전체 화면으로 보거나 목록을
          접으면 스위치가 화면에서 사라지는데, **말이 오는 자리는 여기**라
          내가 답하지 않아도 되는 이유가 여기 있어야 한다. 돌아오는 단추도
          같이 둔다 — 알아차린 자리에서 바로 풀 수 있어야 목록까지 되짚지 않는다.

          입력칸 컴포넌트 **안으로** 넘긴다. 바깥에 형제로 두면 입력칸이
          `position: absolute` 라 그 밑에 깔려 안 보인다.
        */
        notice={presence === 'AWAY' ? (
          <div className="room-away-note">
            <span>자리 비움 — 오는 말은 Bordo가 먼저 받습니다.</span>
            <button type="button" onClick={() => onPresenceChange?.('ACTIVE')}>
              돌아왔어요
            </button>
          </div>
        ) : null}
        onSent={appendSent}
        onOpenAgentSettings={onOpenAgentSettings}
      />

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
