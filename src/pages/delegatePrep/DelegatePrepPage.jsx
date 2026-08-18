import { useEffect, useRef, useState } from 'react'

import { AppLink } from '../../app/AppLink.jsx'
import { useSearchParam } from '../../app/navigation.js'
import { cacheKeyFor, evict } from '../../lib/resourceCache.js'
import { useResource } from '../../lib/useResource.js'
import { fetchAgentSettings } from '../account/account.data.js'
import { fetchHome } from '../home/home.api.js'
import { LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { fetchAgentPrompts, fetchMeeting, saveDelegation } from './delegatePrep.data.js'
import { STATUS_LABEL, fetchContentions } from './delegatePrep.mock.js'
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
 * ## 아직 서버에 없는 것이 있다
 *
 * 예상 논쟁점과 나의 입장은 백엔드에 없다. 형태만 `delegatePrep.mock.js` 에
 * 확정해 두고 화면을 먼저 세운다(`CLAUDE.md` 의 순서). **없는 것을 있는 척하지
 * 않는다** — 화면이 그 자리에 예시임을 적는다.
 */

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

/**
 * `8월 18일`.
 *
 * 표시 문구는 되도록 서버가 만든다 — 화면마다 다른 낱말이 생기지 않게 하려는
 * 규약이고, 백엔드 `display.py` 가 그 자리다. 그런데 `today_schedule` 이 주는
 * 것은 `time_range`(`14:00 - 15:00`) 뿐이라 날짜를 붙일 데가 없다. 시안
 * (`692:7436`)은 날짜까지 요구하므로 여기서 만든다.
 *
 * **서버에 날짜 라벨 필드를 두는 편이 맞다.** 그러면 이 함수는 지운다.
 */
function dayLabel(iso) {
  if (!iso) {
    return ''
  }
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? '' : `${at.getMonth() + 1}월 ${at.getDate()}일`
}

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

export function DelegatePrepPage() {
  const meetingId = useSearchParam('meeting')

  /*
    회의 정보는 홈이 이미 들고 있다.

    `today_schedule` 안에 제목·시각·장소와 **지금 내 대리 참석 상태**가 다 있다.
    담아 둔 것을 그대로 읽으므로 홈에서 넘어온 사람에게는 요청이 하나도 안 나간다.
    주소로 바로 들어온 경우에만 회의를 따로 읽는다.
  */
  const home = useResource((signal) => fetchHome(signal), [], { cacheKey: 'home' })
  const scheduled = (home.data?.today_schedule ?? [])
    .find((row) => row.meeting_id === meetingId) ?? null
  const needsMeeting = Boolean(meetingId) && Boolean(home.data) && !scheduled

  const meeting = useResource(
    (signal) => (needsMeeting ? fetchMeeting(meetingId, signal) : Promise.resolve(null)),
    [meetingId, needsMeeting],
  )

  const agent = useResource((signal) => fetchAgentSettings(signal), [],
    { cacheKey: 'agent-settings' })
  const prompts = useResource((signal) => fetchAgentPrompts(signal), [],
    { cacheKey: 'agent-prompts' })
  const contentions = useResource(() => fetchContentions(), [meetingId])

  const [openId, setOpenId] = useState(null)
  const [menuFor, setMenuFor] = useState(null)
  const [editing, setEditing] = useState(false)
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
  const seqRef = useRef(0)
  const [extraPrompt, setExtraPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const stanceInputRef = useRef(null)
  const menuRef = useRef(null)
  const panelRef = useRef(null)

  const settings = agent.data
  // `null` 은 고른 적 없음이라 전부다. `[]` 는 전부 끈 것이라 그대로 둔다.
  // 서버가 준 자료 범위. `null` 은 고른 적 없음이라 전부고, `[]` 는 전부 끈 것이다.
  const savedSources = scheduled?.delegation?.sources ?? ALL_SOURCES

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

  const delegated = Boolean(scheduled?.delegation?.delegated)
  const rows = contentions.data?.results ?? []
  const seedEntries = () => rows
    .filter((row) => row.my_stance)
    .map((row) => ({ id: `seed-${row.id}`, rowId: row.id, text: row.my_stance.text, seq: 0 }))

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
  const openRow = rows.find((row) => row.id === openId) ?? null
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
  const projectName = scheduled?.project_name ?? meeting.data?.project_name ?? ''
  const projectId = scheduled?.project_id ?? meeting.data?.project_id ?? null
  const teamName = (home.data?.project_progress ?? [])
    .find((row) => String(row.id) === String(projectId))?.team_name ?? ''
  const headline = [teamName, projectName].filter(Boolean).join(' · ')

  // 아랫줄은 **날짜 시각 · 장소**. 날짜가 빠지면 오늘 것인지 알 수 없다.
  const timeText = scheduled
    ? [[dayLabel(scheduled.at), scheduled.time_range].filter(Boolean).join(' '),
      scheduled.location].filter(Boolean).join(' · ')
    : ''

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
    setEditing(false)
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
    setEditing(true)
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
      `현재 설정 사용` 은 평소 값으로 되돌린 뒤 저장한다.

      화면에서 만지던 것을 남겨 두면 무엇이 적용됐는지가 화면과 어긋난다.
      전역에는 작업·계획·생각이 **한 칸**(`disclose_work_plan_thought`)이라 셋이
      같이 움직인다. 프로젝트 문서는 전역에 대응하는 칸이 없어 그대로 둔다.
    */
    const next = mode === 'current' && settings
      ? {
        mention_feasibility: settings.mention_feasibility,
        allow_schedule_change: settings.allow_schedule_change,
        allow_midmeeting_question: settings.allow_midmeeting_question,
        work: settings.disclose_work_plan_thought,
        plan: settings.disclose_work_plan_thought,
        thought: settings.disclose_work_plan_thought,
        document: applied.document,
      }
      : applied

    try {
      await saveDelegation(meetingId, {
        enabled: true,
        // 순서를 화면 순으로 맞춰 보낸다. 고른 순서대로 보내면 같은 조합인데
        // 응답이 매번 다른 순서로 와서 다시 열 때 칸 순서가 흔들린다.
        sources: ALL_SOURCES.filter((key) => next[key]),
        prompt: extraPrompt.trim(),
        behavior: {
          mention_feasibility: next.mention_feasibility,
          allow_schedule_change: next.allow_schedule_change,
          allow_midmeeting_question: next.allow_midmeeting_question,
        },
      })
      setDraft(next)
      // 홈이 담아 둔 것을 버린다. 안 버리면 돌아갔을 때 버튼이 아직
      // `회의에 참여하지 않아요` 로 남아 등록이 안 된 것처럼 보인다.
      evict(cacheKeyFor('home', []))
      home.reload()
      setNotice(mode === 'current'
        ? '평소 설정으로 Bordo에게 맡겼습니다.'
        : '이번 회의에만 적용해 Bordo에게 맡겼습니다.')
      return true
    } catch (caught) {
      setError(caught?.message || '적용하지 못했습니다.')
      return false
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
      // 취소에서도 지시를 함께 보낸다. 빼면 서버가 빈 문자열로 덮어써,
      // 껐다가 다시 켜는 사람이 사전 지시를 잃는다.
      await saveDelegation(meetingId, {
        enabled: false,
        sources: ALL_SOURCES.filter((key) => applied?.[key]),
        prompt: extraPrompt.trim(),
      })
      evict(cacheKeyFor('home', []))
      home.reload()
      setNotice('대리 참석을 취소했습니다.')
    } catch (caught) {
      setError(caught?.message || '취소하지 못했습니다.')
    } finally {
      setBusy('')
    }
  }

  const saveStance = () => {
    const text = stanceText.trim()
    if (!openRow || !text) {
      return
    }
    /*
      **고칠 때만 덮는다.** 그냥 쓰면 한 장이 더 쌓인다.

      `seq` 는 목록 순서에만 쓴다. 시각을 쓰면 같은 초에 두 번 저장했을 때
      순서가 흔들리고, 그때마다 카드가 자리를 바꿔 앉는다.

      아직 서버에 보낼 곳이 없다. 화면 안에만 쌓아 두고, 저장 자리가 생기면
      여기 한 줄만 바꾼다.
    */
    seqRef.current += 1
    const seq = seqRef.current
    setWritten((current) => {
      const list = current ?? seedEntries()
      if (editingId) {
        return list.map((entry) => (entry.id === editingId ? { ...entry, text } : entry))
      }
      return [...list, { id: `local-${seq}`, rowId: openRow.id, text, seq }]
    })
    setStanceText('')
    setEditing(false)
    setEditingId(null)
  }

  if (!meetingId) {
    return (
      <PrepShell>
        <p className="prep-empty">어느 회의인지 알 수 없습니다. 홈에서 다시 눌러 주십시오.</p>
      </PrepShell>
    )
  }

  if (home.loading || agent.loading) {
    return <PrepShell><Loading label="회의를 여는 중입니다…" /></PrepShell>
  }

  if (home.error || agent.error) {
    return (
      <PrepShell>
        <LoadError
          error={home.error || agent.error}
          onRetry={() => { home.reload(); agent.reload() }}
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
          {delegated ? <span className="prep-badge">Bordo 대리 참석 예정</span> : null}
        </div>
      </header>

      {notice ? <p className="prep-notice" role="status">{notice}</p> : null}
      {error ? <p className="prep-error" role="alert">{error}</p> : null}

      <div className="prep-columns">
        <section className="prep-contentions" aria-labelledby="prep-contentions-title">
          <div className="prep-section-head">
            <h2 id="prep-contentions-title">예상 논쟁점</h2>
            <p>Bordo가 회의 자료와 이전 논의를 바탕으로 {rows.length}개의 논쟁점을 예상했어요.</p>
          </div>

          {contentions.loading ? <Loading label="논쟁점을 읽는 중입니다…" /> : null}

          {rows.map((row) => {
            const open = openId === row.id
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
            const answering = open && (!latest || editing)
            const status = answering
              ? 'ANSWERING'
              : (latest ? 'ANSWERED' : 'NEEDS_ANSWER')

            return (
              <article className={open ? 'prep-contention open' : 'prep-contention'} key={row.id}>
                {/*
                  줄 하나에 누를 것이 둘이라 **버튼을 겹치지 않게 나눈다.**
                  전에는 줄 전체가 버튼 하나였는데, 그 안에 상태 버튼을 넣으면
                  버튼 안의 버튼이 되어 어느 쪽이 눌린 것인지 브라우저마다
                  달라진다.
                */}
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
                    이미 답이 있으면 **고치기로 들어간다.**

                    빈 칸을 열면 옆에 적어 둔 글이 그대로 보이는 채로 새 칸이
                    뜬다 — 사용자는 그것을 고치는 칸으로 읽고 처음부터 다시
                    쓰거나, 덧붙여 쓰고는 앞의 글이 사라졌다고 여긴다.
                  */}
                  <button
                    className={`prep-status is-${status.toLowerCase()}`}
                    type="button"
                    aria-label={`논쟁점 ${pad(row.order)} ${STATUS_LABEL[status]}`
                      + ` — 내 입장 ${latest ? '고치기' : '쓰기'}`}
                    onClick={() => (latest ? editEntry(latest) : startStance(row))}
                  >
                    {STATUS_LABEL[status]}
                  </button>

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
                    {row.options.length ? (
                      <div className="prep-options">
                        {row.options.map((option) => (
                          <div className="prep-option" key={option.key}>
                            <strong>{option.label}</strong>
                            <span>{option.hint}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {row.prediction.rationale ? (
                      <div className="prep-prediction">
                        <p className="prep-prediction-head">
                          <span aria-hidden="true">✦</span> Bordo가 이렇게 예측했어요.
                        </p>
                        <p className="prep-prediction-body">{row.prediction.rationale}</p>

                        <div className="prep-evidences">
                          {row.prediction.evidences.map((evidence, index) => (
                            <div className="prep-evidence" key={`${evidence.kind}-${index}`}>
                              <div className="prep-evidence-head">
                                <strong>{evidence.label}</strong>
                                <span>{evidence.subtitle}</span>
                              </div>
                              <div className="prep-evidence-row">
                                <div className="prep-evidence-text">
                                  <strong>{evidence.actor}</strong>
                                  <span>{evidence.body}</span>
                                </div>
                                {/*
                                  갈 곳이 아직 없다. 링크로 두면 눌러서 아무 일도
                                  안 일어나거나 홈으로 튄다 — 눌리지 않는 표시로 둔다.
                                */}
                                {evidence.link ? (
                                  <span className="prep-evidence-link" aria-disabled="true">
                                    {evidence.link.label}
                                  </span>
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

          <p className="prep-mock-note">
            예상 논쟁점은 아직 서버에 없습니다. 화면 형태를 확정하기 위한 예시가 보이고 있습니다.
          </p>
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
            {prompts.loading ? <Loading label="불러오는 중입니다…" /> : null}
            {(prompts.data?.results ?? []).map((row) => (
              <div className="prep-prompt-card" key={row.id}>
                <p>{row.body}</p>
              </div>
            ))}
            {!prompts.loading && !(prompts.data?.results ?? []).length ? (
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
              rows={2}
              maxLength={1000}
              placeholder="원하시는 설정을 입력해주세요."
              onChange={(event) => setExtraPrompt(event.target.value)}
            />
          </div>
          <p className="prep-scope-note">
            적으신 내용은 <strong>{customOpen ? '설정 완료' : '적용하기'}</strong>를 누를 때
            이 회의의 사전 지시로 함께 저장됩니다.
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
    </PrepShell>
  )
}
