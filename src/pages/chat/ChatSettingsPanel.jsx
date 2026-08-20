import { useState } from 'react'

import { icons } from './chat.icons.js'
import { fetchRoom, leaveRoom, muteRoom, renameRoom, toPreview } from './chat.data.js'
import { Icon } from './chat.ui.jsx'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'

const TYPE_LABEL = {
  AI: '나의 AI 대리인',
  PEER_AGENT: '동료의 AI 대리인',
  DIRECT: '1:1 대화',
  TEAM: '팀 단체방',
  PROJECT: '프로젝트 단체방',
}

const LEAVE_RESULT = {
  HIDDEN: '내 목록에서 숨겼습니다. 상대가 다시 말을 걸면 같은 대화가 그대로 돌아옵니다.',
  LEFT: '이 대화에서 나왔습니다. 다시 초대받기 전까지 이후 대화는 보이지 않습니다.',
}

/**
 * 채팅 설정.
 *
 * 고치기 전에는 상단 톱니(채팅 설정)와 반짝이(AI 대리인 설정)가 **같은 화면**을
 * 열었다. 채팅 설정이라는 화면이 아예 없었다.
 *
 * 여기 있는 것은 전부 **백엔드에 실제로 있는 것**뿐이다 — 이름 변경
 * (`PATCH /chat/rooms/{id}`), 알림 끄기·켜기(`PATCH .../mute`), 나가기
 * (`DELETE`). 서버에 없는 것은 **자리를 비우지 않고 없다고 적는다.** 스위치를
 * 그려 놓고 아무 데도 안 보내면, 사용자는 껐다고 믿고 알림을 계속 받는다.
 */
export function ChatSettingsPanel({ room, roomId, onClose, onRenamed, onLeft }) {
  const hasListRow = Boolean(room)
  const detail = useResource(
    (signal) => (roomId && !hasListRow ? fetchRoom(roomId, signal) : Promise.resolve(null)),
    [roomId, hasListRow],
  )
  const current = room ?? toPreview(detail.data)

  const [title, setTitle] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameError, setRenameError] = useState('')
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState('')
  const [mutedOverride, setMutedOverride] = useState(null)
  const [muting, setMuting] = useState(false)
  const [muteError, setMuteError] = useState('')

  // 서버 규칙이다. 상대 이름으로 표시되는 방은 이름을 바꿀 수 없다 —
  // 화면에서 고쳐 봐야 서버가 `CHAT_ROOM_TYPE_NOT_ALLOWED` 로 거절한다.
  const renamable = current ? !['DIRECT', 'AI', 'PEER_AGENT'].includes(current.type) : false
  const leavable = current ? current.type !== 'AI' : false
  // 토글 직후에는 서버 값을 다시 불러올 때까지 내가 누른 값을 그대로 보여준다
  // — 안 그러면 누르는 순간 잠깐 원래 상태로 되돌아갔다 다시 바뀌는 것처럼 깜빡인다.
  const muted = mutedOverride ?? Boolean(current?.muted)

  if (!roomId) {
    return (
      <main className="chat-settings" aria-label="채팅 설정">
        <header className="chat-settings-header">
          <h1>채팅 설정</h1>
          <button type="button" onClick={onClose}>닫기</button>
        </header>
        <Empty>설정할 대화를 왼쪽에서 먼저 고르십시오.</Empty>
      </main>
    )
  }

  if (!current) {
    return (
      <main className="chat-settings" aria-label="채팅 설정">
        <header className="chat-settings-header">
          <h1>채팅 설정</h1>
          <button type="button" onClick={onClose}>닫기</button>
        </header>
        {detail.error ? <LoadError error={detail.error} onRetry={detail.reload} />
          : <Loading label="대화 정보를 불러오는 중입니다…" />}
      </main>
    )
  }

  const submitRename = async (event) => {
    event.preventDefault()
    const next = title.trim()
    if (!next || renaming) {
      return
    }
    setRenaming(true)
    setRenameError('')
    try {
      const updated = await renameRoom(roomId, next)
      onRenamed(updated)
      setTitle('')
    } catch (err) {
      setRenameError(err?.message || '이름을 바꾸지 못했습니다.')
    } finally {
      setRenaming(false)
    }
  }

  const submitLeave = async () => {
    setLeaving(true)
    setLeaveError('')
    try {
      const result = await leaveRoom(roomId)
      // 나가기와 숨기기 중 무엇이 되는지는 **서버가 방 종류를 보고 정한다.**
      // 화면이 미리 단정하면 서버 규칙이 바뀔 때 안내가 어긋난다.
      onLeft(LEAVE_RESULT[result?.action] ?? '대화를 목록에서 지웠습니다.')
    } catch (err) {
      setLeaveError(err?.message || '나가지 못했습니다.')
    } finally {
      setLeaving(false)
      setConfirmLeave(false)
    }
  }

  const submitMuteToggle = async () => {
    if (muting) {
      return
    }
    const next = !muted
    setMuting(true)
    setMuteError('')
    try {
      const result = await muteRoom(roomId, next)
      setMutedOverride(Boolean(result?.muted ?? next))
    } catch (err) {
      setMuteError(err?.message || '알림 설정을 바꾸지 못했습니다.')
    } finally {
      setMuting(false)
    }
  }

  return (
    <main className="chat-settings" aria-label="채팅 설정">
      <header className="chat-settings-header">
        <h1>채팅 설정</h1>
        <button type="button" onClick={onClose}>대화로 돌아가기</button>
      </header>

      <div className="chat-settings-scroll">
        <section className="chat-settings-section">
          <h2>대화 정보</h2>
          <dl className="chat-settings-info">
            <dt>이름</dt>
            <dd>{current.name}</dd>
            <dt>종류</dt>
            <dd>{TYPE_LABEL[current.type] ?? current.type}</dd>
            <dt>소속</dt>
            {/* `path_label` 은 서버가 완성해 준 문자열이다. 팀·프로젝트 이름을
                화면에서 이어 붙이면 규칙이 두 군데로 갈린다. */}
            <dd>{current.context ?? '어느 프로젝트에도 매여 있지 않습니다.'}</dd>
          </dl>
        </section>

        <section className="chat-settings-section">
          <h2>이름 변경</h2>
          {renamable ? (
            <form className="chat-settings-form" onSubmit={submitRename}>
              <input
                aria-label="새 대화 이름"
                placeholder={current.name}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <button type="submit" disabled={!title.trim() || renaming}>
                {renaming ? '바꾸는 중…' : '바꾸기'}
              </button>
            </form>
          ) : (
            <p className="chat-settings-note">
              이 대화는 상대 이름으로 표시됩니다. 이름을 바꾸면 상대가 누구인지
              알 수 없게 되어 서버가 막습니다.
            </p>
          )}
          {renameError ? <p className="chat-settings-error" role="alert">{renameError}</p> : null}
        </section>

        <section className="chat-settings-section">
          <h2>알림</h2>
          <p className="chat-settings-note">
            꺼도 대화는 계속 보입니다. 소리로만 알리지 않을 뿐이고, 미읽음
            수는 그대로 셉니다.
          </p>
          <div className="chat-settings-form">
            <button
              type="button"
              aria-pressed={muted}
              disabled={muting}
              onClick={submitMuteToggle}
            >
              {muting ? '바꾸는 중…' : muted ? '알림 켜기' : '알림 끄기'}
            </button>
          </div>
          {muteError ? <p className="chat-settings-error" role="alert">{muteError}</p> : null}
        </section>

        <section className="chat-settings-section danger">
          <h2>대화 나가기</h2>
          {leavable ? (
            <>
              <p className="chat-settings-note">
                1:1 대화는 내 목록에서만 사라지고 상대에게는 그대로 남습니다.
                단체방은 나가면 이후 대화를 볼 수 없습니다.
              </p>
              {confirmLeave ? (
                <div className="chat-settings-form">
                  <button className="danger" type="button" disabled={leaving} onClick={submitLeave}>
                    {leaving ? '나가는 중…' : '정말 나갑니다'}
                  </button>
                  <button type="button" disabled={leaving} onClick={() => setConfirmLeave(false)}>
                    취소
                  </button>
                </div>
              ) : (
                <button className="chat-settings-danger" type="button" onClick={() => setConfirmLeave(true)}>
                  <Icon src={icons.expandRight} />
                  대화 나가기
                </button>
              )}
            </>
          ) : (
            <p className="chat-settings-note">
              나의 AI 대리인 방은 나갈 수 없습니다. 대리인의 행동 기록이 여기에
              남습니다.
            </p>
          )}
          {leaveError ? <p className="chat-settings-error" role="alert">{leaveError}</p> : null}
        </section>
      </div>
    </main>
  )
}
