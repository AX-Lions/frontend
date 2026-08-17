import { useEffect, useMemo, useState } from 'react'
import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'

import './chat.css'
import { AgentSettingsPanel } from './AgentSettingsPanel.jsx'
import { ChatListPanel } from './ChatListPanel.jsx'
import { ChatRoom } from './ChatRoom.jsx'
import { fetchImportant, fetchSidebar, markRead, toPreview, toTeamRows } from './chat.data.js'
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
      ...(sidebar.data?.my_agent_room ? [toPreview(sidebar.data.my_agent_room)] : []),
      ...importantRooms,
      ...toTeamRows(sidebar.data).flatMap((t) => t.projects.flatMap((p) => p.rooms)),
    ]
    return all.find((room) => room.id === selectedChatId) ?? null
  }, [sidebar.data, importantRooms, selectedChatId])

  // 방을 열면 읽음 워터마크를 올린다. 실패해도 대화는 보여야 하므로 삼킨다 —
  // 미읽음 숫자가 잠깐 안 맞는 것이 대화가 안 열리는 것보다 낫다.
  useEffect(() => {
    if (selectedChatId) {
      markRead(selectedChatId).catch(() => {})
    }
  }, [selectedChatId])

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
        onSelectChat={setSelectedChatId}
        onOpenSettings={() => setView('settings')}
      />
      <ChatRoom room={openRoom} roomId={selectedChatId} onClose={() => setSelectedChatId(null)} />
    </div>
  )
}
