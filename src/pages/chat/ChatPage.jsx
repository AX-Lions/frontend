import { useEffect, useMemo, useState } from 'react'
import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'
import { useSearchParam } from '../../app/navigation.js'
import { fetchMe } from '../account/account.data.js'

import './chat.css'
import { AgentSettingsPanel } from './AgentSettingsPanel.jsx'
import { ChatListPanel } from './ChatListPanel.jsx'
import { ChatRoom } from './ChatRoom.jsx'
import { ChatSettingsPanel } from './ChatSettingsPanel.jsx'
import {
  clearRoomUnread,
  fetchAwayHandled,
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
  // `개인 설정` 화면과 같은 캐시 키를 써서 이미 그쪽이 받아 둔 값이 있으면
  // 다시 요청하지 않는다. 레일 하단 프로필(`GlobalSidebar`)이 홈 사이드바와
  // 같은 사람을 그리려면 이름·아바타가 필요하다.
  const me = useResource((signal) => fetchMe(signal), [], { cacheKey: 'me' })
  const sidebarUser = { name: me.data?.name, avatarUrl: me.data?.avatar_url }

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

  const openRoom = useMemo(() => {
    const all = [
      toPreview(sidebar.data?.my_agent_room),
      ...toDirectRows(sidebar.data),
      ...toTeamRows(sidebar.data).flatMap((t) => t.projects.flatMap((p) => p.rooms)),
    ].filter(Boolean)
    return all.find((room) => room.id === selectedChatId) ?? null
  }, [sidebar.data, selectedChatId])

  const { setData: setSidebarData, reload: reloadSidebar } = sidebar

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

  if (sidebar.loading && !sidebar.data) {
    return (
      <div className="chat-page">
        <GlobalSidebar active="chat" user={sidebarUser} />
        <Loading label="채팅 목록을 불러오는 중입니다…" />
      </div>
    )
  }

  if (sidebar.error && !sidebar.data) {
    return (
      <div className="chat-page">
        <GlobalSidebar active="chat" user={sidebarUser} />
        <LoadError error={sidebar.error} onRetry={sidebar.reload} />
      </div>
    )
  }

  return (
    <div className={fullscreen ? 'chat-page fullscreen' : 'chat-page'}>
      <GlobalSidebar active="chat" user={sidebarUser} />
      {/*
        대리인 설정은 **왼쪽 칸만** 바꾼다. 예전에는 이 자리 전체를 별도
        화면(`BordoSettingsPage`)으로 통째로 덮어서, 열려 있던 대화창이
        사라지고 자리에 "Bordo" 글자만 남았다 — 채팅 설정(`room-settings`)이
        오른쪽만 바꾸는 것과 결이 달랐다. 대화를 보면서 대리인 성격을
        조정하고 싶을 때 대화가 사라지면 무엇을 기준으로 조정하는지
        놓친다. 전체 화면일 때도 대리인 설정은 봐야 하므로 `fullscreen`
        보다 우선한다.
      */}
      {view === 'agent' ? (
        <AgentSettingsPanel onBack={() => setView('chat')} />
      ) : fullscreen ? null : (
        <ChatListPanel
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
        />
      )}
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
