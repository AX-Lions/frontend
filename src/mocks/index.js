import { isMockMode } from './enabled.js'

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

/** `/meetings/{id}/flow` 처럼 id 가 낀 주소를 가른다. */
function segments(path) {
  return path.split('?')[0].split('/').filter(Boolean)
}

function resolve(path, method, body) {
  const s = segments(path)
  const [a, b, c] = s

  if (method === 'GET') {
    if (path === '/home') return viewerHome()
    if (path === '/auth/me' || path === '/users/me') return viewerMe()
    if (path === '/teams') return viewerTeams()

    if (a === 'meetings' && b && !c) return meetings[b] ?? null
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
    if (a === 'chat' && b === 'rooms' && s[3] === 'messages') return roomMessages[c] ?? { results: [], next_before: null, has_older: false, has_newer: false }
    if (a === 'chat' && b === 'rooms' && s[3] === 'active-dates') return activeDates[c] ?? null
    if (a === 'chat' && b === 'rooms' && s[3] === 'daily-summary') {
      const date = new URLSearchParams(path.split('?')[1] || '').get('date')
      return dailySummaries[`${c}|${date}`] ?? { date, one_line: '', my_todos: [], schedules: [], generated_at: null, message_count: 0, status: 'EMPTY' }
    }
    if (a === 'chat' && b === 'rooms' && s[3] === 'search') return { count: 0, results: [] }

    if (path === '/me/agent/settings') return viewerAgentSettings()
    if (path === '/me/agent/prompts') return viewerAgentPrompts()
    if (path === '/me/agent/conversations') return viewerConversations()
    if (a === 'me' && s[2] === 'conversations' && s[4] === 'messages') {
      return viewerConversationMessages(s[3]) ?? { results: [], next_before: null }
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
    if (a === 'chat' && s[3] === 'read') return null
    if (path === '/me/briefing-dismiss') return { dismissed: true }
    if (a === 'me' && s[2] === 'conversations' && s[4] === 'messages') {
      return {
        id: `mock-msg-${Date.now()}`, role: 'USER', body: body?.body ?? '',
        sent_at: new Date().toISOString(), run: { status: 'RECEIVED', run_id: null },
      }
    }
    return { ...(body ?? {}), id: `mock-${Date.now()}`, ok: true }
  }

  return undefined
}

export function shouldMock() {
  return isMockMode()
}

export async function serveMock(path, { method = 'GET', body } = {}) {
  const data = resolve(path, method, body)
  if (data === undefined) {
    throw notMocked(path)
  }
  await new Promise((done) => { window.setTimeout(done, DELAY) })
  return data
}
