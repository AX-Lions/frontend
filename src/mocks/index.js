import { appendTo, patch, patchedOf, withAppended } from './store.js'

/**
 * 주소 하나를 가상 데이터로 답한다.
 *
 * ## 왜 `api.js` 한 곳에서 가로채는가
 *
 * 화면마다 조회 함수를 가짜로 바꾸면 **바꾼 곳만 가짜가 되고 안 바꾼 곳은
 * 진짜를 부른다.** 그러면 서버가 없을 때 화면 절반만 뜨는, 진짜도 가짜도
 * 아닌 상태가 된다. 모든 호출이 `request()` 하나를 지나가므로 거기서 한 번만
 * 가른다.
 *
 * ## 모르는 주소는 조용히 넘기지 않는다
 *
 * 표에 없는 주소는 **오류로 답한다.** 그냥 빈 값을 주면 화면은 "데이터가
 * 없다" 로 그리고, 보는 사람은 가상 데이터가 부족한 것인지 화면이 고장 난
 * 것인지 구별하지 못한다. 이 저장소에서 반복된 실패 모양이 그것이라
 * (요청은 나가는데 받는 쪽이 자기 것으로 세지 않는 것), 여기서는 드러낸다.
 *
 * ## 쓰기는 흉내만 낸다
 *
 * `POST` · `PATCH` · `DELETE` 는 대부분 보낸 것을 그대로 돌려준다. 화면이
 * 낙관적 갱신을 하고 있어서 그것만으로 눌리는 느낌이 난다. 가상 데이터를
 * 진짜로 고쳐 두지는 않는다 — 새로고침하면 처음으로 돌아간다. **가짜를
 * 오래 붙잡아 두면 진짜처럼 믿게 된다.**
 */

import {
  viewerAgentPrompts, viewerAgentSettings, viewerBriefing, viewerConversationMessages,
  viewerConversations, viewerHome, viewerMe, viewerSidebar, viewerTeams,
} from './perspective.js'
import {
  meetingIndexes, meetings, projectMeetings, summaryTables, workIndexes,
} from './data/meetings.js'
import { flowEdges, meetingFlows, projectFlows } from './data/flow.js'
import { PREP_STATUS_LABEL, preps } from './data/prep.js'
import { teamMembers } from './data/home.js'
import {
  activeDates, chatCandidates, chatImportant, chatRooms,
  dailySummaries, roomDetails, roomMessages,
} from './data/chat.js'

/** 서버 왕복처럼 보이게 아주 잠깐 기다린다. */
const DELAY = 120

const EMPTY = { count: 0, results: [] }

/**
 * 표에 없는 주소.
 *
 * `api.js` 의 `ApiError` 와 **같은 모양**으로 만든다. 화면은 `error.code` 로
 * 분기하므로, 여기서 다른 모양을 던지면 화면이 오류를 못 알아본다.
 */
function notMocked(path) {
  const error = new Error(`가상 데이터에 없는 주소입니다: ${path}`)
  error.name = 'ApiError'
  error.code = 'MOCK_NOT_FOUND'
  error.details = { path }
  error.retryable = false
  error.status = 501
  return error
}


/**
 * 부르는 순서대로 늘어나는 번호.
 *
 * `Date.now()` 만 쓰면 같은 밀리초에 만든 둘이 **같은 id** 가 되어, 화면이
 * 목록을 그릴 때 React 가 둘을 같은 것으로 보고 하나만 그린다. 사용자 말과
 * 대리인 답을 연달아 만드는 자리라 실제로 겹친다.
 */
let seq = 0
function nextId() {
  seq += 1
  return `${Date.now()}-${seq}`
}

/**
 * 가상 대리인의 답.
 *
 * 무엇을 물어도 같은 말을 한다. 진짜처럼 답하려면 모델이 필요한데, 여기는
 * **서버가 없을 때 화면을 보는 자리**다. 다만 아무 말도 안 하면 화면이
 * `답을 준비하고 있습니다` 에서 멈춰, 대리인이 고장 난 것처럼 보인다.
 *
 * 답에 유보를 넣어 둔다 — 유보는 실패가 아니라 이 서비스의 차별점이고,
 * 화면이 그것을 어떻게 그리는지 볼 수 있어야 한다.
 */
const AGENT_REPLY = '가상 데이터 모드라 실제로 찾아보지는 못했습니다. '
  + '진짜 서버에서는 이 질문에 회의 기록과 작업 기록을 근거로 답하고, '
  + '근거가 모자라면 지어내지 않고 본인 확인이 필요하다고 남깁니다.'

/**
 * 이번에 등록한 불참을 홈 응답에 비춘다.
 *
 * 저장은 됐는데 홈이 그것을 안 읽으면 버튼이 `회의에 참여하지 않아요` 그대로라,
 * 사용자는 저장이 안 된 줄 알고 다시 누른다.
 */
function applyDelegations(home) {
  const today = (home.today_schedule ?? []).map((s) => {
    const saved = s.meeting_id ? patchedOf(`delegate:${s.meeting_id}`) : null
    return saved ? { ...s, delegation: { ...s.delegation, ...saved } } : s
  })
  return { ...home, today_schedule: today }
}

/**
 * 준비 화면에 이번에 저장한 것을 얹는다.
 *
 * **여기가 이 화면에서 제일 자주 어긋나는 자리다.** 입장을 쓰면 화면이 곧바로
 * 서버를 다시 읽는데, 저장한 것을 안 얹으면 방금 쓴 글이 그 자리에서 사라진다.
 * 오류도 안내도 없어서, 사용자는 저장이 안 된 것인지 화면이 고장 난 것인지
 * 구별하지 못한다.
 */
function livePrep(meetingId) {
  const base = preps[meetingId]
  if (!base) {
    return null
  }

  const absence = patchedOf(`absence:${meetingId}`)
  const delegated = absence ? absence.delegated : base.header.delegated
  const setup = { ...base.agent_setup, ...(patchedOf(`setup:${meetingId}`) ?? {}) }

  const points = base.debate.points.map((point) => {
    const saved = patchedOf(`stance:${point.id}`)
    if (!saved) {
      return point
    }
    // 지운 경우다. `null` 을 얹어 `답변필요` 로 되돌린다.
    const stance = saved.body ? {
      id: `stance-${point.id}`,
      option_key: saved.option_key ?? null,
      body: saved.body,
      updated_at: saved.updated_at,
    } : null
    const status = stance ? 'ANSWERED' : 'NEEDED'
    return { ...point, stance, status, status_label: PREP_STATUS_LABEL[status] }
  })

  return {
    header: {
      ...base.header,
      delegated,
      badge: delegated ? 'Bordo 대리 참석 예정' : '참석 예정',
    },
    debate: {
      ...base.debate,
      points,
      answered_count: points.filter((one) => one.status === 'ANSWERED').length,
    },
    agent_setup: setup,
  }
}

/** `/meetings/{id}/flow` 처럼 id 가 낀 주소를 가른다. */
function segments(path) {
  return path.split('?')[0].split('/').filter(Boolean)
}

function resolve(path, method, body) {
  const s = segments(path)
  const [a, b, c] = s

  if (method === 'GET') {
    if (path === '/home') {
      // 불참 등록이 홈에 비쳐야 버튼이 `대리 참석 중` 으로 바뀐다.
      return applyDelegations(viewerHome())
    }
    if (path === '/auth/me' || path === '/users/me') return viewerMe()
    if (path === '/teams') return viewerTeams()
    // 새 프로젝트 팝업의 `참여자 선택` 후보.
    if (a === 'teams' && c === 'members') return teamMembers

    if (a === 'meetings' && b && !c) return meetings[b] ?? null
    if (a === 'meetings' && c === 'prep') return livePrep(b)
    if (a === 'meetings' && c === 'flow') return meetingFlows[b] ?? null
    if (a === 'meetings' && c === 'summary-table') return summaryTables[b] ?? null
    if (a === 'meetings' && c === 'ai-briefing') return viewerBriefing(b)
    if (a === 'meetings' && c === 'indexes') {
      // 회의 안건과 작업 문서는 같은 주소에 `category` 로 갈린다.
      const work = /category=WORK/.test(path)
      const detail = meetings[b]
      return work
        ? (workIndexes[detail?.project_id] ?? EMPTY)
        : (meetingIndexes[b] ?? EMPTY)
    }

    if (a === 'projects' && c === 'flow') return projectFlows[b] ?? null
    if (a === 'projects' && c === 'meetings') return projectMeetings[b] ?? EMPTY

    if (a === 'flow-edges' && b) return flowEdges[b] ?? null

    if (path === '/chat/sidebar') return viewerSidebar()
    if (path.startsWith('/chat/important')) return chatImportant
    if (path.startsWith('/chat/candidates')) return chatCandidates
    if (a === 'chat' && b === 'rooms' && !c) return chatRooms
    if (a === 'chat' && b === 'rooms' && c && !s[3]) return roomDetails[c] ?? null
    if (a === 'chat' && b === 'rooms' && s[3] === 'messages') {
      const base = roomMessages[c] ?? { results: [], next_before: null, has_older: false, has_newer: false }
      // 이번 방문에 보낸 말을 뒤에 잇는다. 안 이으면 화면이 다시 읽는 순간
      // 방금 보낸 말이 사라진다.
      return { ...base, results: withAppended(`room:${c}`, base.results ?? []) }
    }
    if (a === 'chat' && b === 'rooms' && s[3] === 'active-dates') return activeDates[c] ?? null
    if (a === 'chat' && b === 'rooms' && s[3] === 'daily-summary') {
      const date = new URLSearchParams(path.split('?')[1] || '').get('date')
      return dailySummaries[`${c}|${date}`] ?? { date, one_line: '', my_todos: [], schedules: [], generated_at: null, message_count: 0, status: 'EMPTY' }
    }
    if (a === 'chat' && b === 'rooms' && s[3] === 'search') return { count: 0, results: [] }

    if (path === '/me/agent/settings') {
      // 이번에 고친 것을 덮어 얹는다. 안 얹으면 말투를 바꾸고 화면을 다시
      // 읽는 순간 원래대로 돌아간다.
      return { ...viewerAgentSettings(), ...(patchedOf('agent-settings') ?? {}) }
    }
    if (path === '/me/agent/prompts') return viewerAgentPrompts()
    if (path === '/me/agent/conversations') return viewerConversations()
    if (a === 'me' && s[2] === 'conversations' && s[4] === 'messages') {
      const base = viewerConversationMessages(s[3]) ?? { results: [], next_before: null }
      /*
        **여기가 제일 중요하다.** `AgentDock` 은 보낸 뒤 3초마다 이 목록을
        다시 읽어 화면을 통째로 갈아 끼운다. 이번에 보낸 것을 안 이으면
        내 말이 3초 뒤에 조용히 사라지고, 오류도 안내도 없어 사용자는
        자기 말이 안 갔는지 화면이 고장 났는지 구별하지 못한다.
      */
      return { ...base, results: withAppended(`conv:${s[3]}`, base.results ?? []) }
    }
  }

  /*
    쓰기.

    보낸 것을 그대로 돌려준다. 화면이 낙관적으로 먼저 고쳐 두므로 이것만으로
    눌리는 느낌이 난다. 다만 **가상 데이터를 진짜로 고치지는 않는다** —
    새로고침하면 처음으로 돌아간다. 가짜를 오래 붙잡아 두면 진짜처럼 믿게 된다.
  */
  if (method !== 'GET') {
    /*
      로그인도 서버 없이 된다.

      **아무 이메일·비밀번호나 통과한다.** 가상 데이터 모드는 서버가 없을 때
      쓰는 것이라 확인할 상대가 없다. 그래서 로그인 화면에서 이 모드를 켜면
      입력칸을 감추고 버튼 문구를 `가상 데이터로 둘러보기` 로 바꾼다 —
      **비밀번호를 받는 척하면서 아무거나 통과시키면 안 된다.**
    */
    if (path === '/auth/login' || path === '/auth/signup') {
      return {
        access_token: 'mock.access.token',
        refresh_token: 'mock.refresh.token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: viewerMe(),
      }
    }
    if (path === '/auth/logout') return null

    /*
      준비 화면의 쓰기 넷.

      **보낸 것을 담아 둔다.** 그냥 돌려주기만 하면 화면이 곧바로 다시 읽는
      순간 방금 쓴 것이 사라진다 — 이 화면은 저장할 때마다 `/prep` 을 통째로
      다시 읽기 때문에, 담아 두지 않으면 저장이 한 번도 눈에 보이지 않는다.
    */
    if (a === 'meetings' && c === 'absence') {
      patch(`absence:${b}`, { delegated: method === 'POST' })
      return method === 'DELETE' ? null : { delegated: true }
    }
    if (a === 'meetings' && c === 'agent-setup') {
      const base = preps[b]?.agent_setup
      if (!base) {
        return null
      }
      /*
        서버 규칙을 그대로 흉내 낸다.

        `mode: "STANDING"` 은 **되돌리기**라 회의별 덮어쓰기를 통째로 지우고,
        `mode` 를 안 보내면 **보낸 키만** 바뀐다. 여기서 전량 교체로 두면
        가상 데이터에서만 지시가 안 지워지고 실서버에서는 지워진다 — 가상
        데이터가 실서버보다 관대하면 확인하는 의미가 없다.
      */
      if (body?.mode === 'STANDING') {
        patch(`setup:${b}`, {
          mode: 'STANDING',
          mode_label: '현재 설정 사용',
          settings: base.standing_settings,
          overridden_keys: [],
          extra_note: '',
          sources: null,
        })
      } else {
        const next = {}
        if (body?.settings) {
          next.settings = { ...base.standing_settings, ...body.settings }
          next.overridden_keys = Object.keys(body.settings).sort()
          next.mode = 'ONCE'
          next.mode_label = '이번에만 다르게 사용'
        }
        if (body?.sources !== undefined) {
          next.sources = body.sources
        }
        if (body?.extra_note !== undefined) {
          next.extra_note = body.extra_note
        }
        patch(`setup:${b}`, next)
      }
      return { ...base, ...(patchedOf(`setup:${b}`) ?? {}) }
    }
    if (a === 'debate-points' && c === 'stance') {
      patch(`stance:${b}`, {
        body: method === 'DELETE' ? '' : (body?.body ?? ''),
        option_key: body?.option_key || null,
        updated_at: new Date().toISOString(),
      })
      return method === 'DELETE' ? null : { id: `stance-${b}`, ...body }
    }
    if (a === 'chat' && s[3] === 'read') return null
    if (path === '/me/briefing-dismiss') return { dismissed: true }

    /*
      채팅 메시지.

      **`sent_at` 이 반드시 있어야 한다.** 없으면 화면이 `new Date(undefined)`
      로 날짜 구분선을 만들려다 렌더 도중에 터지고, 채팅 화면 전체가 오류
      화면으로 바뀐다. 입력한 말도 같이 사라진다.
    */
    if (a === 'chat' && b === 'rooms' && s[3] === 'messages') {
      return appendTo(`room:${c}`, {
        id: `mock-msg-${nextId()}`,
        room_id: c,
        sender_id: viewerMe().id,
        sender_name: viewerMe().name,
        is_mine: true,
        body: body?.body ?? '',
        sent_at: new Date().toISOString(),
        is_important: false,
        confirmed_at: null,
        edited_at: null,
        attachments: [],
      })
    }

    /*
      대리인 대화.

      사용자 메시지를 담아 두고, **대리인 답도 만들어 둔다.** 화면이 3초마다
      다시 읽으며 마지막이 사용자 말이면 계속 기다리는데, 답이 영영 안 오면
      30초 뒤 `대리인이 아직 답하지 않았습니다` 로 끝난다. 가상 데이터에서
      대리인이 입을 다무는 것은 보여 줄 상태가 아니다.
    */
    if (a === 'me' && s[2] === 'conversations' && s[4] === 'messages') {
      const key = `conv:${s[3]}`
      const mine = appendTo(key, {
        id: `mock-msg-${nextId()}`,
        role: 'USER',
        body: body?.body ?? '',
        sent_at: new Date().toISOString(),
        run: null,
      })
      appendTo(key, {
        id: `mock-msg-${nextId()}`,
        role: 'AGENT',
        body: AGENT_REPLY,
        sent_at: new Date().toISOString(),
        run: { status: 'DONE', run_id: `mock-run-${nextId()}` },
      })
      return { ...mine, run: { status: 'RECEIVED', run_id: null } }
    }

    // 대리인 설정. 부분 갱신이라 **보낸 것만** 얹는다 — 통째로 돌려주면
    // 안 보낸 스위치가 전부 꺼지고 대리인 이름이 지워진다.
    if (path === '/me/agent/settings') {
      return { ...viewerAgentSettings(), ...patch('agent-settings', body ?? {}) }
    }

    // 불참 등록. 홈이 이것을 읽어 버튼을 `대리 참석 중` 으로 바꾼다.
    if (a === 'meetings' && c === 'delegate') {
      const saved = patch(`delegate:${b}`, {
        delegated: body?.enabled !== false,
        prompt: body?.prompt ?? '',
        sources: body?.sources ?? null,
      })
      return { meeting_id: b, ...saved }
    }

    /*
      새 팀 · 새 프로젝트.

      기본 응답(`{...body, id}`)으로 두면 **화면이 읽는 칸이 비어 있다.** 홈은
      만든 프로젝트를 목록 맨 위에 얹는데 `progress` 가 없으면 진행률 막대가
      `NaN%` 로 그려지고, 팀 목록은 `name` 만 있고 `my_role` 이 없다.
      서버가 돌려주는 모양대로 채워 준다.
    */
    if (path === '/teams') {
      return {
        id: `mock-team-${nextId()}`,
        name: body?.name ?? '새 팀',
        description: body?.description ?? '',
        created_by: viewerMe().id,
        my_role: 'OWNER',
        categories: [],
        member_count: 1,
        created_at: new Date().toISOString(),
      }
    }

    if (a === 'teams' && c === 'projects') {
      return {
        id: `mock-project-${nextId()}`,
        team_id: b,
        name: body?.name ?? '새 프로젝트',
        description: body?.description ?? '',
        progress: 0,
        is_favorite: false,
        member_count: body?.member_ids?.length ?? teamMembers.count,
        group_chat_room_id: null,
        created_at: new Date().toISOString(),
        last_opened_at: null,
      }
    }

    /*
      초대 코드.

      **모양을 서버와 맞춘다**(`BRD-A1B2-C3D4`). 화면이 이 코드를 복사해 주는데,
      가상 데이터에서만 다른 모양이면 붙여 넣는 쪽 검사 규칙을 못 밟는다.
    */
    if (a === 'teams' && c === 'invite-codes') {
      const block = () => Math.floor(1000 + Math.random() * 8999).toString(36).toUpperCase().slice(0, 4).padEnd(4, 'X')
      return {
        code: `BRD-${block()}-${block()}`,
        team_id: b,
        default_role: 'MEMBER',
        max_uses: body?.max_uses ?? 10,
        used_count: 0,
        expires_at: new Date(Date.now() + 72 * 3600_000).toISOString(),
      }
    }

    return { ...(body ?? {}), id: `mock-${nextId()}`, ok: true }
  }

  return undefined
}

/**
 * 화면이 보낸 쿼리를 주소에 붙인다.
 *
 * `api.get(path, params, options)` 은 쿼리를 **`path` 가 아니라 `params` 로**
 * 넘긴다. URL 조립은 진짜 요청을 보내는 `send()` 가 하는데, 가상 모드는 그
 * 함수를 건너뛰므로 여기서 같은 일을 해 줘야 한다.
 *
 * 이걸 빠뜨려서 `category=WORK` · `date=` · 필터가 전부 mock 에 안 닿았다.
 * 작업 모드에 회의 안건이 뜨고, 날짜 요약이 늘 비고, 필터를 만져도 판이
 * 그대로였다 — **요청은 나가는데 받는 쪽이 자기 것으로 세지 않은 것**이다.
 */
function withQuery(path, params) {
  const entries = Object.entries(params ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!entries.length) {
    return path
  }
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))
  return `${path}${path.includes('?') ? '&' : '?'}${search}`
}

export async function serveMock(path, { method = 'GET', body, params } = {}) {
  const data = resolve(withQuery(path, params), method, body)
  if (data === undefined) {
    throw notMocked(path)
  }
  await new Promise((done) => { window.setTimeout(done, DELAY) })
  return data
}
