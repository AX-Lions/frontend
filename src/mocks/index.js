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
  viewerConversations, viewerHome, viewerMe, viewerMeetingPrepHeader, viewerSidebar, viewerTeams,
} from './perspective.js'
import {
  meetingIndexes, meetings, projectMeetings, summaryTables, workIndexes,
} from './data/meetings.js'
import { flowEdges, meetingFlows, projectFlows } from './data/flow.js'
import { PREP_STATUS_LABEL, preps } from './data/prep.js'
import { teamMembers } from './data/home.js'
import { inbox } from './data/inbox.js'
import { TEAM } from './data/people.js'
import { tasks } from './data/tasks.js'
import { calendarEvents } from './data/calendar.js'
import {
  activeDates, chatCandidates, chatRooms,
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
 * 가상 데이터 안에서 실제로 실패하는 요청.
 *
 * `notMocked` 와 달리 **주소는 있는데 값이 틀린 경우**다. `details` 를
 * 필드별 배열로 주면 화면이 그 칸 밑에 그대로 찍는다(`authErrors.js`).
 */
function mockError({ code, message, details, status = 422 }) {
  const error = new Error(message)
  error.name = 'ApiError'
  error.code = code
  error.details = details ?? {}
  error.retryable = false
  error.status = status
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
    /*
      준비 데이터를 안 만들어 둔 회의.

      **`null` 을 주면 화면이 통째로 오류가 된다.** 준비 화면은 회의 여덟 개
      어디서나 열 수 있는데 자세한 것은 셋만 채워 뒀다. 나머지는 헤더만 채우고
      「아직 예상된 논쟁점이 없어요」 로 그린다 — 실제로 그 회의는 예측이 아직
      안 돈 상태이므로 거짓말이 아니다.

      설정은 안 준다. 화면이 로딩으로 두고 기다린다 — **빈 객체를 주면 토글이
      전부 꺼진 것처럼 그려지는데** 그건 「아무것도 공개 안 함」 이라는 뜻이라
      실제와 정반대다.
    */
    const header = viewerMeetingPrepHeader(meetingId)
    return header ? {
      header,
      debate: {
        notice: '아직 예상된 논쟁점이 없어요. 회의 자료가 쌓이면 Bordo가 예상해 드려요.',
        count: 0,
        answered_count: 0,
        points: [],
      },
      agent_setup: null,
    } : null
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

/** 이번에 승인·반려한 태스크면 그 상태를 덮어 얹는다. */
function effectiveTask(id) {
  const base = tasks[id]
  return base ? { ...base, ...patchedOf(`task:${id}`) } : null
}

/**
 * 이번에 승인·반려한 것을 요청함 응답에 비춘다.
 *
 * `승인 필요` 줄의 숫자와 그 뒤에 붙은 태스크 id 목록은 정적 목이라, 승인
 * 팝업에서 하나를 처리해도 다시 읽으면 그대로다 — 처리한 태스크를
 * 걸러내야 뱃지 숫자가 줄고, 다음에 열었을 때 이미 끝난 태스크가 또 뜨지
 * 않는다.
 */
function applyTaskPatches(base) {
  const groups = base.groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      const pending = (item.pending_approval_task_ids ?? [])
        .filter((id) => effectiveTask(id)?.status === 'PENDING_APPROVAL')
      return {
        ...item,
        pending_approval_task_ids: pending,
        needs_approval: pending.length,
        urgent: item.needs_answer + item.needs_confirm + pending.length > 0,
      }
    }),
  }))
  return { ...base, groups }
}

/**
 * 이번에 읽은 방의 미읽음을 0 으로 접는다.
 *
 * `POST /chat/rooms/{id}/read` 는 성공만 돌려주고 사이드바 숫자는 그대로다
 * (`chat.js` 의 `unread_count` 가 모듈이 켜질 때 한 번 구운 값이라서). 화면이
 * `markRead` 뒤 사이드바를 다시 읽으면 **방금 읽은 방이 다시 미읽음으로
 * 보인다** — 방을 열었다 닫아도 안 읽힌 것처럼 남는다.
 *
 * 방 하나를 접으면 그 방이 속한 프로젝트·팀 합계도 다시 더해야 한다 — 안
 * 그러면 방 뱃지는 꺼졌는데 프로젝트·팀 뱃지는 그대로다.
 */
function applyReadPatches(sidebar) {
  const wasRead = (id) => Boolean(id) && Boolean(patchedOf(`room-read:${id}`))
  const zero = (room) => (wasRead(room.id) ? { ...room, unread_count: 0 } : room)

  const teams = (sidebar.teams ?? []).map((team) => {
    const originalProjectSum = (team.projects ?? [])
      .flatMap((p) => p.rooms ?? [])
      .reduce((sum, r) => sum + r.unread_count, 0)
    const projects = (team.projects ?? []).map((project) => {
      const rooms = (project.rooms ?? []).map(zero)
      return { ...project, rooms, unread_count: rooms.reduce((sum, r) => sum + r.unread_count, 0) }
    })
    const teamGroupUnread = wasRead(team.group_chat_room_id)
      ? 0
      : Math.max(0, team.unread_count - originalProjectSum)
    return {
      ...team,
      projects,
      unread_count: projects.reduce((sum, p) => sum + p.unread_count, 0) + teamGroupUnread,
    }
  })

  const directRooms = (sidebar.direct_rooms ?? []).map(zero)
  const myAgentRoom = sidebar.my_agent_room ? zero(sidebar.my_agent_room) : sidebar.my_agent_room

  return {
    ...sidebar,
    teams,
    direct_rooms: directRooms,
    my_agent_room: myAgentRoom,
    total_unread:
      teams.reduce((sum, t) => sum + t.unread_count, 0)
      + directRooms.reduce((sum, r) => sum + r.unread_count, 0)
      + (myAgentRoom?.unread_count ?? 0),
  }
}

/** 이번에 중요 표시·확인을 바꾼 메시지면 그 값을 덮어 얹는다. */
function applyMessagePatch(message) {
  const saved = patchedOf(`message:${message.id}`)
  return saved ? { ...message, ...saved } : message
}

/**
 * `GET /chat/important` 를 매번 다시 센다.
 *
 * 미리 구운 `chatImportant` 는 처음 상태 그대로다. `확인` 을 부르면 그
 * 메시지가 여기서 빠져야 하는데, 고정된 목록으로는 그럴 수가 없다 —
 * 확인을 눌러도(또는 방을 열어 자동으로 확인돼도) 목록이 그대로면
 * 사용자는 확인이 안 된 줄 알고 계속 누른다.
 */
function liveImportant() {
  const results = Object.values(roomMessages)
    .flatMap((response) => response.results)
    .map(applyMessagePatch)
    .filter((m) => m.is_important && !m.important_confirmed_at)
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
    .map((message) => ({ message, room: roomDetails[message.room_id] }))
  return { count: results.length, results }
}

/**
 * 팀 Discord 연결 상태(시안 `768:5926`).
 *
 * 실제 `GET .../discord/status` 에는 `guild_name` · `channels` 가 없다
 * (그 둘은 `POST .../discord/link` 응답에만 있다 — 봇이 스스로 채널을
 * 만들어서다). 여기서는 방금 연결한 것을 다시 읽었을 때도 화면이 서버
 * 이름을 잃지 않도록 함께 들고 있는다. 실서버로 가면 이 둘은 다시
 * `null` 로 보일 자리라, `TeamDiscordDialog` 는 없어도 되게 짜여 있다.
 */
function discordStatus(teamId) {
  const saved = patchedOf(`discord:${teamId}`)
  if (!saved?.connected) {
    return {
      connected: false, guild_id: null, guild_name: null, channels: null,
      bot_status: 'DISCONNECTED', warnings: [],
    }
  }
  return {
    connected: true,
    guild_id: saved.guild_id,
    guild_name: saved.guild_name,
    channels: saved.channels,
    bot_status: 'READY',
    warnings: [],
  }
}

/**
 * 회의 일정 달력(시안 `692:7910`)의 한 프로젝트 분.
 *
 * `from` · `to` (YYYY-MM-DD, 둘 다 있을 때만) 로 걸러 낸다 — 안 걸러 주면
 * 달력이 보이는 달과 무관하게 항상 같은 여섯 건만 보인다. 이번 방문에 만든
 * 일정은 `appendTo` 로 이어 붙인다.
 */
function projectCalendarEvents(projectId, from, to) {
  const all = withAppended(`calendar:${projectId}`, calendarEvents)
    .filter((e) => e.project_id === projectId)
  const ranged = from && to
    ? all.filter((e) => {
      const day = e.start_at.slice(0, 10)
      return day >= from && day <= to
    })
    : all
  return { count: ranged.length, results: ranged, range: { from: from ?? null, to: to ?? null } }
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
    // 팀 사이드바를 펼쳤을 때 · 팀 변경 팝오버의 미리보기가 같이 쓴다.
    if (a === 'teams' && c === 'projects') {
      const results = (viewerHome().project_progress ?? []).filter((p) => p.team_id === b)
      return { count: results.length, results }
    }

    if (a === 'teams' && c === 'discord' && s[3] === 'status') return discordStatus(b)

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

    if (a === 'projects' && c === 'calendar' && s[3] === 'events') {
      const query = new URLSearchParams(path.split('?')[1] || '')
      return projectCalendarEvents(b, query.get('from'), query.get('to'))
    }
    if (a === 'projects' && c === 'flow') return projectFlows[b] ?? null
    if (a === 'projects' && c === 'meetings') return projectMeetings[b] ?? EMPTY

    if (a === 'flow-edges' && b) return flowEdges[b] ?? null

    if (path === '/chat/sidebar') return applyReadPatches(viewerSidebar())
    if (path.startsWith('/chat/important')) return liveImportant()
    if (path.startsWith('/chat/candidates')) return chatCandidates
    if (a === 'chat' && b === 'rooms' && !c) return chatRooms
    if (a === 'chat' && b === 'rooms' && c && !s[3]) return roomDetails[c] ?? null
    if (a === 'chat' && b === 'rooms' && s[3] === 'messages') {
      const base = roomMessages[c] ?? { results: [], next_before: null, has_older: false, has_newer: false }
      // 이번 방문에 보낸 말을 뒤에 잇는다. 안 이으면 화면이 다시 읽는 순간
      // 방금 보낸 말이 사라진다. 중요 표시·확인을 바꾼 것도 같이 얹는다 —
      // 안 그러면 말풍선의 `확인` 버튼이 눌러도 그대로 남는다.
      const results = withAppended(`room:${c}`, base.results ?? []).map(applyMessagePatch)
      return { ...base, results }
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
    if (path === '/me/inbox') return applyTaskPatches(inbox)
    if (a === 'tasks' && b && !c) return effectiveTask(b)
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

    /*
      회원가입의 이메일 인증 · 초대 코드 확인(시안 `707:6492`).

      **백엔드에 아직 없는 주소다** — 이 화면 안에서만 흉내 낸다. 인증번호는
      실제로 보내지 않으므로 고정값 `123456` 을 받는다. 초대 코드는
      `BRD-XXXX-XXXX` 모양만 맞으면 통과시킨다(`home.api.js` 의
      `createInviteCode` 가 만드는 모양과 같다).
    */
    if (path === '/auth/signup/email-code') return { sent: true }
    if (path === '/auth/signup/email-code/confirm') {
      if (body?.code !== '123456') {
        throw mockError({
          code: 'INVALID_EMAIL_CODE',
          message: '인증번호가 올바르지 않습니다.',
          details: { code: ['인증번호가 올바르지 않습니다. (데모: 123456)'] },
        })
      }
      return { verified: true }
    }
    if (path === '/auth/signup/invite-code/verify') {
      if (!/^BRD-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(body?.code ?? '')) {
        throw mockError({
          code: 'INVALID_INVITE_CODE',
          message: '유효하지 않은 초대 코드입니다.',
          details: { code: ['유효하지 않은 초대 코드입니다. (데모: BRD- 뒤에 4자리-4자리)'] },
        })
      }
      return { valid: true, team_name: TEAM.name }
    }
    if (a === 'chat' && s[3] === 'read') {
      patch(`room-read:${c}`, { read: true })
      return null
    }

    /*
      중요 표시 · 확인.

      **표시를 내리면 확인 기록도 같이 지운다.** 서버 규칙이 그렇다 — 다시
      중요로 찍히면 또 확인해야 한다. 여기서 안 지우면 껐다 켠 메시지가
      확인도 안 했는데 `중요 채팅` 에서 빠진 채로 남는다.
    */
    if (a === 'chat' && b === 'messages' && s[3] === 'important' && !s[4]) {
      return patch(`message:${c}`, {
        is_important: body?.is_important,
        ...(body?.is_important ? {} : { important_confirmed_at: null }),
      })
    }
    if (a === 'chat' && b === 'messages' && s[3] === 'important' && s[4] === 'confirm') {
      return patch(`message:${c}`, { important_confirmed_at: new Date().toISOString() })
    }

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

    /*
      태스크 승인 · 반려(승인 필요 상세 내용 팝업, 시안 `701:5558`).

      `POST /tasks/{id}/approve|reject` 는 실제로 붙어 있는 주소다(백엔드
      `apps/tasks/views.py`). 요청함의 `승인 필요` 줄이 여기로 이어진다.
    */
    if (a === 'tasks' && c === 'approve') {
      const before = effectiveTask(b)
      if (!before) {
        throw notMocked(path)
      }
      const saved = patch(`task:${b}`, { status: 'TODO' })
      return {
        ...before,
        ...saved,
        previous_status: 'PENDING_APPROVAL',
        approved_by: viewerMe().id,
        approved_at: new Date().toISOString(),
      }
    }
    if (a === 'tasks' && c === 'reject') {
      const before = effectiveTask(b)
      if (!before) {
        throw notMocked(path)
      }
      if (!body?.reason?.trim()) {
        throw mockError({
          code: 'VALIDATION_ERROR',
          message: '반려 사유를 입력해 주십시오.',
          details: { reason: ['반려 사유를 입력해 주십시오.'] },
        })
      }
      patch(`task:${b}`, { status: 'REJECTED' })
      return {
        id: b,
        status: 'REJECTED',
        previous_status: 'PENDING_APPROVAL',
        rejected_by: viewerMe().id,
        reason: body.reason.trim(),
        rejected_at: new Date().toISOString(),
      }
    }

    /*
      팀 Discord 연결 · 해제(시안 `768:5926`).

      `connect_code` 는 실제로는 Discord 봇의 `/deputy-connect` 로만 받을 수
      있는 1회용 코드라 여기서는 값만 있으면 통과시킨다 — 화면이 어떤
      코드를 받고 서버를 연결하는지 보여 주는 자리이지, 진짜 봇과 잇는
      자리가 아니다.
    */
    if (a === 'teams' && c === 'discord' && s[3] === 'link') {
      if (method === 'DELETE') {
        patch(`discord:${b}`, {
          connected: false, guild_id: null, guild_name: null, channels: null,
        })
        return { team_id: b, unlinked_at: new Date().toISOString(), dropped_outbox_count: 0 }
      }
      if (!body?.connect_code?.trim()) {
        throw mockError({
          code: 'VALIDATION_ERROR',
          message: '연결 코드를 입력해 주십시오.',
          details: { connect_code: ['연결 코드를 입력해 주십시오.'] },
        })
      }
      const saved = patch(`discord:${b}`, {
        connected: true,
        guild_id: body.guild_id?.trim() || null,
        guild_name: body.guild_id?.trim() ? '가상 데이터 서버' : null,
        channels: body.guild_id?.trim()
          ? { meeting: { id: 'mock-channel-meeting', name: 'general' } }
          : null,
      })
      return {
        linked: true,
        team_id: b,
        user_id: viewerMe().id,
        discord_user_id: `mock-discord-${viewerMe().id}`,
        guild_id: saved.guild_id,
        guild_name: saved.guild_name,
        channels: saved.channels,
        permissions_ok: true,
        linked_at: new Date().toISOString(),
      }
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

    if (a === 'projects' && c === 'calendar' && s[3] === 'events') {
      return appendTo(`calendar:${b}`, {
        id: `mock-event-${nextId()}`,
        project_id: b,
        title: body?.title ?? '새 일정',
        kind: 'MEETING',
        start_at: body?.start_at,
        end_at: body?.end_at ?? body?.start_at,
        status: 'SCHEDULED',
        participant_ids: body?.participant_ids ?? [],
        related_meeting: null,
        discord_notified: false,
      })
    }

    if (a === 'projects' && c === 'meetings') {
      return {
        id: `mock-meeting-${nextId()}`,
        project_id: b,
        title: body?.title ?? '새 회의',
        scheduled_at: body?.scheduled_at,
        duration_min: body?.duration_min,
        participant_ids: body?.participant_ids ?? [],
        status: 'SCHEDULED',
        created_at: new Date().toISOString(),
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
