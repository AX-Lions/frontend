import { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'
import { useSearchParam } from '../../app/navigation.js'

import './chat.css'
import { AgentSettingsPanel } from './AgentSettingsPanel.jsx'
import { ChatListPanel } from './ChatListPanel.jsx'
import { ChatRoom } from './ChatRoom.jsx'
import { ChatSettingsPanel } from './ChatSettingsPanel.jsx'
import {
  clearRoomUnread,
  confirmMessageImportant,
  fetchAwayHandled,
  fetchImportant,
  fetchPresence,
  setPresence,
  fetchSidebar,
  markRead,
  toDirectRows,
  toPreview,
  toTeamRows,
} from './chat.data.js'
import { useResource } from '../../lib/useResource.js'
import { LoadError, Loading } from '../../shared/components/LoadState.jsx'

function BordoSettingsPage({ onBack }) {
  const handleNavigate = (event, item) => {
    if (item.id !== 'chat') {
      return
    }

    event.preventDefault()
    onBack()
  }

  return (
    <div className="settings-page">
      <GlobalSidebar active="chat" onNavigate={handleNavigate} />
      <AgentSettingsPanel onBack={onBack} />
      <main className="settings-brand" aria-label="설정 미리보기">
        <p>Bordo</p>
      </main>
    </div>
  )
}

/**
 * 주소에 실려 온 방.
 *
 * 홈 사이드바의 `Bordo 바로가기` 가 `/chat?room=<id>` 로 보낸다. 이걸 안 읽으면
 * 주소에 방이 있는데도 오른쪽 칸은 `왼쪽에서 대화를 고르십시오.` 로 남아,
 * `/home` 이 `shortcuts.agent_room_id` 를 실어 보내는 이유 자체가 없어진다.
 * 그 링크를 북마크하거나 새 탭으로 연 경우도 마찬가지다.
 */
function roomIdFromUrl() {
  return new URLSearchParams(window.location.search).get('room') || null
}

export function ChatPage() {
  /*
    주소로 들어온 방과 목록에서 고른 방을 **상태 하나로** 다룬다. 주소를 따로
    보고 있으면 두 경로가 갈려, 목록에서 고른 방은 열리는데 주소로 들어온 방만
    안 열리는 지금 같은 일이 또 생긴다.

    **주소를 계속 지켜본다.** 한 번만 읽으면 `?room=5` 가 붙은 채로 왼쪽
    `채팅` 을 눌러 쿼리를 지워도 방이 그대로 열려 있다 — 주소는 방이 없다고
    하는데 화면엔 방이 있고, 그 상태로 새로고침하면 방이 갑자기 닫힌다.
    뒤로 가기도 같은 이유로 먹통이 된다.

    고른 방을 주소에 되쓰지는 않는다. 그건 주소를 화면 상태의 저장소로 쓰는
    일이라 범위가 다르다 — 지금 고치는 것은 **주소가 화면을 못 바꾸는 것**이다.
  */
  const urlRoomId = useSearchParam('room')
  const [pick, setPick] = useState(() => ({ forUrl: roomIdFromUrl(), id: roomIdFromUrl() }))
  // 주소가 바뀌면 목록에서 고른 것은 무효다. 주소가 이긴다.
  const selectedChatId = pick.forUrl === urlRoomId ? pick.id : urlRoomId
  const setSelectedChatId = (id) => setPick({ forUrl: urlRoomId, id })
  // `chat` 대화창 · `room-settings` 채팅 설정 · `agent` 대리인 설정.
  // 앞의 둘은 오른쪽 칸만 바뀌고, 대리인 설정만 화면을 통째로 덮는다.
  const [view, setView] = useState('chat')
  const [notice, setNotice] = useState('')
  /*
    전체 화면 = **채팅 목록만** 접는 것.

    대화창 안에 두면 목록을 접어도 목록이 그대로 남아 아무 일도 안 일어나므로
    여기서 다룬다.

    맨 왼쪽 전역 메뉴는 접지 않는다. 그것까지 걷으면 홈 · 받은 항목 · 일정으로
    가는 길이 통째로 사라져서, 대화를 크게 보려고 누른 버튼이 **화면을 빠져나갈
    수 없는 상태**를 만든다. 접어서 얻는 64px 보다 잃는 것이 크다.
  */
  const [fullscreen, setFullscreen] = useState(false)

  const sidebar = useResource((signal) => fetchSidebar(signal), [], { cacheKey: 'chat-sidebar' })
  const important = useResource((signal) => fetchImportant(signal), [], { cacheKey: 'chat-important' })

  /*
    자리 비움.

    서버 값이라 화면이 혼자 들고 있지 않는다 — 창을 닫는 순간이 곧 자리를
    비우는 순간이라, 브라우저에만 두면 내 Bordo 가 나설 일이 없어진다.

    누르자마자 화면을 먼저 바꾸고(`pending`) 서버에 보낸다. 스위치는 눌린
    티가 즉시 나야 하는 자리다 — 왕복을 기다리면 두 번 누른다.
  */
  const presence = useResource((signal) => fetchPresence(signal), [], { cacheKey: 'presence' })
  const [pendingPresence, setPendingPresence] = useState(null)
  const presenceStatus = pendingPresence ?? presence.data?.status ?? 'ACTIVE'

  const awayHandled = useResource((signal) => fetchAwayHandled(signal), [], { cacheKey: 'chat-away' })

  /**
   * 자리 비움을 바꾼다.
   *
   * ## 스위치가 두 번 튀던 이유
   *
   * 예전에는 `pending` 을 내리는 것과 `presence` 를 **다시 읽는 것**이 따로
   * 놀았다. `pending` 이 사라지는 순간 화면이 보는 값은 아직 안 바뀐 옛
   * 응답이라, 한 번 누르면
   *
   *     자리 비움(pending) → 활동 중(옛 응답) → 자리 비움(새 응답)
   *
   * 이렇게 세 번 그려졌다. 가운데 한 칸이 왕복 시간만큼 떠 있어서, 스위치가
   * 좌우로 튀는 것으로 보인다. 그 사이 버튼이 다시 눌리기까지 해서 두 번
   * 누르면 요청이 엇갈려 상태가 뒤집힌 채로 남았다.
   *
   * 그래서 **서버가 돌려준 값을 그대로 가진 값에 얹는다.** 같은 렌더에서
   * `pending` 이 내려가고 새 상태가 올라오므로 중간 칸이 아예 없다. 확인용
   * 재조회도 없앤다 — `PATCH` 응답이 이미 서버가 정한 값이라, 한 번 더 읽는
   * 것은 튈 자리를 한 칸 더 만드는 일일 뿐이다.
   *
   * 실패하면 `pending` 만 내려가고 가진 값이 그대로 남아 스위치가 원래
   * 자리로 돌아간다 — 서버가 못 받은 것을 받은 것처럼 두지 않는다.
   */
  const changePresence = async (status) => {
    if (status === presenceStatus || pendingPresence) {
      return
    }
    setPendingPresence(status)
    try {
      const updated = await setPresence(status)
      presence.setData((current) => ({ ...(current ?? {}), status: updated?.status ?? status }))
      // 자리 비움을 풀면 그 사이 쌓인 것이 곧바로 목록에 와야 한다.
      awayHandled.reload()
    } catch {
      // 가진 값이 그대로 남는다. 되돌리는 코드가 따로 필요 없다.
    } finally {
      setPendingPresence(null)
    }
  }

  /*
    자리를 비운 사이 Bordo 가 대신 나눈 대화.

    서버가 방 기준으로 이미 묶어서 준다(`handled_count` 포함). 화면이 방마다
    메시지를 받아 세게 두면 목록 하나 그리려고 방 수만큼 요청이 나간다.
  */
  const awayRooms = useMemo(
    () => (awayHandled.data?.results ?? []).map((row) => ({
      id: row.room_id,
      name: row.title,
      context: row.path_label || undefined,
      message: row.last_reply.preview,
      sentAt: row.last_reply.sent_at,
      handledCount: row.handled_count,
      avatars: row.avatar_urls ?? [],
    })),
    [awayHandled.data],
  )

  const importantRooms = useMemo(
    // 중요 채팅은 **메시지 목록**으로 온다. 같은 방의 메시지가 여럿이면 방이
    // 여러 번 나오므로 방 기준으로 합친다. 미리보기는 그 방의 가장 최근 것이다.
    () => {
      const seen = new Map()
      ;(important.data?.results ?? []).forEach((row) => {
        if (!seen.has(row.room.id)) {
          seen.set(row.room.id, {
            ...toPreview(row.room),
            // 확인 버튼이 이 id 를 쓴다. 방이 아니라 **메시지**를 확인하는
            // 것이라, 방만 들고 있으면 여기서 섹션을 비울 수 없다.
            messageId: row.message.id,
            message: `${row.message.sender.name}: ${row.message.body}`,
            sentAt: row.message.sent_at,
            marked: true,
          })
        }
      })
      return [...seen.values()]
    },
    [important.data],
  )

  const openRoom = useMemo(() => {
    const all = [
      toPreview(sidebar.data?.my_agent_room),
      ...importantRooms,
      ...toDirectRows(sidebar.data),
      ...toTeamRows(sidebar.data).flatMap((t) => t.projects.flatMap((p) => p.rooms)),
    ].filter(Boolean)
    return all.find((room) => room.id === selectedChatId) ?? null
  }, [sidebar.data, importantRooms, selectedChatId])

  /**
   * 중요 상태가 바뀌었다 — 같은 값을 그리는 곳을 전부 다시 읽는다.
   *
   * 중요 표시·해제·확인은 **말풍선 한 줄만의 일이 아니다.** 좌측 `중요 채팅`
   * 목록과 사이드바 `!` 뱃지가 같은 서버 상태를 보고 그린다. 대화창에서
   * 바꿨을 때 그 줄만 갈아 끼우면 두 목록은 옛 값으로 남아, **말풍선의
   * `확인` 을 눌러도 목록에서는 안 사라진다.** 같은 버튼이 두 군데인데
   * 한쪽만 동작하니 사용자는 계속 누른다.
   *
   * 낙관적으로 미리 지우지 않는 이유 — 무엇이 목록에서 빠지는지는 서버 규칙이다.
   * `is_important` 를 내리면 확인 기록까지 지워지고, 같은 방에 중요 메시지가
   * 더 있으면 그 방은 목록에 남는다. 화면이 그 규칙을 흉내 내면 두 곳이 갈린다.
   * 요청 두 번은 감수한다 — 좌측 `확인` 도 원래 이 둘을 다시 읽는다.
   */
  const { reload: reloadImportant } = important
  const { setData: setSidebarData, reload: reloadSidebar } = sidebar
  const refreshImportant = useCallback(() => {
    reloadImportant()
    reloadSidebar()
  }, [reloadImportant, reloadSidebar])

  /*
    방을 열면 읽음 워터마크를 올린다.

    예전에는 `markRead` 만 부르고 끝이었다. 서버에서는 읽힌 것이 맞는데 **사이드바
    뱃지가 그대로 남아** 있어서, 사용자는 방을 열었다 닫아도 안 읽힌 것으로 보였다.

    두 단계로 맞춘다. 먼저 트리에서 그 방 몫을 빼서 뱃지를 즉시 끄고, 이어서
    사이드바를 다시 읽어 서버 값으로 덮는다.

    뺄셈만으로는 부족하다 — 팀 단체방은 사이드바가 방 객체 없이 id 만 주므로
    트리에서 찾을 수가 없다. 다시 읽기만 해도 안 된다 — 왕복이 끝날 때까지
    뱃지가 남아 있어 방을 옮길 때마다 한 박자씩 늦게 꺼진다.

    실패는 삼킨다. 미읽음 숫자가 잠깐 안 맞는 것이 대화가 안 열리는 것보다 낫다.
  */
  useEffect(() => {
    if (!selectedChatId) {
      return undefined
    }

    let alive = true
    markRead(selectedChatId)
      .then(() => {
        if (!alive) {
          return
        }
        setSidebarData((current) => clearRoomUnread(current, selectedChatId))
        reloadSidebar()
      })
      .catch(() => {})

    return () => {
      alive = false
    }
  }, [selectedChatId, setSidebarData, reloadSidebar])

  /**
   * 방을 열면 그 방의 중요 메시지도 같이 확인된다.
   *
   * `확인` 버튼을 따로 두지 않는다 — 방을 열어 읽은 것 자체가 확인이다.
   * 표시를 내리는 것과는 다르다. `is_important` 는 남고 **내 확인 기록만**
   * 생겨서 상단 `중요 채팅` 에서만 빠진다(같은 메시지가 다른 사람 화면에는
   * 그대로 남는다).
   *
   * `importantRooms` 는 방 하나당 **가장 최근의 미확인 중요 메시지 하나**만
   * 대표로 들고 있다(위 주석 참고). 그 메시지를 확인하면 방이 목록에서
   * 빠지고 `importantRooms` 가 다시 계산되므로, 새로 들어온 중요 메시지가
   * 있으면 이 effect 가 다시 돈다 — 방을 계속 보고 있는 동안 온 것도 놓치지
   * 않는다.
   */
  useEffect(() => {
    const room = importantRooms.find((r) => r.id === selectedChatId)
    if (!room) {
      return undefined
    }

    let alive = true
    confirmMessageImportant(room.messageId)
      .then(() => {
        if (alive) {
          refreshImportant()
        }
      })
      .catch(() => {})

    return () => {
      alive = false
    }
  }, [selectedChatId, importantRooms, refreshImportant])

  // 대리인 설정만 화면을 통째로 덮는다. 채팅 설정은 오른쪽 칸만 바뀐다 —
  // 어느 대화의 설정을 보고 있는지는 왼쪽 목록에서 눈으로 확인해야 한다.
  if (view === 'agent') {
    return <BordoSettingsPage onBack={() => setView('chat')} />
  }

  if (sidebar.loading && !sidebar.data) {
    return (
      <div className="chat-page">
        <GlobalSidebar active="chat" />
        <Loading label="채팅 목록을 불러오는 중입니다…" />
      </div>
    )
  }

  if (sidebar.error && !sidebar.data) {
    return (
      <div className="chat-page">
        <GlobalSidebar active="chat" />
        <LoadError error={sidebar.error} onRetry={sidebar.reload} />
      </div>
    )
  }

  return (
    <div className={fullscreen ? 'chat-page fullscreen' : 'chat-page'}>
      <GlobalSidebar active="chat" />
      {fullscreen ? null : <ChatListPanel
        awayRooms={awayRooms}
        presence={presenceStatus}
        presenceBusy={Boolean(pendingPresence)}
        selectedChatId={selectedChatId}
        sidebar={sidebar.data}
        onPresenceChange={changePresence}
        onCreatedRoom={(room) => {
          // 만들자마자 연다. 목록에 새 줄이 생기기만 하면 사용자는 어느 것이
          // 방금 만든 것인지 찾아야 한다.
          setSelectedChatId(room.id)
          sidebar.reload()
        }}
        onSelectChat={(id) => {
          setSelectedChatId(id)
          // 설정을 보다가 다른 대화를 고르면 그 대화를 연다. 설정 화면에
          // 머물면 방금 고른 대화가 어디로 갔는지 알 수 없다.
          setView('chat')
        }}
        onOpenAgentSettings={() => setView('agent')}
        onOpenChatSettings={() => setView('room-settings')}
      />}
      {view === 'room-settings' ? (
        <ChatSettingsPanel
          room={openRoom}
          roomId={selectedChatId}
          onClose={() => setView('chat')}
          onLeft={(message) => {
            // 나간 방을 열어 둘 수 없다. 목록에서도 빠지므로 대화 선택을 지운다.
            setSelectedChatId(null)
            setView('chat')
            setNotice(message)
            sidebar.reload()
          }}
          onRenamed={() => {
            setView('chat')
            sidebar.reload()
          }}
        />
      ) : (
        /*
          `key` 로 방마다 새 인스턴스를 만든다. 대화창은 날짜 이동 · 이어 붙인
          페이지 · 입력 중인 글을 자기 안에 들고 있는데, 방을 옮길 때 이것들이
          남아 있으면 **다른 방에 쓰던 글이 따라온다.** 방마다 `useEffect` 로
          하나씩 되돌리는 것보다 통째로 새로 만드는 쪽이 빠뜨릴 것이 없다.
        */
        <ChatRoom
          key={selectedChatId ?? 'none'}
          fullscreen={fullscreen}
          room={openRoom}
          roomId={selectedChatId}
          presence={presenceStatus}
          onClose={() => setSelectedChatId(null)}
          onPresenceChange={changePresence}
          onImportantChanged={refreshImportant}
          onOpenAgentSettings={() => setView('agent')}
          onOpenSettings={() => setView('room-settings')}
          onToggleFullscreen={() => setFullscreen((on) => !on)}
        />
      )}

      {/* 나간 결과처럼 화면이 사라진 뒤에야 알 수 있는 것을 알린다. 아무 말도
          없으면 사용자는 대화가 왜 없어졌는지 모른다. */}
      {notice ? (
        <p className="chat-page-notice" role="status" aria-live="polite">
          {notice}
          <button type="button" aria-label="닫기" onClick={() => setNotice('')}>×</button>
        </p>
      ) : null}
    </div>
  )
}
