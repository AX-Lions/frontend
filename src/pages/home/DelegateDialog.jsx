import { useEffect, useRef, useState } from 'react'

import { setDelegation } from './home.api.js'
import './delegate.css'

/**
 * 불참 등록 — 대리인이 쓸 자료 범위를 고른다.
 *
 * ## 왜 회의마다 고르는가
 *
 * 개인 설정의 `작업 · 계획 · 생각 공개` 는 **평소 기준**이다. 그런데 회의마다
 * 사정이 다르다 — 외부 인원이 들어오는 자리에서는 아직 확정 안 된 `생각` 이
 * 나가면 곤란하고, 진행 상황만 전해도 되는 회의도 있다.
 *
 * 두 설정은 **둘 다 통과해야** 나간다. 여기서 켠다고 개인 설정을 뚫지 못한다.
 *
 * ## 전부 끄는 것도 뜻이 있다
 *
 * "대리인은 보내되 내 기록은 쓰지 마라" 는 성립한다. 회의 발언만 듣고 답하거나,
 * 근거가 없으면 유보한다. 그래서 하나도 안 고른 상태를 막지 않는다.
 *
 * ## 사전 지시를 여기서 받는다
 *
 * `POST /meetings/{id}/delegate` 의 `prompt` 는 **키가 없어도 빈 문자열로
 * 덮어쓴다** (`request.data.get("prompt", "") or ""`). 그래서 이 팝업이 `prompt`
 * 를 안 보내면 Discord 나 다른 경로로 넣어 둔 사전 지시가 **저장을 누르는 순간
 * 사라진다.** 자료 범위만 다시 고르려던 사람이 지시를 잃는다.
 *
 * 화면에서 입력을 받아 항상 함께 보낸다. 서버를 고쳐 "키가 없으면 유지" 로
 * 바꾸는 편이 안전하지만, 그래도 이 팝업은 **지금 무엇이 들어 있는지 보여
 * 줘야 한다** — 안 보이면 사용자는 대리인이 무슨 지시를 들고 회의에 가는지
 * 모른 채 맡기게 된다.
 */

const SOURCES = [
  {
    value: 'work',
    label: '작업 현황',
    hint: '지금 하고 있는 일과 진행률, 막힌 이유',
  },
  {
    value: 'plan',
    label: '계획',
    hint: '앞으로 하려던 일과 순서',
  },
  {
    value: 'thought',
    label: '생각',
    hint: '아직 확정하지 않은 판단과 우려. 회의에 외부 인원이 있으면 꺼 두십시오',
  },
  {
    value: 'document',
    label: '프로젝트 문서',
    hint: '팀에 공개된 문서',
  },
]

const ALL = SOURCES.map((s) => s.value)

export function DelegateDialog({ schedule, onClose, onSaved }) {
  const current = schedule.delegation
  // `null` 은 고른 적 없음이라 전부다. `[]` 는 전부 끈 것이라 그대로 둔다.
  const [picked, setPicked] = useState(current?.sources ?? ALL)
  // 서버에 있던 지시를 그대로 띄운다. 빈 칸으로 시작하면 저장 한 번에 지워진다.
  const [prompt, setPrompt] = useState(current?.prompt ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const closeRef = useRef(null)
  const dialogRef = useRef(null)

  // 열리면 바로 닫기 버튼에 초점을 준다. 키보드만 쓰는 사람이 팝업 안으로
  // 들어오지 못하면 뒤 화면을 계속 훑게 된다.
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  /*
    Esc 로 닫고, Tab 은 팝업 안에서만 돈다.

    가둬 두지 않으면 `Shift+Tab` 한 번에 **뒤 화면으로 빠져나간다.** 팝업은
    DOM 상 맨 뒤에 있어서 앞쪽 요소로 그대로 넘어가고, 마우스로는 뒤가 막혀
    있는데 키보드로는 뚫리는 상태가 된다. 그러면 어디에 초점이 있는지 모르는 채
    보이지 않는 버튼을 누르게 된다.
  */
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') {
        return
      }

      // `textarea` 를 빠뜨리면 사전 지시 칸이 순환에서 빠져 키보드로는
      // 지시를 못 쓴다.
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href]')
      if (!focusable?.length) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      // 팝업 밖에 있으면 (뒤 화면에서 Tab 으로 들어온 경우) 안으로 데려온다.
      if (!dialogRef.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
        return
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (value) => setPicked((c) => (
    c.includes(value) ? c.filter((v) => v !== value) : [...c, value]
  ))

  const save = async (enabled) => {
    if (busy) {
      return
    }
    setBusy(true)
    setError('')
    try {
      // 순서를 화면 순으로 맞춰 보낸다. 고른 순서대로 보내면 같은 조합인데
      // 응답이 매번 다른 순서로 와서 다시 열 때 칸 순서가 흔들린다.
      const sources = ALL.filter((v) => picked.includes(v))
      // 취소(`enabled === false`) 에서도 지시를 함께 보낸다. 빼면 서버가 빈
      // 문자열로 덮어써, 대리 참석을 껐다가 다시 켜는 사람이 지시를 잃는다.
      const saved = await setDelegation(schedule.meeting_id, {
        enabled, sources, prompt: prompt.trim(),
      })
      onSaved(schedule.meeting_id, saved)
      onClose()
    } catch (err) {
      setError(err?.message || '저장하지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <div
      className="delegate-backdrop"
      role="presentation"
      // 뒤를 눌러 닫는 것은 바깥에서만. 안쪽 클릭이 올라와 닫히면 체크하다가
      // 팝업이 사라진다.
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="delegate-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delegate-title"
        ref={dialogRef}
      >
        <header className="delegate-header">
          <div>
            <h2 id="delegate-title">회의에 참여하지 않아요</h2>
            <p>{schedule.title} · {schedule.time_range}</p>
          </div>
          <button ref={closeRef} type="button" aria-label="닫기" onClick={onClose}>×</button>
        </header>

        <div className="delegate-body">
          <label className="delegate-prompt">
            <strong>대리인에게 미리 일러둘 것</strong>
            <em>이 회의에서만 쓰입니다. 비워 두면 평소 설정대로 판단합니다.</em>
            <textarea
              value={prompt}
              disabled={busy}
              rows={3}
              maxLength={1000}
              placeholder="예) 일정 확정은 하지 말고 의견만 전해 주세요."
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>

          <p className="delegate-lead">
            대리인이 이 회의에서 <strong>근거로 쓸 자료</strong>를 고르십시오.
            고르지 않은 자료는 검색되지 않습니다.
          </p>

          {SOURCES.map((source) => {
            const on = picked.includes(source.value)

            return (
              <label className={on ? 'delegate-row on' : 'delegate-row'} key={source.value}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={busy}
                  onChange={() => toggle(source.value)}
                />
                <span>
                  <strong>{source.label}</strong>
                  <em>{source.hint}</em>
                </span>
              </label>
            )
          })}

          {picked.length === 0 ? (
            // 막지 않는다. 다만 무슨 일이 벌어지는지는 미리 알려 준다.
            <p className="delegate-warn">
              아무 자료도 고르지 않았습니다. 대리인은 회의에서 오간 말만 듣고,
              근거가 없으면 <strong>본인 확인이 필요하다고 답합니다.</strong>
            </p>
          ) : null}

          <p className="delegate-note">
            개인 설정의 공개 범위도 함께 적용됩니다. 여기서 켜도 그쪽이 꺼져 있으면
            나가지 않습니다.
          </p>

          {error ? <p className="delegate-error" role="alert">{error}</p> : null}
        </div>

        <footer className="delegate-footer">
          {current?.delegated ? (
            <button
              className="delegate-cancel"
              type="button"
              disabled={busy}
              onClick={() => save(false)}
            >
              대리 참석 취소
            </button>
          ) : null}
          <button className="delegate-save" type="button" disabled={busy} onClick={() => save(true)}>
            {busy ? '맡기는 중…' : '대리인에게 맡기기'}
          </button>
        </footer>
      </div>
    </div>
  )
}
