import { useEffect, useMemo, useState } from 'react'
import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'

import './chat.css'
import { AgentSettingsPanel } from './AgentSettingsPanel.jsx'
import { ChatListPanel } from './ChatListPanel.jsx'
import { ChatRoom } from './ChatRoom.jsx'
import {
  clearRoomUnread,
  confirmMessageImportant,
  fetchImportant,
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
      <AgentSettingsPanel />
      <main className="settings-brand" aria-label="설정 미리보기">
        <p>Bordo</p>
      </main>
    </div>
  )
}

export function ChatPage() {
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [view, setView] = useState('chat')

  const sidebar = useResource((signal) => fetchSidebar(signal))
  const important = useResource((signal) => fetchImportant(signal))

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
  /**
   * 중요 메시지 확인.
   *
   * 표시를 내리는 것과 다르다. `is_important` 는 남고 **내 확인 기록만** 생겨서
   * 상단 `중요 채팅` 에서만 빠진다. 이 API 를 아무도 안 불러서, 한 번 중요로
   * 찍힌 대화는 그 섹션에 영원히 남아 있었다.
   *
   * 확인하면 사이드바의 `!` 뱃지도 같이 판정이 바뀌므로 둘 다 다시 읽는다.
   */
  const confirmImportant = async (messageId) => {
    await confirmMessageImportant(messageId)
    important.reload()
    sidebar.reload()
  }

  const { setData: setSidebarData, reload: reloadSidebar } = sidebar
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

  if (view === 'settings') {
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
    <div className="chat-page">
      <GlobalSidebar active="chat" />
      <ChatListPanel
        importantRooms={importantRooms}
        selectedChatId={selectedChatId}
        sidebar={sidebar.data}
        onConfirmImportant={confirmImportant}
        onSelectChat={setSelectedChatId}
        onOpenSettings={() => setView('settings')}
      />
      {/*
        `key` 로 방마다 새 인스턴스를 만든다. 대화창은 날짜 이동 · 이어 붙인
        페이지 · 입력 중인 글을 자기 안에 들고 있는데, 방을 옮길 때 이것들이
        남아 있으면 **다른 방에 쓰던 글이 따라온다.** 방마다 `useEffect` 로
        하나씩 되돌리는 것보다 통째로 새로 만드는 쪽이 빠뜨릴 것이 없다.
      */}
      <ChatRoom
        key={selectedChatId ?? 'none'}
        room={openRoom}
        roomId={selectedChatId}
        onClose={() => setSelectedChatId(null)}
      />
    </div>
  )
}
