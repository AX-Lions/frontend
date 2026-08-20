import { useEffect, useRef, useState } from 'react'

import { AppLink } from '../../app/AppLink.jsx'
import { navigate, useSearchParam } from '../../app/navigation.js'
import { cacheKeyFor, evict } from '../../lib/resourceCache.js'
import { useResource } from '../../lib/useResource.js'
import { LoadError, Loading } from '../../shared/components/LoadState.jsx'
import {
  cancelAbsence, fetchPrep, registerAbsence, removeStance, saveAgentSetup,
  saveStance as putStance,
} from './delegatePrep.data.js'
import './delegatePrep.css'

/**
 * 회의 대리 참석 준비 (Figma `685:7160`).
 *
 * 홈의 `회의에 참여하지 않아요` 를 누르면 오는 자리다.
 *
 * ## 왜 팝업이 아니라 화면인가
 *
 * 예전에는 작은 팝업(`DelegateDialog`)이 떴다. 자료 범위 네 칸과 지시 한 줄이
 * 전부라 팝업으로 충분했다. 그런데 이 화면이 요구하는 것은 **회의 전에 사람이
 * 실제로 해야 하는 준비** 다 — 무엇이 갈릴지 미리 보고, 그것 하나하나에 내 입장을
 * 적고, 대리인이 어디까지 판단하게 둘지 정한다. 팝업 안에 스크롤로 밀어 넣으면
 * 뒤에 가려진 홈이 계속 보이면서 **잠깐 들렀다 닫는 것**처럼 읽힌다.
 *
 * ## 서버와 주고받는 것
 *
 * 화면 한 벌을 `GET /meetings/{id}/prep` **한 번에** 받는다. 헤더·논쟁점·내
 * 입장·활동 설정이 한 응답에 들어 있다. 나눠 부르면 그 사이 불참을 취소한
 * 경우 헤더는 `참석 예정` 인데 아래는 대리인 설정을 그린다.
 *
 * 저장은 셋으로 갈린다.
 *
 * | 무엇 | 어디로 |
 * |---|---|
 * | 대리 참석 켜기·끄기 | `POST` · `DELETE /meetings/{id}/absence` |
 * | 활동 설정과 자료 범위 | `PUT /meetings/{id}/agent-setup` |
 * | 논쟁점별 내 입장 | `PUT` · `DELETE /debate-points/{id}/stance` |
 *
 * 셋을 나눈 이유는 이 화면에 `적용하기` 가 여럿이라서다. 한 버튼이 다른
 * 버튼의 입력을 지우면 안 되므로, 활동 설정은 **보낸 키만 바꾸는** 부분
 * 갱신이고 `delegated` 플래그는 `absence` 하나로만 움직인다.
 */

/**
 * 근거 카드에 적을 시각. `08.17 · 20:22`.
 *
 * 준비 화면에서 시각을 브라우저가 찍는 **유일한 자리**다. 헤더의 회의 시각은
 * 서버가 완성해 주지만(`when`), 근거는 예측 당시 스냅샷이라 원본 시각이
 * 그대로 담겨 온다. 읽는 사람 시간대로 보이는 것이 맞다 — 「내가 자리를
 * 비운 사이」 를 재는 기준이 그 사람의 하루이기 때문이다.
 */
function whenLabel(iso) {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) {
    return ''
  }
  const two = (n) => String(n).padStart(2, '0')
  return `${two(at.getMonth() + 1)}.${two(at.getDate())} · `
    + `${two(at.getHours())}:${two(at.getMinutes())}`
}

/*
  상태 뱃지.

  `답변중...` 만 서버에 없다. 그건 지금 이 줄을 펼쳐 놓고 타이핑 중이라는
  뜻이라 브라우저 밖에서는 관측되지 않는다 — 서버가 그것까지 들고 있으면
  다른 기기에서 열어 둔 것이 여기서도 `답변중` 으로 보인다.

  나머지 둘은 서버가 문구까지 준다(`status_label`). 여기 표를 쓰는 것은
  `답변중` 을 끼워 넣어야 하기 때문이고, 두 벌이 갈리지 않도록 문구를 맞춰 둔다.
*/
const STATUS_LABEL = {
  ANSWERED: '답변완료',
  ANSWERING: '답변중...',
  NEEDS_ANSWER: '답변필요',
}

/*
  세부 설정 여섯 줄.

  **저장되는 곳이 둘로 갈린다.** 뒤 셋(작업·계획·생각)은 이 회의의 `sources` 로
  진짜 저장되고, 앞 셋은 아직 회의별로 저장할 곳이 없어 전역 설정이 적용된다.
  한 목록에 섞여 있어 사용자는 구별할 수 없으므로 화면이 적어 준다.
*/
const BEHAVIOR_ROWS = [
  {
    key: 'mention_feasibility',
    label: '구현 가능성 판단',
    hint: '구현 가능 여부를 Bordo가 대신 판단하고 답합니다.',
  },
  {
    key: 'allow_schedule_change',
    label: '일정 수정 여부 판단',
    hint: '일정 수정 여부를 Bordo가 대신 판단하고 수정합니다.',
  },
  {
    key: 'allow_midmeeting_question',
    label: '회의 중간 질문',
    hint: '회의 중간에 Bordo가 질문할 수 있습니다.',
  },
]

const SOURCE_ROWS = [
  { key: 'work', label: '작업 공개', hint: '개인이 진행한 작업을 타 팀원에게 공개합니다.' },
  { key: 'plan', label: '계획 공개', hint: '개인이 세운 계획을 타 팀원에게 공개합니다.' },
  { key: 'thought', label: '생각 공개', hint: '개인의 생각을 타 팀원에게 공개합니다.' },
  /*
    시안에는 없지만 남긴다.

    `sources` 에는 `document`(프로젝트 문서)도 있다. 시안대로 세 줄만 두면 저장할
    때 이 값이 목록에서 빠져 **문서를 근거로 쓰던 사람이 아무 안내 없이 그것을
    잃는다.** 줄을 지우는 것과 기능을 끄는 것은 다르다.
  */
  { key: 'document', label: '프로젝트 문서', hint: '팀에 공개된 문서를 근거로 씁니다.' },
]

const ALL_SOURCES = SOURCE_ROWS.map((row) => row.key)

const pad = (n) => String(n).padStart(2, '0')


/*
  연필.

  `public/icons` 에 없는 모양이라 여기서 그린다. 아이콘 파일을 새로 만들어
  넣지 않는 이유는 **디자인 산출물을 대신 커밋하지 않기 때문**이다
  (`CONTRIBUTING.md`). 화면 코드 안의 도형은 그 대상이 아니다.
*/
function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M10.6 2.4a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-6.6 6.6-3.3.7.7-3.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinejoin="round"
      />
      <path d="M3.7 12.3l1.2-.3-.9-.9z" fill="currentColor" />
    </svg>
  )
}

/*
  보내기 화살표(`corner-down-right`).

  선 굵기를 그리는 크기에 맞춰 둔다 — 24 칸 그림을 16px 로 줄여 그리므로
  `strokeWidth 2` 가 화면에서 1.33px 이 되어 시안과 같아진다.
*/
function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4v7a4 4 0 0 0 4 4h12" />
        <path d="M15 10l5 5-5 5" />
      </g>
    </svg>
  )
}

function Switch({ on, disabled, onChange, label }) {
  return (
    <button
      className={on ? 'prep-switch on' : 'prep-switch'}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="prep-switch-text" aria-hidden="true">{on ? 'on' : 'off'}</span>
      <span className="prep-switch-knob" aria-hidden="true" />
    </button>
  )
}

function PrepTopBar() {
  return (
    <header className="prep-topbar">
      <span className="prep-menu" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <AppLink className="prep-logo" href="/">Bordo</AppLink>
      <AppLink className="prep-back" href="/">← 돌아가기</AppLink>
    </header>
  )
}

function PrepShell({ children }) {
  return (
    <div className="prep-layout">
      <PrepTopBar />
      <main className="prep-main">{children}</main>
    </div>
  )
}

/**
 * 맡기고 나면 뜨는 모달.
 *
 * ## 두 얼굴이다
 *
 * 예전에는 논쟁점에 **전부** 답했을 때만 떴다. 저장은 됐는데 아무 일도
 * 안 일어난 것처럼 보여, 눌린 것인지 아닌지를 화면 아래 알림 한 줄로만
 * 알 수 있었다. 그래서 이제 누르면 항상 뜬다.
 *
 * 대신 **끝나지 않았는데 끝났다고 말하지 않는다.** 논쟁점이 남아 있으면
 * 제목이 `완료` 가 아니라 `저장` 이고, 몇 개가 남았는지 적는다. 하나만
 * 됐는데 여기서 끝났다고 하면 사용자는 나머지를 잊고 회의로 넘어간다.
 *
 * 남은 것이 있을 때 홈으로 데려가지 않는 이유도 같다 — 돌아갈 곳은
 * 남은 논쟁점이지 홈이 아니다.
 */
function CompleteModal({ remaining = 0, onClose }) {
  const done = remaining === 0
  const homeButtonRef = useRef(null)

  useEffect(() => {
    homeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="prep-complete-backdrop"
      role="presentation"
      onClick={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        className="prep-complete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prep-complete-title"
      >
        <button className="prep-complete-close" type="button" aria-label="닫기" onClick={onClose}>
          ×
        </button>
        <h2 id="prep-complete-title">
          {done ? '설정을 완료했습니다' : '설정을 저장했습니다'}
        </h2>
        <p>
          {done
            ? '모든 논쟁점에 입장을 남기고 Bordo 활동 설정까지 마쳤습니다. 회의 시간이 되면 Bordo가 대신 참석해 처리합니다.'
            : `Bordo 활동 설정을 적용했습니다. 논쟁점 ${remaining}개에 아직 입장이 없습니다.`}
        </p>
        {/* 닫기(×)는 이 화면에 남아 더 손보게 하고, 이 버튼은 준비가 끝났다는
            사람의 판단을 그대로 따라 홈으로 데려간다.

            남은 것이 있으면 홈으로 보내지 않는다. 이 모달을 닫는 것이 곧
            남은 논쟁점으로 돌아가는 것이라 같은 일을 한다. */}
        <button
          ref={homeButtonRef}
          className="prep-complete-home"
          type="button"
          onClick={done ? () => navigate('/') : onClose}
        >
          {done ? '홈으로 가기' : '남은 논쟁점 보기'}
        </button>
      </div>
    </div>
  )
}

export function DelegatePrepPage() {
  const meetingId = useSearchParam('meeting')

  /*
    회의 정보는 홈이 이미 들고 있다.

    `today_schedule` 안에 제목·시각·장소와 **지금 내 대리 참석 상태**가 다 있다.
    담아 둔 것을 그대로 읽으므로 홈에서 넘어온 사람에게는 요청이 하나도 안 나간다.
    주소로 바로 들어온 경우에만 회의를 따로 읽는다.
  */
  /*
    준비 화면 한 벌을 **한 번에** 받는다.

    전에는 홈이 담아 둔 `today_schedule` 에서 이 회의를 찾아 썼다. 그런데 그
    목록은 오늘·미종료 회의 다섯 개로 잘려 있어서, 거기 없는 회의를 주소로 열면
    **저장해 둔 자료 범위가 안 보인 채 전부 켜진 상태로 시작**했다. 그대로
    저장하면 꺼 뒀던 자료까지 대리인이 근거로 쓴다.

    서버가 헤더·논쟁점·입장·설정을 한 응답으로 준다. 네 번 나눠 부르면 그 사이
    불참을 취소한 경우 헤더는 `참석 예정` 인데 아래는 대리인 설정을 그린다.
  */
  const prep = useResource(
    (signal) => (meetingId ? fetchPrep(meetingId, signal) : Promise.resolve(null)),
    [meetingId],
  )

  const header = prep.data?.header ?? null
  const debate = prep.data?.debate ?? null
  const setup = prep.data?.agent_setup ?? null

  const [openId, setOpenId] = useState(null)
  const [menuFor, setMenuFor] = useState(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [stanceText, setStanceText] = useState('')
  /*
    적어 둔 답변은 **줄 하나에 하나가 아니다.**

    `편집하기` 로 고칠 때만 있던 것을 바꾸고, 그냥 새로 쓰면 한 장이 더 쌓인다.
    회의 전에 생각이 바뀌는 것은 흔한 일이고, 앞의 판단을 지우면 **왜 바뀌었는지**
    가 사라진다 — 대리인이 근거로 쓰는 것이 이 글이라 더 그렇다.

    `null` 은 아직 아무것도 안 썼다는 뜻이라 서버가 준 것(`my_stance`)을 그대로
    읽는다. 한 번이라도 쓰면 그 목록이 기준이 된다.
  */
  const [written, setWritten] = useState(null)
  const [editingId, setEditingId] = useState(null)
  /*
    `null` 은 **아직 서버 값을 안 받았다**는 뜻이다. 빈 문자열과 구분해야 한다.

    빈 문자열로 시작하면 첫 그림에서 칸이 비어 보이고, 그 상태로 `적용하기` 를
    누르면 적어 뒀던 지시를 빈 값으로 덮어쓴다.
  */
  const [extraDraft, setExtraDraft] = useState(null)
  //  「저장했습니다」 는 잠깐만 띄운다. 계속 남으면 지금 저장한 것인지
  //  아까 저장한 것인지 구별이 안 된다.
  const [noteSaved, setNoteSaved] = useState(false)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [showComplete, setShowComplete] = useState(false)
  const stanceInputRef = useRef(null)
  const menuRef = useRef(null)
  const panelRef = useRef(null)

  // 이번 회의에서 실제로 판정에 쓰일 값. 평소 설정 위에 회의별 덮어쓰기를
  // 얹은 결과라, 화면이 둘을 합칠 필요가 없다.
  const settings = setup?.settings ?? null
  // `null` 은 고른 적 없음이라 전부고, `[]` 는 전부 끈 것이다. 둘을 같게 다루면
  // 아무것도 안 고른 사람에게 전부 켜진 화면을 보여 주게 된다.
  const savedSources = setup?.sources ?? ALL_SOURCES

  /*
    아직 안 만졌으면 서버 값을 그대로 읽는다.

    `useEffect` 로 초깃값을 옮겨 담으면 **한 번은 빈 값으로 그려진 뒤** 바뀐다.
    스위치가 전부 꺼진 채 보였다가 켜지는 것이 눈에 띄고, 그 사이에 누른 값은
    덮어써진다.

    `useMemo` 로 감싸지 않는다. 의존성에 서버가 준 배열이 들어가는데, React
    컴파일러는 그 배열이 나중에 바뀔 수 있다고 보고 **이 컴포넌트 최적화를
    통째로 건너뛴다.** 손으로 감싼 것 하나 때문에 나머지를 다 잃는 셈이라,
    맡기는 편이 낫다.
  */
  const applied = draft ?? (settings ? {
    mention_feasibility: settings.mention_feasibility,
    allow_schedule_change: settings.allow_schedule_change,
    allow_midmeeting_question: settings.allow_midmeeting_question,
    ...Object.fromEntries(ALL_SOURCES.map((key) => [key, savedSources.includes(key)])),
  } : null)

  const extraPrompt = extraDraft ?? setup?.extra_note ?? ''

  const delegated = Boolean(header?.delegated)
  const rows = debate?.points ?? []
  /*
    서버가 든 입장에서 시작한다.

    **논쟁점 하나에 내 입장은 하나다.** 서버가 그렇게 든다 — 같은 쟁점에 둘이면
    대리인이 어느 쪽으로 말할지 정할 수 없기 때문이다. 화면도 그 규칙을 따른다.
    다시 쓰면 갱신이고, 새로고침해도 방금 쓴 것이 그대로 있다.

    전에는 화면 안에만 쌓였다. 카드가 여러 장 보이고 `답변완료` 로 바뀌고
    「맡겼습니다」 까지 떴는데 **서버로는 한 글자도 안 갔다.** 새로고침하면
    전부 사라졌고, 대리인은 그 입장을 한 번도 받지 못했다.
  */
  const seedEntries = () => rows
    .filter((row) => row.stance)
    .map((row) => ({
      id: `saved-${row.id}`, rowId: row.id, text: row.stance.body, seq: 0,
    }))

  const entries = written ?? seedEntries()
  // 새로 쓴 것을 뒤에 붙이므로 `[0]` 은 가장 **오래된** 것이다. 순번으로 고른다.
  const latestOf = (row) => entries
    .filter((entry) => entry.rowId === row.id)
    .reduce((best, entry) => (!best || entry.seq > best.seq ? entry : best), null)
  /*
    지금 고른 논쟁점 하나.

    입력칸도 그 아래 적어 둔 답변도 **이것 하나만 본다.** 예전에는 적어 둔
    답변을 전부 쌓아 보여 줬는데, 그러면 왼쪽에서 보고 있는 논쟁점과 오른쪽에
    보이는 글이 서로 다른 것을 가리켰다 — 01 을 읽으면서 03 의 답변을 고치는
    일이 생긴다.
  */
  /*
    아무 줄도 안 골랐으면 **아직 답이 없는 첫 줄**을 연다.

    답을 적으러 오는 화면인데 첫 걸음이 줄 하나를 고르는 일이었다. 그동안
    오른쪽 입력칸은 「왼쪽에서 논쟁점을 펼친 뒤 내 입장을 적어 주세요」 만
    띄우고 있어서, 들어온 사람은 **쓸 수 있는 화면을 못 본 채로 시작**했다.

    이미 다 답했으면 아무것도 안 연다. 그때는 첫 줄을 펴 봐야 고치라는 뜻으로
    읽히는데, 확인하러 온 사람에게 고치라고 말할 이유가 없다.

    `openId` 를 건드리지 않고 **파생으로만** 정한다. 상태에 넣으면 목록이 다시
    올 때마다(저장 뒤 새로고침) 사용자가 접어 둔 줄이 도로 열린다.
  */
  const firstUnanswered = rows.find((row) => !latestOf(row)) ?? null
  const openRow = openId
    ? (rows.find((row) => row.id === openId) ?? null)
    : firstUnanswered
  /*
    적어 둔 답변은 **쌓인다** (시안 `692:7442`).

    방금 쓴 것이 맨 위다. 논쟁점 번호순으로 두면 세 번째 것을 쓴 뒤 화면이
    그대로여서 저장이 됐는지 알 수 없다 — 새로 쓴 글이 눈길이 가는 자리에
    올라와야 그것이 저장의 신호가 된다.

    서버가 준 것은 순번이 없으므로 뒤로 간다. 같은 순번끼리는 논쟁점 번호를 따른다.
  */
  const orderOf = (rowId) => rows.find((row) => row.id === rowId)?.order ?? 0
  const stacked = [...entries]
    .sort((a, b) => (b.seq - a.seq) || (orderOf(a.rowId) - orderOf(b.rowId)))

  /*
    모달이 `완료` 라고 말해도 되는지 가르는 값.

    논쟁점 하나하나가 아니라 **전부** 답했는지를 본다. 하나라도 `답변필요` 로
    남아 있으면 회의에서 대리인이 그 쟁점에 대해 할 말이 없다 — 준비가 끝난
    것이 아니다. 논쟁점이 하나도 없는 회의는 답할 것이 없으므로 0 이 된다.
  */
  const remainingPoints = rows.filter((row) => !latestOf(row)).length

  /*
    같은 논쟁점의 답은 **라벨 하나 아래로 묶는다.**

    한 장마다 `논쟁점 02` 를 다시 적으면, 같은 줄에 대한 답이 여럿이라는 사실이
    같은 낱말의 반복으로만 드러난다. 읽는 사람은 그것이 다른 논쟁점인지 같은
    것인지 라벨을 하나하나 대조해야 한다.

    `stacked` 가 이미 최신순이라, 묶음의 순서는 **그 묶음에서 가장 최근에 쓴 것**을
    따르고 묶음 안도 최신이 위다. 방금 쓴 글이 늘 맨 위에 오른다.

    고치는 중인 한 장은 먼저 걷어낸다. 마지막 한 장을 고치는 중이면 그 묶음은
    통째로 빠진다 — 카드 없는 라벨만 남으면 답이 사라진 것처럼 보인다.
  */
  const groups = []
  stacked
    .filter((entry) => entry.id !== editingId)
    .forEach((entry) => {
      const group = groups.find((item) => item.rowId === entry.rowId)
      if (group) {
        group.items.push(entry)
      } else {
        groups.push({ rowId: entry.rowId, items: [entry] })
      }
    })

  /*
    윗줄은 **팀 · 프로젝트** 다 (시안 `692:7436`).

    팀 이름은 일정에도 회의 상세에도 없다. 홈이 내려주는 `project_progress` 가
    프로젝트마다 `team_name` 을 달고 오므로 그것으로 잇는다 — 이 화면은 이미
    홈을 담아 둔 것으로 읽고 있어서 요청이 하나도 늘지 않는다.

    못 찾으면 프로젝트 이름만 남긴다. `팀 · ` 만 덩그러니 남기면 팀이 없는 것처럼
    보이고, `-` 같은 자리 채우기를 넣으면 그것을 이름으로 읽는다.
  */
  const projectName = header?.project_name ?? ''
  const headline = [header?.team_name, projectName].filter(Boolean).join(' · ')

  /*
    아랫줄은 **날짜 시각 · 장소**.

    시각 문자열을 서버가 완성해 준다(`when`). 브라우저 시간대로 찍으면 시간대가
    다른 팀원이 같은 회의를 다른 시각으로 본다 — 그게 이 서비스의 전제다.
  */
  const timeText = [header?.when, header?.location].filter(Boolean).join(' · ')

  /*
    메뉴는 바깥을 눌러도 닫혀야 한다.

    작은 팝업이 열린 채로 남으면 다음에 누른 것을 가리고, 사용자는 왜 안 눌리는지
    모른 채 같은 자리를 다시 누른다. `Escape` 도 함께 받는다 — 키보드로 연 사람이
    닫을 방법이 그것뿐이다. 초점은 열었던 `⋮` 로 돌려준다. 안 돌려주면 초점이
    사라진 문서 맨 앞으로 튀어 목록을 처음부터 다시 훑게 된다.
  */
  useEffect(() => {
    if (!menuFor) {
      return undefined
    }

    const close = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuFor(null)
      }
    }
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuFor(null)
        menuRef.current?.querySelector('.prep-stance-more')?.focus()
      }
    }

    document.addEventListener('pointerdown', close)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuFor])

  /**
   * 이 논쟁점의 입장 칸을 연다.
   *
   * 상태 뱃지(`답변완료 · 답변중… · 답변필요`)와 `편집하기` 가 같은 곳으로
   * 온다. 셋 다 **다음에 할 일이 하나**이기 때문이다 — 아직 안 썼으면 쓰고,
   * 썼으면 고친다. 상태마다 다른 화면으로 보내면 사용자는 뱃지를 누르기 전에
   * 무슨 일이 벌어질지 매번 다시 판단해야 한다.
   */
  const selectRow = (id) => {
    setOpenId(id)
    /*
      고른 것이 바뀌면 칸을 비운다.

      안 비우면 01 에 쓰다 만 글이 칸에 남은 채 02 로 넘어가고, 그대로 보내면
      **02 의 답변으로 저장된다.** 어느 논쟁점에 쓰고 있는지는 칸이 아니라
      왼쪽 목록이 말하고 있어서, 글만 따라오면 사용자는 알아채지 못한다.
    */
    setStanceText('')
    setEditingId(null)
    setMenuFor(null)
  }

  const startStance = (row) => {
    selectRow(row.id)
    // 칸으로 초점을 옮긴다. 안 옮기면 커서가 누른 자리에 남아, 바로 쓰려던
    // 사람이 칸을 한 번 더 눌러야 한다.
    window.requestAnimationFrame(() => stanceInputRef.current?.focus())
  }

  /**
   * 적어 둔 답변 **한 장**을 칸으로 되돌린다(`편집하기`).
   *
   * 되돌리는 동안에는 그 카드를 감춘다. 같은 글이 칸과 카드에 동시에 있으면
   * 어느 쪽이 지금 고치고 있는 것인지 알 수 없다. 나머지 카드는 그대로 둔다 —
   * 한 장을 고치는 동안 다른 답까지 사라질 이유가 없다.
   */
  const editEntry = (entry) => {
    setOpenId(entry.rowId)
    setStanceText(entry.text)
    setEditingId(entry.id)
    setMenuFor(null)
    window.requestAnimationFrame(() => stanceInputRef.current?.focus())
  }

  const set = (key, value) => setDraft({ ...applied, [key]: value })

  const apply = async (mode) => {
    if (busy || !meetingId || !applied) {
      return
    }
    setBusy(mode)
    setError('')
    setNotice('')

    /*
      `현재 설정 사용` 은 **되돌리기**다.

      화면에서 만지던 값을 함께 보내지 않는다. 서버가 `mode: "STANDING"` 을 받으면
      회의별 덮어쓰기를 통째로 지우고 평소 설정으로 돌아간다 — 되돌린 결과를
      응답으로 받아 그리므로 화면이 평소 값을 따로 계산할 필요가 없다.

      전에는 화면이 `disclose_work_plan_thought` 한 칸을 셋으로 펼쳐 보냈는데,
      그러면 평소 설정을 그대로 쓰겠다고 눌러 놓고 **회의별 값을 새로 쓰는** 셈이라
      다음에 평소 설정을 바꿔도 이 회의만 옛 값에 묶인다.
    */
    const payload = mode === 'current'
      ? { mode: 'STANDING' }
      : {
        mode: 'ONCE',
        settings: {
          mention_feasibility: applied.mention_feasibility,
          allow_schedule_change: applied.allow_schedule_change,
          allow_midmeeting_question: applied.allow_midmeeting_question,
          disclose_work: applied.work,
          disclose_plan: applied.plan,
          disclose_thought: applied.thought,
        },
        // 순서를 화면 순으로 맞춰 보낸다. 고른 순서대로 보내면 같은 조합인데
        // 응답이 매번 다른 순서로 와서 다시 열 때 칸 순서가 흔들린다.
        sources: ALL_SOURCES.filter((key) => applied[key]),
        // 화면의 「추가 설정」 칸. 저장된 값을 그대로 띄워 두므로, 손대지 않은
        // 사람은 있던 것을 그대로 다시 보내게 된다 — 지워지지 않는다.
        extra_note: extraPrompt.trim(),
      }

    try {
      /*
        아직 불참 등록이 안 됐으면 **먼저 등록한다.**

        버튼에 `적용하기` 라고 적혀 있지만 사람이 기대하는 것은 「맡기기」다.
        홈을 거치지 않고 주소로 바로 들어온 경우 설정만 저장되고 대리 참석은
        꺼진 채로 남는데, 화면에는 「맡겼습니다」 가 떠서 알 방법이 없었다.
      */
      if (!delegated) {
        await registerAbsence(meetingId)
      }
      await saveAgentSetup(meetingId, payload)
      // 서버 값으로 돌려 놓는다. 안 놓으면 `현재 설정 사용` 으로 되돌린 뒤에도
      // 칸에는 아까 치던 글이 남아, 되돌아간 것이 화면에 안 보인다.
      setDraft(null)
      setExtraDraft(null)
      await prep.reload()
      // 홈이 담아 둔 것을 버린다. 안 버리면 돌아갔을 때 버튼이 아직
      // `회의에 참여하지 않아요` 로 남아 등록이 안 된 것처럼 보인다.
      evict(cacheKeyFor('home', []))
      setNotice(mode === 'current'
        ? '평소 설정으로 Bordo에게 맡겼습니다.'
        : '이번 회의에만 적용해 Bordo에게 맡겼습니다.')
      /*
        맡겨졌다는 것을 눈에 보이게 말한다.

        예전에는 논쟁점을 전부 답했을 때만 띄웠다. 그러지 않은 사람에게는
        화면 아래 알림 한 줄이 전부라, 눌리긴 한 것인지 알기 어려웠다.
        남은 것이 있으면 모달이 `완료` 대신 `저장` 이라고 말한다.
      */
      setShowComplete(true)
      return true
    } catch (caught) {
      setError(caught?.message || '적용하지 못했습니다.')
      return false
    } finally {
      setBusy('')
    }
  }

  /**
   * 「추가 설정」만 저장한다.
   *
   * `mode` 를 안 보낸다 — 서버는 **보낸 키만** 바꾼다. 자료 범위나 활동 설정을
   * 건드릴 이유가 없다.
   */
  const saveExtraNote = async () => {
    if (busy || !meetingId) {
      return
    }
    setBusy('note')
    setError('')
    try {
      await saveAgentSetup(meetingId, { extra_note: extraPrompt.trim() })
      setExtraDraft(null)
      await prep.reload()
      setNoteSaved(true)
    } catch (caught) {
      setError(caught?.message || '추가 설정을 저장하지 못했습니다.')
    } finally {
      setBusy('')
    }
  }

  const cancel = async () => {
    if (busy || !meetingId) {
      return
    }
    setBusy('cancel')
    setError('')
    setNotice('')
    try {
      /*
        취소는 **불참 등록을 되돌리는 것**이지 설정을 지우는 것이 아니다.

        옛 경로는 `delegate` 에 `enabled: false` 를 보내면서 자료 범위와 지시를
        함께 실어야 했다 — 안 실으면 서버가 빈 문자열로 덮어썼기 때문이다.
        지금은 본문이 아예 없다. 껐다가 다시 켜는 사람의 준비 내용이 그대로 남는다.
      */
      await cancelAbsence(meetingId)
      await prep.reload()
      evict(cacheKeyFor('home', []))
      setNotice('대리 참석을 취소했습니다.')
    } catch (caught) {
      setError(caught?.message || '취소하지 못했습니다.')
    } finally {
      setBusy('')
    }
  }

  const saveStance = async () => {
    const text = stanceText.trim()
    if (!openRow || !text || busy) {
      return
    }
    /*
      **고치는 중이었는지를 먼저 붙잡아 둔다.**

      저장이 끝나면 `editingId` 를 비우는데, 다음 줄로 넘어갈지 말지는 그 값으로
      정한다. 비운 뒤에 읽으면 고치던 사람도 다음 줄로 끌려간다.
    */
    const wasEditing = Boolean(editingId)
    setBusy('stance')
    setError('')
    try {
      /*
        **서버로 보낸다.** 여기가 이 화면의 존재 이유다.

        대리인이 회의에서 이 글을 그대로 전한다. 화면에만 쌓아 두면 `답변완료`
        뱃지도 「대리인이 그대로 전합니다」 라는 문구도 거짓말이 된다.

        응답으로 그 논쟁점 한 줄이 통째로 온다(`point_row`). 뱃지와 상태 라벨을
        화면이 다시 계산하지 않고 서버가 준 것을 쓴다 — 저장은 됐는데 뱃지만
        안 바뀌는 어긋남이 생길 자리를 없앤다.
      */
      await putStance(openRow.id, { body: text, optionKey: openRow.stance?.option_key })
      await prep.reload()
      setWritten(null)
      setStanceText('')
      setEditingId(null)

      /*
        저장이 끝나면 **다음 논쟁점으로 넘어간다.**

        세 줄을 차례로 답하는 것이 이 화면에서 하는 일인데, 저장할 때마다 목록으로
        돌아가 다음 줄을 찾아 누르게 하면 같은 동작을 논쟁점 수만큼 반복한다.
        다음 줄이 펼쳐지면서 그 줄의 예측 근거가 바로 보이고 칸도 그 줄을 가리킨다.

        **서버가 받은 뒤에 넘어간다.** 보내는 것과 동시에 넘기면, 저장이 실패해도
        화면은 이미 다음 줄에 가 있어 방금 쓴 글이 어디로 갔는지 알 수 없다.

        **고칠 때는 넘어가지 않는다.** 그 한 장을 바로잡으러 온 것이지 다음을
        쓰러 온 것이 아니라, 넘어가 버리면 방금 고친 결과를 확인할 자리를 잃는다.

        마지막 줄이면 아무 데도 가지 않고 닫는다. 첫 줄로 되돌리면 이미 답한 것을
        다시 답하라는 뜻으로 읽힌다.
      */
      const next = wasEditing
        ? openRow
        : (rows
          .filter((row) => row.order > openRow.order)
          .sort((a, b) => a.order - b.order)[0] ?? null)

      setOpenId(next?.id ?? null)

      /*
        쓰던 칸에 초점을 남긴다.

        보낸 단추는 칸이 비는 순간 꺼진다. 초점을 옮겨 두지 않으면 그 단추와 함께
        사라져 문서 맨 앞으로 풀리고, 키보드로 쓰던 사람은 목록을 처음부터 다시
        훑어야 다음 칸에 닿는다.
      */
      if (next) {
        window.requestAnimationFrame(() => stanceInputRef.current?.focus())
      }
    } catch (caught) {
      // 길이 제한처럼 서버가 이유를 말해 주는 것이 있다. 그대로 보여 준다.
      setError(caught?.message || '입장을 저장하지 못했습니다.')
    } finally {
      setBusy('')
    }
  }

  /** 적어 둔 입장 지우기. */
  const dropStance = async (rowId) => {
    if (busy) {
      return
    }
    setBusy('stance')
    setError('')
    try {
      await removeStance(rowId)
      await prep.reload()
      setWritten(null)
      setEditingId(null)
    } catch (caught) {
      setError(caught?.message || '지우지 못했습니다.')
    } finally {
      setBusy('')
    }
  }

  if (!meetingId) {
    return (
      <PrepShell>
        <p className="prep-empty">어느 회의인지 알 수 없습니다. 홈에서 다시 눌러 주십시오.</p>
      </PrepShell>
    )
  }

  if (prep.loading && !prep.data) {
    return <PrepShell><Loading label="회의를 여는 중입니다…" /></PrepShell>
  }

  if (prep.error && !prep.data) {
    return (
      <PrepShell>
        <LoadError
          error={prep.error}
          onRetry={prep.reload}
        />
      </PrepShell>
    )
  }

  return (
    <PrepShell>
      <header className="prep-head">
        <div className="prep-head-title">
          <h1>회의 대리 참석 준비</h1>
          <p>예상되는 논쟁점에 대한 의견과 Bordo의 활동 방식을 설정해주세요.</p>
        </div>

        <div className="prep-head-meeting">
          <div className="prep-head-meeting-text">
            <strong>{headline}</strong>
            <span>{timeText}</span>
          </div>
          {/*
            뱃지 문구도 서버가 준 것(`badge`)을 쓴다. 회의가 이미 시작됐으면
            `대리 참석 중` 이고 그 전이면 `예정` 인데, 화면이 필드를 조합하면
            홈과 여기가 같은 회의를 다르게 부른다. 대리인 호칭도 사람마다 다르다.
          */}
          {delegated ? <span className="prep-badge">{header?.badge}</span> : null}
        </div>
      </header>

      {notice ? <p className="prep-notice" role="status">{notice}</p> : null}
      {error ? <p className="prep-error" role="alert">{error}</p> : null}

      <div className="prep-columns">
        <section className="prep-contentions" aria-labelledby="prep-contentions-title">
          <div className="prep-section-head">
            <h2 id="prep-contentions-title">예상 논쟁점</h2>
            {/*
              문구를 서버가 완성해 준다(`notice`). 개수를 화면이 세면 논쟁점이
              없을 때 「0개의 논쟁점을 예상했어요」 가 나오는데, 그건 예상에
              실패했다는 뜻이지 아직 예상할 자료가 없다는 뜻이 아니다.
            */}
            <p>{debate?.notice ?? ''}</p>
          </div>

          {prep.loading ? <Loading label="논쟁점을 읽는 중입니다…" /> : null}

          {rows.map((row) => {
            const open = openRow?.id === row.id
            const latest = latestOf(row)
            /*
              상태는 **화면이 정한다.**

                  펼쳐서 답을 쓰는 중       답변중...
                    ├ 아직 적은 것이 없다
                    └ 적어 둔 것을 고치는 중
                  적어 둔 것이 있다         답변완료
                  그 밖                     답변필요

              `답변중` 은 서버가 알 수 없는 상태다 — 사람이 이 줄을 열어 답을
              쓰고 있다는 뜻이라, 브라우저 밖에서는 관측되지 않는다. 서버가
              그것까지 들고 있으면 다른 기기에서 열어 둔 것이 여기서도 `답변중`
              으로 보이고, 정작 이 화면에서 누른 줄은 아무 표시가 없다.

              **고치는 중에도 `답변중` 이다.** 이미 답이 있다는 것과 지금 그 답에
              손을 대고 있다는 것은 다른 사실이고, 고치다 만 채 회의에 들어가는
              일이 실제로 일어난다. `답변완료` 로 두면 목록만 보고는 그것을
              알 수 없다.
            */
            /*
              **고치는 중인지는 `editingId` 하나로 본다.**

              전에는 `editing` 불리언과 `editingId` 가 같은 사실을 둘로 들고
              있었고 뱃지는 불리언만 봤다. 둘이 어긋나면 **고치는 중인데
              `답변완료` 로 보였다** — 고치다 만 채 회의에 들어가는 것을 잡으려고
              만든 표시인데 정작 그때 안 떴다.
            */
            const answering = open && (!latest || editingId === latest?.id)
            const status = answering
              ? 'ANSWERING'
              : (latest ? 'ANSWERED' : 'NEEDS_ANSWER')

            return (
              <article className={open ? 'prep-contention open' : 'prep-contention'} key={row.id}>
                <h3 className="prep-contention-head">
                  <button
                    className="prep-contention-toggle"
                    type="button"
                    aria-expanded={open}
                    onClick={() => selectRow(open ? null : row.id)}
                  >
                    <span className="prep-contention-no">논쟁점 {pad(row.order)}</span>
                    <span className="prep-contention-title">{row.title}</span>
                  </button>

                  {/*
                    상태는 **표시다. 누르는 자리가 아니다.**

                    전에는 이것도 단추라 누르면 입장 칸이 열렸다. 생김새는 상태
                    표시인데 눌리니 **손을 대 봐야 눌리는지 알 수 있었고**, 바로
                    옆 제목과 화살표가 이미 같은 일을 하고 있어 한 줄에 같은
                    동작을 하는 자리가 셋이었다.

                    읽어 주는 쪽에는 `role="status"` 로 준다 — 뱃지가 바뀌는 것이
                    화면을 못 보는 사람에게도 전해져야 한다.
                  */}
                  <span
                    className={`prep-status is-${status.toLowerCase()}`}
                    role="status"
                  >
                    {STATUS_LABEL[status]}
                  </span>

                  {/*
                    화살표는 제목 버튼과 같은 일을 한다. 키보드로는 제목 쪽
                    하나만 서게 두고(`tabIndex={-1}`) 마우스로 누르는 자리로만
                    남긴다 — 같은 동작을 하는 정거장이 둘이면 목록을 훑는 데
                    걸음이 두 배가 된다.
                  */}
                  <button
                    className="prep-contention-chevron"
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => selectRow(open ? null : row.id)}
                  >
                    <span className={open ? 'prep-chevron open' : 'prep-chevron'} />
                  </button>
                </h3>

                {open ? (
                  <div className="prep-contention-body">
                    {row.options?.length ? (
                      <div className="prep-options">
                        {row.options.map((option) => (
                          <div className="prep-option" key={option.key}>
                            <strong>{option.title}</strong>
                            <span>{option.description}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {row.rationale ? (
                      <div className="prep-prediction">
                        <p className="prep-prediction-head">
                          <span aria-hidden="true">✦</span> Bordo가 이렇게 예측했어요.
                        </p>
                        <p className="prep-prediction-body">{row.rationale}</p>

                        {/*
                          근거 카드는 **예측 당시의 스냅샷**이다. 원본 메시지가
                          나중에 고쳐져도, 대리인이 그때 무엇을 보고 이렇게
                          예측했는지가 남아야 한다 — 그래서 링크를 따라가 다시
                          읽는 것이 아니라 여기 적힌 것을 그대로 보여 준다.
                        */}
                        <div className="prep-evidences">
                          {(row.evidence ?? []).map((evidence, index) => (
                            <div className="prep-evidence" key={`${evidence.kind}-${index}`}>
                              <div className="prep-evidence-head">
                                <strong>{evidence.title}</strong>
                                <span>{evidence.at ? whenLabel(evidence.at) : ''}</span>
                              </div>
                              <div className="prep-evidence-row">
                                <div className="prep-evidence-text">
                                  <strong>{evidence.who}</strong>
                                  <span>{evidence.body}</span>
                                </div>
                                {/*
                                  `/flow-board` 가 `?edge=` 딥링크를 받게 되면서
                                  갈 곳이 생겼다 — 예전에는 여기서 눌리지 않는
                                  표시만 그렸다.
                                */}
                                {evidence.link ? (
                                  <AppLink className="prep-evidence-link" href={evidence.link}>
                                    바로가기
                                  </AppLink>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/*
                      이미 적은 것이 있어도 **고치기가 아니라 더 적기**다.
                      고치는 것은 그 카드의 `⋮ → 편집하기` 로만 한다 — 어느 글을
                      고치는지 카드를 짚고 시작해야 엉뚱한 답이 바뀌지 않는다.
                    */}
                    <button
                      className="prep-stance-open"
                      type="button"
                      onClick={() => startStance(row)}
                    >
                      {latest ? '내 입장 더 적기' : '내 입장 적기'}
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })}

        </section>

        <section className="prep-stance" aria-labelledby="prep-stance-title">
          <div className="prep-section-head">
            <h2 id="prep-stance-title">나의 입장</h2>
            <p>논쟁점에 대한 생각을 자유롭게 작성해주세요.</p>
          </div>

          <div className="prep-input">
            <textarea
              ref={stanceInputRef}
              value={stanceText}
              rows={5}
              maxLength={2000}
              disabled={!openRow}
              placeholder={openRow
                ? `논쟁점 ${pad(openRow.order)}에 대한 생각을 작성해주세요.`
                : '왼쪽에서 논쟁점을 펼친 뒤 내 입장을 적어 주세요.'}
              onChange={(event) => setStanceText(event.target.value)}
            />
            <button
              className="prep-send"
              type="button"
              aria-label="입장 저장"
              disabled={!openRow || !stanceText.trim()}
              onClick={saveStance}
            >
              <SendIcon />
            </button>
          </div>

          {/*
            고른 논쟁점의 답변 **하나만** 둔다.

            적어 둔 것이 없으면 아무것도 두지 않는다 — `아직 없습니다` 같은 빈
            자리를 만들면, 그 자리가 늘 있는 탓에 답변이 있는 줄과 없는 줄이
            같은 높이로 보여 무엇을 아직 안 썼는지가 목록에서 사라진다.
            그 판단은 왼쪽 상태 뱃지가 이미 하고 있다.
          */}
          {groups.map((group) => {
            const row = rows.find((item) => item.id === group.rowId)

            return (
              <div className="prep-stance-saved" key={group.rowId}>
                <p className="prep-stance-label">논쟁점 {pad(row?.order ?? 0)}</p>
                <div className="prep-stance-cards">
                  {group.items.map((entry, index) => (
                  <div className="prep-stance-card" key={entry.id}>
                    <p>{entry.text}</p>

                    {/*
                      `⋮` 는 곧바로 고치지 않고 **무엇을 할지 먼저 묻는다.**
                      적어 둔 글이 한 번의 오조작으로 편집 상태가 되면, 다른 논쟁점을
                      보려던 사람이 자기 글을 건드린 줄 모른 채 지나간다.
                    */}
                    <div
                      className="prep-stance-menu-anchor"
                      ref={menuFor === entry.id ? menuRef : null}
                    >
                      <button
                        className="prep-stance-more"
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={menuFor === entry.id}
                        /*
                          한 논쟁점에 답이 여럿이라 **몇 번째 답인지까지 적는다.**
                          `논쟁점 01 입장 메뉴` 가 셋이면 화면을 못 보는 사람에게는
                          어느 글의 메뉴인지 가릴 방법이 없다. 위에서부터 세되,
                          맨 위가 가장 최근이므로 그것이 1 이다.
                        */
                        aria-label={group.items.length > 1
                          ? `논쟁점 ${pad(row?.order ?? 0)} ${index + 1}번째 입장 메뉴`
                          : `논쟁점 ${pad(row?.order ?? 0)} 입장 메뉴`}
                        onClick={() => setMenuFor(menuFor === entry.id ? null : entry.id)}
                      >
                        ⋮
                      </button>

                      {menuFor === entry.id ? (
                        <div className="prep-stance-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            autoFocus
                            onClick={() => editEntry(entry)}
                          >
                            <PencilIcon />
                            편집하기
                          </button>
                          {/*
                            지우는 길이 없으면 잘못 적은 입장을 **빈 칸으로
                            덮어쓸 수도 없다** — 서버가 빈 본문을 물리므로,
                            사람은 아무 말이나 채워 넣게 된다. 그 글을 대리인이
                            회의에서 그대로 말한다.
                          */}
                          <button
                            type="button"
                            role="menuitem"
                            className="is-danger"
                            disabled={Boolean(busy)}
                            onClick={() => {
                              setMenuFor(null)
                              dropStance(entry.rowId)
                            }}
                          >
                            지우기
                          </button>
                        </div>
                      ) : null}
                    </div>
                </div>
                  ))}
                </div>
              </div>
            )
          })}
        </section>
      </div>

      <hr className="prep-divider" />

      <section className="prep-settings" aria-labelledby="prep-settings-title">
        <div className="prep-section-head">
          <h2 id="prep-settings-title">Bordo 활동 설정</h2>
          <p>
            이번 회의에서 Bordo가 어떻게 행동할지 설정해주세요.
            <br />
            기존 설정을 불러오거나 이번 회의에 맞게 수정할 수 있어요.
          </p>
        </div>

        {/*
          안내를 **누른 자리에도** 띄운다.

          `적용하기` 는 페이지 한참 아래에 있는데 맡겼다는 안내는 화면 맨 위에만
          떴다. 누르고 나면 눈앞에 변화가 없어 **한 번 더 누르게 된다.**

          위쪽 것을 없애지는 않는다. 논쟁점을 보다가 맡긴 사람은 그쪽을 본다.
        */}
        {notice ? (
          <p className="prep-notice is-inline" role="status">{notice}</p>
        ) : null}

        <div className="prep-apply-row">
          <div className="prep-apply">
            <div>
              <strong>현재 설정 사용</strong>
              <span>평소 사용하던 설정을 적용합니다.</span>
            </div>
            {/*
              평소 설정은 고칠 것이 없으므로 **바로 맡긴다.** 펼쳐서 확인시키면
              아무것도 바꾸지 않을 사람에게 한 걸음을 더 걷게 한다.
            */}
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => { setCustomOpen(false); apply('current') }}
            >
              {busy === 'current' ? '적용 중…' : '적용하기 →'}
            </button>
          </div>

          <div className="prep-apply">
            <div>
              <strong>이번에만 다르게 사용</strong>
              <span>평소 사용하던 설정을 편집하여 일회성으로 적용합니다.</span>
            </div>
            {/*
              이쪽은 **펼치기만 한다.** 여기서 곧바로 저장하면 `편집하여 일회성으로
              적용합니다` 라고 해 놓고 편집할 기회를 주지 않는 셈이다. 무엇을
              바꿨는지 보고 `설정 완료` 로 맺는다.
            */}
            <button
              type="button"
              aria-expanded={customOpen}
              aria-controls="prep-custom-panel"
              disabled={Boolean(busy)}
              onClick={() => {
                setCustomOpen(true)
                // 펼친 자리로 데려간다. 접혀 있던 것이 아래에 열리면 화면 밖에서
                // 열려, 눌렀는데 아무 일도 안 일어난 것처럼 보인다.
                window.requestAnimationFrame(
                  () => panelRef.current?.scrollIntoView({ block: 'nearest' }))
              }}
            >
              {customOpen ? '편집 중' : '적용하기 →'}
            </button>
          </div>
        </div>

        {/*
          세부 설정은 **접어 둔다** (시안 `692:7689`).

          이 화면에 처음 온 사람이 해야 하는 일은 대리 참석을 맡기는 것 하나다.
          그런데 여섯 줄짜리 설정판이 늘 펼쳐져 있으면 그것부터 읽어야 할 것으로
          보이고, 평소 설정 그대로 맡기면 되는 사람까지 붙잡는다.
        */}
        {customOpen ? (
        <div className="prep-panel" id="prep-custom-panel" ref={panelRef}>
          <div className="prep-detail">
            <h3>세부 설정</h3>
            <div className="prep-detail-rows">
              {[...BEHAVIOR_ROWS, ...SOURCE_ROWS].map((row) => (
                <div className="prep-detail-row" key={row.key}>
                  <div>
                    <strong>{row.label}</strong>
                    <span>{row.hint}</span>
                  </div>
                  <Switch
                    label={row.label}
                    on={Boolean(applied?.[row.key])}
                    disabled={!applied}
                    onChange={(next) => set(row.key, next)}
                  />
                </div>
              ))}
            </div>

            <p className="prep-scope-note">
              위 세 줄은 아직 회의별로 저장되지 않습니다 — 이 회의에도{' '}
              <AppLink href="/account">개인 설정</AppLink>의 값이 적용됩니다.
              아래 네 줄은 이 회의에만 적용됩니다.
            </p>
          </div>

          <div className="prep-prompts">
            <h3>시스템 프롬프트</h3>
            {(setup?.standing_prompts ?? []).map((row) => (
              <div className="prep-prompt-card" key={row.id}>
                <p>{row.body}</p>
              </div>
            ))}
            {!(setup?.standing_prompts ?? []).length ? (
              <p className="prep-empty-inline">저장해 둔 지시가 아직 없습니다.</p>
            ) : null}
          </div>
        </div>
        ) : null}

        <div className="prep-extra">
          <div className="prep-section-head">
            <h3>추가 설정</h3>
            <p>새로운 설정을 일회성으로 적용합니다.</p>
          </div>
          <div className="prep-input">
            <textarea
              value={extraPrompt}
              disabled={!setup}
              rows={2}
              maxLength={1000}
              placeholder="원하시는 설정을 입력해주세요."
              onChange={(event) => { setExtraDraft(event.target.value); setNoteSaved(false) }}
            />
          </div>
          {/*
            **적은 자리에 저장 단추를 둔다.**

            전에는 저장할 단추가 `이번에만 다르게 사용` 을 눌렀을 때만 나왔다.
            `현재 설정 사용` 으로 맡긴 사람은 추가 지시를 적어 놓고 나가면
            **그대로 사라졌다** — 적는 칸은 늘 열려 있는데 담을 곳이 그때만
            있었던 셈이다.
          */}
          <div className="prep-extra-actions">
            <button
              type="button"
              className="prep-extra-save"
              disabled={!setup || Boolean(busy) || extraPrompt === (setup?.extra_note ?? '')}
              onClick={saveExtraNote}
            >
              {busy === 'note' ? '저장하는 중…' : '추가 설정 저장'}
            </button>
            {noteSaved ? <span className="prep-extra-saved" role="status">저장했습니다</span> : null}
          </div>
          <p className="prep-scope-note">
            적으신 내용은 <strong>추가 설정 저장</strong>으로 이 회의에만 남습니다.
            <strong> 현재 설정 사용</strong>을 누르면 평소 설정으로 되돌아가면서 함께 지워집니다.
          </p>
        </div>

        {/*
          펼친 것을 맺는 자리.

          펼쳐져 있을 때만 둔다. 늘 두면 `적용하기` 와 뜻이 겹쳐, 어느 것을 눌러야
          맡겨지는지가 둘로 갈린다.
        */}
        {customOpen ? (
          <button
            className="prep-done"
            type="button"
            disabled={Boolean(busy)}
            onClick={async () => {
              // 실패하면 펼친 채로 둔다. 접어 버리면 무엇을 고쳐 놨는지가
              // 사라져, 다시 열어 처음부터 맞춰야 한다.
              if (await apply('once')) {
                setCustomOpen(false)
              }
            }}
          >
            {busy === 'once' ? '맡기는 중…' : '설정 완료'}
          </button>
        ) : null}

        {delegated ? (
          <button className="prep-cancel" type="button" disabled={Boolean(busy)} onClick={cancel}>
            {busy === 'cancel' ? '취소하는 중…' : '대리 참석 취소'}
          </button>
        ) : null}
      </section>

      {showComplete ? (
        <CompleteModal remaining={remainingPoints} onClose={() => setShowComplete(false)} />
      ) : null}
    </PrepShell>
  )
}
