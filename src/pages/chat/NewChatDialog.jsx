import { useState } from 'react'

import { createRoom, fetchCandidates } from './chat.data.js'
import { useResource } from '../../lib/useResource.js'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { PersonAvatar } from './chat.ui.jsx'

const ROOM_TYPES = [
  { id: 'DIRECT', label: '1:1 대화', hint: '상대와 직접 이야기합니다.' },
  { id: 'PEER_AGENT', label: '동료의 AI 대리인', hint: '상대가 자리에 없어도 대리인이 답합니다.' },
]

/**
 * 새 채팅.
 *
 * `+` 버튼이 **아무것도 만들지 않았다.** 상태만 토글하고 끝이라, 누른 사람은
 * 화면이 멈춘 줄 안다. 서버에는 `POST /chat/rooms` 와 상대 후보를 주는
 * `/chat/candidates` 가 둘 다 있었다.
 *
 * 방 종류를 먼저 고르게 하는 이유 — `동료의 AI 대리인` 방은 대리인이 있는
 * 사람에게만 걸 수 있고, 서버가 `type` 을 받으면 후보에서 미리 걸러 준다.
 * 목록을 다 보여주고 누른 뒤에 "이 사람은 대리인이 없습니다"를 띄우면,
 * 사용자는 누가 되는지 알아보려고 한 명씩 눌러 봐야 한다.
 *
 * 서버가 이미 있는 방을 되돌려 주면(같은 상대에게 다시 걸면) 그 방을 연다.
 * 새로 만들지 않는 것이 맞다 — 기록이 갈라지면 어제 한 이야기가 사라진다.
 */
export function NewChatDialog({ onClose, onCreated }) {
  const [type, setType] = useState('DIRECT')
  const [query, setQuery] = useState('')
  const [creatingId, setCreatingId] = useState(null)
  const [error, setError] = useState('')

  const { data, error: loadError, loading } = useResource(
    (signal) => fetchCandidates({ type }, signal),
    [type],
  )

  const needle = query.trim().toLowerCase()
  const teams = (data?.teams ?? [])
    .map((team) => ({
      ...team,
      members: team.members.filter((m) => !needle || m.name.toLowerCase().includes(needle)),
    }))
    .filter((team) => team.members.length > 0)

  const start = async (member) => {
    if (creatingId) {
      return
    }
    setCreatingId(member.user_id)
    setError('')
    try {
      const room = await createRoom({ type, member_ids: [member.user_id] })
      onCreated(room)
    } catch (err) {
      setError(err?.message || '대화를 만들지 못했습니다.')
    } finally {
      setCreatingId(null)
    }
  }

  return (
    <div className="chat-overlay" role="dialog" aria-label="새 채팅" aria-modal="true">
      <button className="chat-overlay-backdrop" type="button" aria-label="닫기" onClick={onClose} />
      <div className="new-chat">
        <header>
          <h2>새 채팅</h2>
          <button type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>

        <div className="new-chat-types" role="radiogroup" aria-label="대화 종류">
          {ROOM_TYPES.map((option) => (
            <button
              className={type === option.id ? 'new-chat-type selected' : 'new-chat-type'}
              key={option.id}
              type="button"
              role="radio"
              aria-checked={type === option.id}
              onClick={() => setType(option.id)}
            >
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </button>
          ))}
        </div>

        <input
          aria-label="이름으로 찾기"
          placeholder="이름으로 찾기"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {error ? <p className="new-chat-error" role="alert">{error}</p> : null}

        <div className="new-chat-list">
          {loading && !data ? (
            <Loading label="같은 팀 사람을 불러오는 중입니다…" />
          ) : loadError ? (
            <LoadError error={loadError} />
          ) : teams.length === 0 ? (
            <Empty>
              {type === 'PEER_AGENT'
                ? 'AI 대리인을 쓰는 팀원이 아직 없습니다.'
                : '같은 팀에 다른 사람이 아직 없습니다.'}
            </Empty>
          ) : (
            teams.map((team) => (
              <section key={team.team_id}>
                <h3>{team.team_name}</h3>
                {team.members.map((member) => (
                  <button
                    className="new-chat-member"
                    key={member.user_id}
                    type="button"
                    disabled={Boolean(creatingId)}
                    onClick={() => start(member)}
                  >
                    <PersonAvatar className="new-chat-avatar" src={member.avatar_url} />
                    <span>{member.name}</span>
                    {creatingId === member.user_id ? <em>여는 중…</em> : null}
                  </button>
                ))}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
