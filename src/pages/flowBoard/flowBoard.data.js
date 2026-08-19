import { api } from '../../lib/api.js'
import { cacheKeyFor, dedupe, readCache } from '../../lib/resourceCache.js'

/**
 * 플로우 화면이 부르는 것.
 *
 * `flowBoard.api.js` 는 이름과 달리 아이콘·라벨 상수와 목 데이터를 담고 있다.
 * 실제 호출은 여기로 모은다 — 둘을 섞으면 목이 언제 사라졌는지 알 수 없다.
 *
 * ## 회의 모드와 작업 모드는 경로가 다르다
 *
 *     회의   GET /meetings/{id}/flow          회의 하나가 스코프
 *     작업   GET /projects/{id}/flow?from&to  **기간**이 스코프
 *
 * 작업 화살표에는 회의가 없다. 화면 헤더가 `8.10 - 8.16 작업 흐름` 인 것과 같은
 * 이유다. 같은 경로에 `category=WORK` 를 붙여 물으면 **무엇을 넣든 0건**이다.
 *
 * 응답 모양은 `meeting_label` 이 `period_label` 로 바뀌는 것 말고 같다. 차트
 * 렌더러를 하나만 만들면 되도록 백엔드가 맞춰 둔 것이다.
 */

/**
 * 서버의 `content_type` → 화면의 tone. 뱃지 색과 아이콘이 여기에 걸려 있다.
 *
 * **회의 6종과 작업 5종을 한 표에 둔다.** 코드가 겹치지 않아 섞일 일이 없고,
 * 나눠 두면 `toneOf()` 를 부르는 쪽마다 지금이 어느 모드인지 알아야 한다.
 * 작업 5종이 빠져 있어서 작업 모드 뱃지가 전부 `기타` 회색으로 나왔다.
 */
export const TONE_OF = {
  // 회의 모드
  OPINION: 'opinion',
  REQUEST: 'request',
  CHANGE: 'change',
  SCHEDULE: 'schedule',
  CONCLUSION: 'conclusion',
  ETC: 'etc',
  // 작업 모드
  WORK: 'work',
  REVISION: 'revision',
  FEEDBACK: 'feedback',
  SHARE: 'share',
  AI_LOOKUP: 'aiLookup',
}

export function toneOf(contentType) {
  return TONE_OF[contentType] ?? 'etc'
}

/**
 * 목록 필터를 쿼리로 옮긴다.
 *
 * 비어 있으면 **아예 보내지 않는다.** 빈 문자열을 보내면 백엔드가 "그런 값을 가진
 * 것" 을 찾아 0건이 되고, 화면은 아무것도 안 고른 것과 전부 고른 것을 구별하지
 * 못하게 된다.
 */
function listParam(values) {
  return values && values.length ? values.join(',') : undefined
}

export function fetchMeetingFlow(meetingId, { participantIds, contentTypes } = {}, signal) {
  return api.get(`/meetings/${meetingId}/flow`, {
    category: 'MEETING',
    participant_ids: listParam(participantIds),
    content_types: listParam(contentTypes),
  }, { signal })
}

export function fetchProjectFlow(projectId, { from, to, participantIds, contentTypes, sources } = {}, signal) {
  return api.get(`/projects/${projectId}/flow`, {
    from,
    to,
    participant_ids: listParam(participantIds),
    content_types: listParam(contentTypes),
    sources: listParam(sources),
  }, { signal })
}

export function fetchMeeting(meetingId, signal) {
  return api.get(`/meetings/${meetingId}`, undefined, { signal })
}

export function fetchIndexes(meetingId, category, signal) {
  return api.get(`/meetings/${meetingId}/indexes`, { category }, { signal })
}

export function fetchSummaryTable(meetingId, signal) {
  return api.get(`/meetings/${meetingId}/summary-table`, undefined, { signal })
}

/**
 * 브리핑을 읽는다.
 *
 * **읽음 처리를 부르는 쪽이 정한다.** 이 화면은 브리핑 패널을 열든 말든 회의를
 * 열 때 이것을 부른다. 서버는 패널을 열었는지 알 수 없으므로, 그냥 부르면
 * 회의 화면에 잠깐 들른 것만으로 홈의 `Bordo 브리핑 보러가기` 가 사라진다 —
 * **사용자는 읽은 적이 없는데 읽은 것이 된다.**
 *
 * 그래서 자동으로 부를 때는 `markRead: false` 다. 실제로 패널을 연 순간에만
 * 읽음으로 올린다.
 */
export function fetchBriefing(meetingId, { markRead = true } = {}, signal) {
  return api.get(`/meetings/${meetingId}/ai-briefing`,
                 markRead ? undefined : { mark_read: 'false' },
                 { signal })
}

export function fetchEdge(edgeId, signal) {
  return api.get(`/flow-edges/${edgeId}`, undefined, { signal })
}

/**
 * 판에서 사람·대리인 하나를 눌렀을 때 열리는 우측 패널의 내용(시안 `601:9055`).
 *
 * ## 이 저장소가 계약을 먼저 정한다
 *
 * 백엔드에 아직 없는 자리다. 화면이 무엇을 그려야 하는지가 먼저 정해졌으므로
 * (`주요 발언` · 종류별 개수 · `전달한 내용` · `전달받은 내용`) 그 모양을
 * 목으로 확정하고 여기 적어 둔다 — `frontend/CLAUDE.md` 의 작업 순서다.
 * 서버에 붙기 전까지 실서버에서는 404 가 나고, 패널은 그때 "아직 서버에
 * 없습니다" 를 그대로 보여 준다.
 *
 * 대리인 노드 id 는 `{user_id}:agent` 라 `:` 가 들어간다. 경로 조각 하나로
 * 보내야 하므로 감싸 준다 — 안 감싸면 서버에 따라 조각이 둘로 쪼개진다.
 */
export function fetchParticipantFlow(meetingId, nodeId, signal) {
  return api.get(
    `/meetings/${meetingId}/participants/${encodeURIComponent(nodeId)}/flow`,
    undefined,
    { signal },
  )
}

/** 헤더의 회의 선택(▼)이 띄울 목록. */
export function fetchProjectMeetings(projectId, signal) {
  return api.get(`/projects/${projectId}/meetings`, undefined, { signal })
}

/**
 * 로그인한 사람.
 *
 * 대리인 노드가 `임수연의 Bordo` 로 박혀 있었다. **누가 봐도 임수연의 것**이라
 * 다른 사람은 자기 대리인을 찾을 수 없었다. 어느 대리인 노드가 내 것인지는
 * `nodes[].user_id` 와 이 id 를 맞춰 봐야 안다.
 */
export function fetchMe(signal) {
  return api.get('/users/me', undefined, { signal })
}

/**
 * 홈이 방금 읽어 둔 `/home` 을 나눠 쓴다.
 *
 * 이 한 번이 **나머지 조회 전부를 막고 있다** — 회의 id 를 알아야 회의 상세 ·
 * 요약표 · 브리핑 · 플로우를 부를 수 있으니, 여기가 왕복 하나만큼 통째로
 * 지연이 된다. 홈에서 넘어온 경우가 대부분인데 그때는 이미 담겨 있다.
 *
 * `HomePage` 와 **같은 키**를 써야 한다. 각자 문자열을 만들면 같은 `/home`
 * 이 두 키에 담겨, 캐시가 있는데도 다시 읽는다.
 *
 * **나눠 쓰는 요청에는 `signal` 을 넘기지 않는다.** 넘기면 그 약속이 처음 부른
 * 화면의 수명에 묶인다. 이 화면이 뜨자마자 다시 뜨는 경우(개발 모드의 이중
 * 마운트, 빠른 뒤로가기)에 첫 번째가 취소되는데, 두 번째는 `inflight` 에 남아
 * 있는 **그 취소된 약속**을 받아 든다. 그러면 취소 오류가 오고, 그것은 "내가
 * 떠나서 끊긴 것" 과 구별되지 않아 조용히 삼켜진다 — 화면이 `회의를 불러오는
 * 중입니다…` 에서 멈춘다. 취소는 각 화면이 자기 것만 막는다(`useResource`).
 */
function readHome() {
  const key = cacheKeyFor('home', [])
  const cached = readCache(key)
  return cached !== undefined
    ? Promise.resolve(cached)
    : dedupe(key, () => api.get('/home'))
}

/**
 * `/home` 이 이미 들고 온 프로젝트 이름.
 *
 * 회의가 하나도 없는 프로젝트는 회의 응답에서 이름을 얻을 길이 없다. 그렇다고
 * 이름 한 줄 때문에 요청을 하나 더 만들지 않는다 — 홈이 내가 속한 프로젝트를
 * `project_progress` 로 **전부** 내려 준다. 최근·즐겨찾기는 그 부분집합이라,
 * 응답 모양이 바뀌었을 때를 대비한 보조다.
 */
function projectNameIn(home, projectId) {
  const pools = [home?.project_progress, home?.recent_projects, home?.favorite_projects]
  for (const pool of pools) {
    const hit = (pool ?? []).find((p) => String(p.id) === projectId)
    if (hit?.name) {
      return hit.name
    }
  }
  return ''
}

/**
 * 플로우 화면을 **무엇으로 열지**.
 *
 * 홈 사이드바가 주소에 두 가지를 싣는다.
 *
 *     ?meeting=<id>   그 회의를 연다
 *     ?project=<id>   **그 프로젝트의** 최근 회의를 연다
 *
 * `?meeting` 이 먼저다. 사이드바는 회의를 알면 둘 다 싣는데, 그때는 답이 이미
 * 나와 있어 더 물을 것이 없다.
 *
 * ## `?project` 를 안 읽어서 남의 회의가 열렸다
 *
 * 예전에는 `?meeting` 만 보고, 없으면 `/home` 의 **전체 최신 회의**로 떨어졌다.
 * 최근 회의 목록에 없는 프로젝트를 사이드바에서 누르면 헤더 팀 이름도 제목도
 * 요약표도 아무 상관 없는 프로젝트 것이 떴다. 오류도 안내도 없으니 사용자는
 * 그것을 **자기가 누른 프로젝트로 읽는다** — "내가 없는 동안 무슨 일이 있었지"
 * 에 남의 답을 준 셈이다.
 *
 * 그래서 프로젝트가 실려 있으면 그 프로젝트 안에서만 고른다. 하나도 없으면
 * `null` 이다. 없는 것을 없다고 말하는 편이 남의 회의를 보여 주는 것보다 낫다.
 *
 * @returns `{ meetingId, projectId, projectName }` — 이름은 회의가 없는
 *   프로젝트에서도 "무엇이 비어 있는지" 를 말해 주려고 함께 돌려준다.
 */
export async function resolveFlowEntry() {
  const params = new URLSearchParams(window.location.search)
  const meetingParam = params.get('meeting')
  const projectId = params.get('project') || null

  if (meetingParam) {
    return { meetingId: meetingParam, projectId, projectName: '' }
  }

  const home = await readHome()

  if (!projectId) {
    // 주소로 바로 들어온 경우. 회의를 고르라고 빈 화면을 띄우면 이 서비스가
    // 처음 묻는 질문의 답을 한 단계 뒤로 미루게 된다.
    //
    // `recent_meeting_summary` 는 **끝난 회의**만 채워진다. 예정된 회의밖에
    // 없는 팀은 그것이 비어 있어서, 그 값만 보면 열 회의가 없다고 판단해
    // 버린다. 최근 회의 목록으로 한 번 더 내려본다.
    return {
      meetingId: home?.recent_meeting_summary?.meeting_id
        ?? home?.recent_meetings?.[0]?.meeting_id
        ?? null,
      projectId: null,
      projectName: '',
    }
  }

  const projectName = projectNameIn(home, projectId)

  // 최근 회의 목록은 최신순이라 먼저 걸리는 것이 그 프로젝트의 가장 최근
  // 회의다. 여기서 찾으면 요청 없이 끝난다.
  const known = (home?.recent_meetings ?? [])
    .find((m) => String(m.project_id) === projectId)
  if (known?.meeting_id) {
    return {
      meetingId: known.meeting_id,
      projectId,
      projectName: known.project_name || projectName,
    }
  }

  /*
    목록에 없다고 회의가 없는 것은 아니다.

    `recent_meetings` 는 **내 프로젝트 전체에서 5개**다. 옆 프로젝트가 활발하면
    조용한 프로젝트의 회의는 그 5개에 못 든다. 그걸 "회의 없음" 으로 읽으면
    멀쩡한 회의가 있는 화면에 안내만 뜬다.

    실패는 삼키지 않는다. 못 물어본 것과 없는 것은 다르다 — 500 을 `아직 열린
    회의가 없습니다` 로 바꿔 놓으면 장애가 "아무 일도 없었다" 로 둔갑하고
    `다시 시도` 조차 안 그려진다.

    `dedupe` 로 감싸는 이유는 이 화면이 뜨자마자 다시 뜨는 경우에 같은 목록이
    두 번 나가기 때문이다. 여기서도 **`signal` 은 넘기지 않는다.**
  */
  const list = await dedupe(
    cacheKeyFor('project-meetings', [projectId]),
    () => fetchProjectMeetings(projectId),
  )
  const latest = list?.results?.[0] ?? null

  return {
    meetingId: latest?.id ?? null,
    projectId,
    projectName: latest?.project_name || projectName,
  }
}
