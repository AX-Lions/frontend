import { agentName } from './data/people.js'
import { home as baseHome, teams } from './data/home.js'
import { briefings as baseBriefings, meetings } from './data/meetings.js'
import { chatSidebar as baseSidebar } from './data/chat.js'
import {
  agentConversations as baseConversations,
  agentPrompts as basePrompts,
  agentSettings as baseSettings,
  conversationMessages as baseConversationMessages,
} from './data/agent.js'
import { VIEWERS } from './data/viewers.js'
import { currentViewer } from './session.js'
import { patchedOf } from './store.js'

/**
 * 고른 사람의 눈으로 응답을 다시 만든다.
 *
 * ## 세계를 복사하지 않는다
 *
 * 팀 · 프로젝트 · 회의 · 오간 말은 **모두에게 같다.** 사람마다 세계를 따로
 * 만들면 유지할 수 없고, 무엇보다 같은 회의가 사람마다 어떻게 다르게 보이는지가
 * 드러나지 않는다. 여기서는 **보는 눈만** 바꾼다.
 *
 * ## 무엇이 사람마다 다른가
 *
 *     참석 여부      회의의 `participants` 에 이미 들어 있다. 여기서 읽는다
 *     브리핑         빠진 회의에만 생긴다. 다 참석한 사람은 0건이 정상이다
 *     대리인 방      사람마다 자기 방이 있다
 *     대리인 설정    말투 · 스위치 · 이름
 *     평소 지시      회의에서 대리인이 늘 지키길 바라는 것
 *
 * 참석 여부를 회의 데이터에서 읽는 이유는, 사람별로 따로 적으면 **회의에는
 * 참석으로 되어 있는데 홈에는 불참으로 뜨는** 어긋남이 생기기 때문이다.
 * 한 곳만 고치면 다른 곳이 조용히 틀린다.
 */

/** 빠진 회의로 치는 상태. 대리인을 보낸 것도 본인은 그 자리에 없었다. */
const MISSED = new Set(['ABSENT', 'DELEGATED'])

function attendanceOf(meetingId, userId) {
  const row = (meetings[meetingId]?.participants ?? [])
    .find((p) => p.user_id === userId)
  return row ?? null
}

function bits(viewer) {
  return VIEWERS[viewer.email] ?? VIEWERS.__fallback
}

/**
 * `GET /auth/me` · `GET /users/me`
 *
 * 연결 상태 둘(`discord_linked` · `mcp_token_issued_at`)은 **이번 방문에 바꾼
 * 것을 얹어서** 준다. 안 얹으면 Discord 를 잇거나 토큰을 발급한 직후 화면이
 * 다시 읽는 순간 「안 이어짐」 으로 돌아간다 — 눌렀는데 아무 일도 안 일어난
 * 것처럼 보인다.
 *
 * 처음 값은 사람마다 다르다. 다은님은 Discord 담당이라 이어 둔 것으로,
 * 재민님은 MCP 를 붙여 본 것으로 둔다 — **연결됨 상태와 안 됨 상태를 둘 다**
 * 볼 수 있어야 카드가 제대로 확인된다.
 */
export function viewerMe() {
  const v = currentViewer()
  const own = bits(v)
  const saved = patchedOf(`connections:${v.id}`) ?? {}
  return {
    ...v,
    project_role: 'MEMBER',
    notification: { mention: true, schedule: true, digest: false },
    discord_linked: own.discordLinked ?? false,
    mcp_token_issued_at: own.mcpIssuedAt ?? null,
    ...saved,
  }
}

/**
 * `GET /home`
 *
 * 이름 · 아바타 · 불참 뱃지 · 브리핑 · 대리인 방 · 오늘 일정의 위임 상태가
 * 사람마다 달라진다. 회의 목록 자체는 팀 공용이라 그대로 둔다.
 */
export function viewerHome() {
  const v = currentViewer()
  const own = bits(v)

  const recent = (baseHome.recent_meetings ?? []).map((m) => {
    const row = attendanceOf(m.meeting_id, v.id)
    return {
      ...m,
      // 회의 데이터가 정답이다. 여기서 따로 적으면 두 화면이 어긋난다.
      missed: row ? MISSED.has(row.attendance) : false,
      is_favorite: own.favoriteMeetings?.includes(m.meeting_id) ?? false,
    }
  })

  const today = (baseHome.today_schedule ?? []).map((s) => {
    const row = s.meeting_id ? attendanceOf(s.meeting_id, v.id) : null
    const delegated = row?.delegated ?? false
    return {
      ...s,
      delegation: {
        delegated,
        prompt: delegated ? (own.delegatePrompt ?? '') : '',
        sources: delegated ? (own.delegateSources ?? null) : null,
      },
    }
  })

  /*
    브리핑은 **빠진 회의에만** 생긴다.

    홈의 최근 회의 목록이 아니라 **회의 전체**에서 찾는다. 그 목록은 다섯 개로
    잘려 있어서, 거기 안 든 회의를 빠진 사람은 브리핑이 있는데도 홈에서 갈
    길이 없다 — 실제로 임수연이 그랬다.

    다 참석한 사람은 0건이고 홈 상단 버튼이 안 뜬다. 그것이 정상이라
    데이터로도 그 상태를 만들어 둔다 — 참석자가 브리핑을 열면 404 라는 규약을
    화면이 오류로 그리는지 확인할 자리가 있어야 한다.
  */
  const missedEnded = Object.entries(meetings)
    .filter(([, m]) => m.status === 'ENDED' && (m.participants ?? []).some(
      (p) => p.user_id === v.id && MISSED.has(p.attendance)))
    .sort((a, b) => (a[1].scheduled_at < b[1].scheduled_at ? 1 : -1))
  const pending = missedEnded[0] ?? null

  return {
    ...baseHome,
    user_name: v.name,
    user_avatar_url: v.avatar_url,
    recent_meetings: recent,
    today_schedule: today,
    briefing_pending: pending
      ? { exists: true, meeting_id: pending[0], always_open: false }
      : { exists: false, meeting_id: null, always_open: false },
    shortcuts: { ...baseHome.shortcuts, agent_room_id: own.agentRoomId },
    favorite_projects: baseHome.favorite_projects ?? [],
  }
}

/** `GET /teams` — 팀은 모두 같다. */
export function viewerTeams() {
  return teams
}

function pad(n) {
  return String(n).padStart(2, '0')
}

/** `8월 18일 14:00 - 15:00` — 서버 `meeting_when()` 과 같은 모양이다. */
function meetingWhen(scheduledAt, durationMin) {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + durationMin * 60000)
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return `${start.getMonth() + 1}월 ${start.getDate()}일 ${hhmm(start)} - ${hhmm(end)}`
}

/**
 * `GET /meetings/{id}/prep` 의 `header` — 확정된 일정 확인 팝업(시안 `697:9393`)이 쓴다.
 *
 * `when` · `badge` 는 클라이언트가 다시 조합하지 않는다. 화면마다 "대리 참석
 * 예정" 문구가 갈리는 것을 막으려고 서버가 완성해 내려주는 값이라, 목도 같은
 * 모양으로 미리 완성해 둔다.
 *
 * `team_name` 은 회의가 들고 온 값을 그대로 쓴다. 실제 서버도
 * `meeting.project.team.name` 을 읽는다 — 여기서 `TEAM` 을 박아 두면 다른 팀
 * 회의(학술제)에 해커톤 팀 이름이 붙는다.
 */
export function viewerMeetingPrepHeader(meetingId) {
  const meeting = meetings[meetingId]
  if (!meeting) {
    return null
  }
  const v = currentViewer()
  const row = attendanceOf(meetingId, v.id)
  const delegated = row?.delegated ?? false
  return {
    meeting_id: meeting.id,
    title: meeting.title,
    project_name: meeting.project_name,
    team_name: meeting.team_name,
    scheduled_at: meeting.scheduled_at,
    when: meetingWhen(meeting.scheduled_at, meeting.duration_min),
    location: meeting.discord_channel_id ? 'Discord' : '서비스',
    status: meeting.status,
    delegated,
    badge: delegated
      ? `${agentName(v.name)} 대리 참석 ${meeting.status === 'ACTIVE' ? '중' : '예정'}`
      : '참석 예정',
  }
}

/**
 * `GET /chat/sidebar`
 *
 * 내 대리인 방만 바뀐다. 팀 · 프로젝트 방은 같은 팀이니 그대로다.
 */
export function viewerSidebar() {
  const v = currentViewer()
  const own = bits(v)
  return {
    ...baseSidebar,
    my_agent_room: {
      ...baseSidebar.my_agent_room,
      id: own.agentRoomId,
      title: agentName(v.name),
      avatar_urls: v.avatar_url ? [v.avatar_url] : [],
    },
  }
}

/**
 * `GET /meetings/{id}/ai-briefing`
 *
 * 참석한 회의에는 브리핑이 없다. `null` 을 돌려주면 화면이 그 자리만 비운다
 * (`useFlowBoardMeeting` 이 실패를 삼켜 브리핑 칸만 비우게 되어 있다).
 */
export function viewerBriefing(meetingId) {
  const v = currentViewer()
  const row = attendanceOf(meetingId, v.id)
  if (!row || !MISSED.has(row.attendance)) {
    return null
  }

  const own = bits(v)
  const mine = own.briefings?.[meetingId]
  const base = baseBriefings[meetingId]
  if (!mine && !base) {
    return null
  }

  /*
    **사람별 서술이 있으면 공용 브리핑이 없어도 만든다.**

    공용 브리핑은 회의 전부에 있지는 않다. 그것을 필수로 두면 빠진 사람에게
    브리핑이 있다고 홈에 표시해 놓고 정작 열면 빈 화면이 된다 — 실제로
    서재민이 그랬다. 없는 칸은 빈 배열로 채운다.

    사람별 서술이 없을 때만 공용 것을 쓰되 대리인 이름은 보는 사람 것으로
    바꾼다. 남의 대리인 이름이 내 브리핑에 뜨면 그 순간 못 믿을 화면이 된다.
  */
  const EMPTY_BRIEFING = {
    meeting_id: meetingId,
    narrative: '',
    location_chips: [],
    needs_confirmation: [],
    requests_to_me: [],
    needs_answer: [],
    used_answers: [],
    deferred_answers: [],
  }

  return {
    ...EMPTY_BRIEFING,
    ...(base ?? {}),
    ...(mine ?? {}),
    meeting_id: meetingId,
    narrative: mine?.narrative
      ?? (base?.narrative ?? '').replaceAll(agentName('유수인'), agentName(v.name)),
  }
}

/** `GET /me/agent/settings` */
export function viewerAgentSettings() {
  const v = currentViewer()
  const own = bits(v)
  return { ...baseSettings, ...(own.settings ?? {}), agent_name: agentName(v.name) }
}

/** `GET /me/agent/prompts` — 회의에서 대리인이 늘 지키길 바라는 것. */
export function viewerAgentPrompts() {
  const own = bits(currentViewer())
  const results = own.prompts ?? basePrompts.results ?? []
  return { count: results.length, results }
}

/** `GET /me/agent/conversations` */
export function viewerConversations() {
  const own = bits(currentViewer())
  if (!own.conversations) {
    return baseConversations
  }
  return { count: own.conversations.length, results: own.conversations }
}

/** `GET /me/agent/conversations/{id}/messages` */
export function viewerConversationMessages(conversationId) {
  const own = bits(currentViewer())
  return own.conversationMessages?.[conversationId]
    ?? baseConversationMessages[conversationId]
    ?? null
}
