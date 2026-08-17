import { useResource } from '../../lib/useResource.js'
import {
  fetchBriefing,
  fetchEdge,
  fetchIndexes,
  fetchMe,
  fetchMeeting,
  fetchMeetingFlow,
  fetchProjectFlow,
  fetchProjectMeetings,
  fetchSummaryTable,
  resolveMeetingId,
} from './flowBoard.data.js'

/**
 * 플로우 화면이 읽는 것 전부.
 *
 * ## 두 덩이로 나눈다
 *
 * 회의가 정해지면 안 바뀌는 것(인덱스·요약표·브리핑)과, **필터를 만질 때마다
 * 다시 읽어야 하는 것**(플로우)이 다르다. 한 덩이로 묶으면 체크박스 하나 누를
 * 때마다 브리핑까지 네 번 다시 읽는다.
 *
 * ## 브리핑이 없을 수 있다
 *
 * 브리핑은 **불참자에게만** 만들어진다. 참석한 사람이 열면 404 다. 그건 오류가
 * 아니라 "브리핑받을 것이 없다" 이므로, 화면 전체를 오류로 덮지 않고 그 자리만
 * 비운다.
 *
 * ## 회의 모드와 작업 모드는 경로가 다르다
 *
 *     회의   GET /meetings/{id}/flow
 *     작업   GET /projects/{id}/flow?from&to
 *
 * 같은 경로에 `category=WORK` 를 붙여 물으면 무엇을 넣든 0건이다. 작업 엣지는
 * `meeting` 이 비어 있기 때문이다.
 */

/** 회의 모드 / 작업 모드. 화면의 `카테고리` 두 칸과 1:1. */
export const MEETING_MODE = 'meeting'
export const WORK_MODE = 'work'

function flowCategory(mode) {
  return mode === WORK_MODE ? 'WORK' : 'MEETING'
}

/**
 * 어느 회의를 볼지 정하고, 그 회의에 딸린 것을 한 번에 읽는다.
 *
 * `meetingIdOverride` 는 헤더에서 회의를 골랐을 때 들어온다. 주소만 고치고
 * 다시 읽지 않으면 제목만 바뀌고 판은 그대로라, 고른 회의가 아닌 것을 보게 된다.
 */
export function useFlowBoardMeeting(meetingIdOverride = null) {
  return useResource(async (signal) => {
    const meetingId = meetingIdOverride ?? await resolveMeetingId(signal)
    if (!meetingId) {
      return { meetingId: null, detail: null, summary: null, briefing: null }
    }

    const [detail, summary, briefing] = await Promise.all([
      fetchMeeting(meetingId, signal),
      fetchSummaryTable(meetingId, signal).catch(() => null),
      fetchBriefing(meetingId, signal).catch(() => null),
    ])

    return { meetingId, detail, summary, briefing }
  }, [meetingIdOverride])
}

/**
 * 좌측 인덱스. 모드에 따라 안건(회의) 또는 문서(작업)다.
 *
 * 카테고리가 바뀌면 다시 읽는다 — 회의 안건을 띄운 채 작업 판을 그리면
 * 안건을 눌러도 강조될 화살표가 없다.
 */
export function useFlowIndexes(meetingId, mode) {
  return useResource(
    (signal) => (meetingId
      ? fetchIndexes(meetingId, flowCategory(mode), signal).catch(() => ({ results: [] }))
      : Promise.resolve({ results: [] })),
    [meetingId, mode],
  )
}

/**
 * 필터 목록을 **거르지 않은 조회에서** 받는다.
 *
 * `filter_options.content_types` 는 그 조회에 실제로 나온 종류만 담는다.
 * 필터를 건 응답에서 목록을 뽑으면 `의견` 을 끄는 순간 `의견` 칸 자체가
 * 사라져 **다시 켤 방법이 없다.** 한 번 더 부르는 값이 있다.
 */
export function useFlowOptions(mode, meetingId, projectId) {
  return useResource((signal) => {
    if (mode === WORK_MODE) {
      return projectId
        ? fetchProjectFlow(projectId, {}, signal).catch(() => null)
        : Promise.resolve(null)
    }
    return meetingId
      ? fetchMeetingFlow(meetingId, {}, signal).catch(() => null)
      : Promise.resolve(null)
  }, [mode, meetingId, projectId])
}

/**
 * 캔버스에 그릴 그래프.
 *
 * 응답 모양은 두 모드가 같다(`meeting_label` ↔ `period_label` 만 다르다).
 * 백엔드가 렌더러를 하나만 만들면 되도록 맞춰 둔 것이라, 여기서도 갈래를
 * **호출 한 줄로만** 둔다.
 */
export function useFlowGraph({ mode, meetingId, projectId, participantIds, contentTypes, enabled = true }) {
  const scopeId = mode === WORK_MODE ? projectId : meetingId

  return useResource(
    (signal) => {
      if (!enabled || !scopeId) {
        return Promise.resolve(null)
      }
      const filters = { participantIds, contentTypes }
      return mode === WORK_MODE
        // `from`·`to` 를 안 보낸다. 안 보내면 백엔드가 최근 7일로 잡고
        // `period_label`(`8.10 - 8.16 작업 흐름`)까지 완성해 준다. 클라이언트가
        // 기간을 만들면 그 라벨과 실제 조회 구간이 갈릴 수 있다.
        ? fetchProjectFlow(scopeId, filters, signal)
        : fetchMeetingFlow(scopeId, filters, signal)
    },
    // 배열을 그대로 넣으면 매 렌더마다 새 배열이라 끝없이 다시 읽는다.
    [mode, scopeId, enabled, participantIds.join(','), contentTypes.join(',')],
  )
}

/** 헤더의 회의 선택(▼). 목록이 없으면 고를 수가 없어 아이콘만 돌던 자리다. */
export function useProjectMeetings(projectId, enabled) {
  return useResource(
    (signal) => (enabled && projectId
      ? fetchProjectMeetings(projectId, signal)
      : Promise.resolve(null)),
    [projectId, enabled],
  )
}

/**
 * 화살표 뱃지를 눌렀을 때 열리는 상세.
 *
 * 뱃지 하나가 엣지 여럿을 묶고 있다(`의견 3`). 셋을 한 번에 읽어야 "그 뱃지에
 * 뭐가 들었나" 를 보여 줄 수 있다. 실패한 것은 버리고 나머지를 그린다 —
 * 하나 때문에 패널 전체가 오류가 되면 볼 수 있는 둘도 못 본다.
 */
export function useEdgeDetails(edgeIds) {
  const key = (edgeIds ?? []).join(',')

  return useResource(
    async (signal) => {
      if (!key) {
        return []
      }
      const settled = await Promise.all(
        key.split(',').map((id) => fetchEdge(id, signal).catch(() => null)),
      )
      return settled.filter(Boolean)
    },
    [key],
  )
}

/** 로그인한 사람. 내 대리인 노드를 찾는 데 쓴다. */
export function useMe() {
  return useResource((signal) => fetchMe(signal).catch(() => null), [], { cacheKey: 'me' })
}
