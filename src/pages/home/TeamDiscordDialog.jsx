import { useEffect, useRef, useState } from 'react'

import { fetchDiscordStatus, linkTeamDiscord, unlinkTeamDiscord } from './home.api.js'
import { useEscapeToClose } from '../../shared/hooks/useEscapeToClose.js'
import './newProject.css'
import './teamDiscord.css'

/**
 * 팀 Discord 관리자 설정(시안 `768:5926`).
 *
 * `팀 전환하기` 목록에서 내 역할이 `OWNER` · `ADMIN` 인 팀에만 붙는 톱니바퀴가
 * 연다 — 시안 부제("팀 관리자일 경우에만 보이는 설정이에요")가 그대로 조건이다.
 *
 * ## `연결 코드` 칸은 시안에 없다
 *
 * 시안은 `Discord 서버 연결하기` 를 누르면 바로 연결되는 것처럼 그려져 있지만,
 * `connect_code` 는 Discord 에서 `/deputy-connect` 를 실행해야 봇이 DM 으로
 * 주는 1회용 코드라 화면에서 만들어 줄 수 없다. 코드 없이 보내면 매번
 * 실패하므로, 누르면 코드를 붙여 넣는 칸을 펼친다.
 */
export function TeamDiscordDialog({ teamId, teamName, onClose }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectCode, setConnectCode] = useState('')
  const [guildId, setGuildId] = useState('')
  const codeRef = useRef(null)

  useEscapeToClose(onClose)

  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    fetchDiscordStatus(teamId, controller.signal)
      .then((body) => {
        if (alive) {
          setStatus(body)
        }
      })
      .catch((err) => {
        if (alive && err?.name !== 'AbortError') {
          setError(err?.message || '연결 상태를 불러오지 못했습니다.')
        }
      })
    return () => {
      alive = false
      controller.abort()
    }
  }, [teamId])

  useEffect(() => {
    if (connecting) {
      codeRef.current?.focus()
    }
  }, [connecting])

  const link = async () => {
    if (!connectCode.trim()) {
      setError('연결 코드를 입력해 주십시오.')
      codeRef.current?.focus()
      return
    }
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const linked = await linkTeamDiscord(teamId, {
        connectCode: connectCode.trim(),
        guildId: guildId.trim(),
      })
      setStatus({
        connected: true,
        guild_id: linked.guild_id,
        guild_name: linked.guild_name,
        channels: linked.channels,
      })
      setConnecting(false)
      setConnectCode('')
      setGuildId('')
    } catch (err) {
      setError(err?.message || '연결하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const unlink = async () => {
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await unlinkTeamDiscord(teamId)
      setStatus({ connected: false, guild_id: null, guild_name: null, channels: null })
    } catch (err) {
      setError(err?.message || '연결을 해제하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const channelName = status?.channels?.meeting?.name

  return (
    <div
      className="np-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="np-dialog td-dialog" role="dialog" aria-modal="true" aria-labelledby="team-discord-title">
        <div className="td-head">
          <h2 className="np-title" id="team-discord-title">팀 Discord 설정</h2>
          <p className="td-lead">팀 관리자일 경우에만 보이는 설정이에요</p>
        </div>

        <div className="td-body">
          <div className="td-team">
            <strong>{teamName}</strong>
            <span>이 팀에서 진행되는 회의를 위한 Discord 서버를 연결할 수 있어요.</span>
          </div>

          {!status ? (
            <p className="td-loading">불러오는 중…</p>
          ) : status.connected ? (
            <div className="td-connected">
              <span className="td-connected-label">현재 연결된 서버</span>
              <div className="td-server-row">
                <div className="td-server">
                  <img src="/icons/CheckMark.svg" alt="" aria-hidden="true" />
                  <div>
                    <strong>{status.guild_name ?? status.guild_id} Discord</strong>
                    {channelName ? <span># {channelName}</span> : null}
                  </div>
                </div>
                <button className="td-unlink" type="button" disabled={busy} onClick={unlink}>
                  {busy ? '해제하는 중…' : '서버 연결 해제하기'}
                </button>
              </div>
            </div>
          ) : (
            <div className="td-disconnected">
              <div className="td-server-row">
                <p className="td-warn">현재 연결된 서버가 없습니다.</p>
                {!connecting ? (
                  <button className="td-link" type="button" onClick={() => setConnecting(true)}>
                    Discord 서버 연결하기
                  </button>
                ) : null}
              </div>

              {connecting ? (
                <div className="td-link-form">
                  <div className="np-field">
                    <span className="np-label">연결 코드</span>
                    <div className="np-box">
                      <input
                        ref={codeRef}
                        value={connectCode}
                        disabled={busy}
                        placeholder="Discord에서 /deputy-connect 로 받은 코드"
                        aria-label="연결 코드"
                        onChange={(event) => setConnectCode(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="np-field">
                    <span className="np-label">서버 ID</span>
                    <div className="np-box">
                      <input
                        value={guildId}
                        disabled={busy}
                        placeholder="Discord 서버 설정 > 개발자 모드로 복사한 서버 ID"
                        aria-label="서버 ID"
                        onChange={(event) => setGuildId(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="np-actions">
                    <button
                      className="np-cancel"
                      type="button"
                      disabled={busy}
                      onClick={() => { setConnecting(false); setConnectCode(''); setGuildId(''); setError('') }}
                    >
                      취소
                    </button>
                    <button className="np-submit" type="button" disabled={busy} onClick={link}>
                      {busy ? '연결하는 중…' : '연결하기'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {error ? <p className="np-error" role="alert">{error}</p> : null}
        </div>

        {!connecting ? (
          <div className="np-actions">
            <button className="np-cancel" type="button" onClick={onClose}>닫기</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
