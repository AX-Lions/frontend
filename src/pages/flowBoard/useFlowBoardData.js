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
  resolveFlowEntry,
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
 *
 * ## 프로젝트를 회의와 함께 돌려준다
 *
 * 예전에는 화면이 `detail.project_id` 로만 프로젝트를 알았다. 그러면 **회의가
 * 없는 프로젝트는 자기 이름조차 말할 수 없다** — 상세가 없으니 딸려 오는 것도
 * 없다. 사이드바에서 누른 것이 열렸는지 확인할 길이 사라진다.
 */
export function useFlowBoardMeeting(meetingIdOverride = null, urlMeetingId = null, urlProjectId = null) {
  return useResource(async (signal) => {
    // 고른 회의가 있으면 주소도 홈도 다시 뒤질 필요가 없다. 프로젝트는 아래
    // 회의 상세가 알려 준다.
    const entry = meetingIdOverride
      ? { meetingId: meetingIdOverride, projectId: null, projectName: '' }
      : await resolveFlowEntry()

    if (!entry.meetingId) {
      return { ...entry, detail: null, summary: null, briefing: null }
    }

    const [detail, summary, briefing] = await Promise.all([
      fetchMeeting(entry.meetingId, signal),
      fetchSummaryTable(entry.meetingId, signal).catch(() => null),
      fetchBriefing(entry.meetingId, signal).catch(() => null),
    ])

    return {
      meetingId: entry.meetingId,
      // **회의 상세가 정답이다.** 주소의 `?project` 는 사람이 손으로 고칠 수
      // 있고, 그러면 헤더가 열린 회의와 다른 프로젝트 이름을 말하게 된다.
      projectId: detail?.project_id ?? entry.projectId,
      projectName: detail?.project_name || entry.projectName,
      detail,
      summary,
      briefing,
    }
    // 주소의 두 칸도 의존성이다. `resolveFlowEntry()` 가 주소를 직접 읽으므로
    // **여기 안 넣으면 뒤로 가기로 주소만 바뀐 경우 다시 읽지 않는다** — 주소는
    // 회의 A 인데 화면은 B 그대로가 된다.
  }, [meetingIdOverride, urlMeetingId, urlProjectId])
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
  const scopeId = mode === WORK_MODE ? projectId : meetingId

  return useResource((signal) => {
    if (!scopeId) {
      return Promise.resolve(null)
    }
    /*
      **여기서 실패를 삼키면 안 된다.**

      이 조회는 아래 `useFlowGraph` 와 캐시 키가 같아 `dedupe` 로 합쳐진다.
      합쳐진다는 것은 **먼저 등록한 쪽의 약속을 뒤엣것이 그대로 받는다**는
      뜻이다. 이 훅이 먼저 돌므로(화면에서 위에 있다), 여기에 `.catch(() => null)`
      을 달면 캔버스 쪽 `error` 가 통째로 사라진다.

      그러면 서버가 500 을 내도 화면에는 `이 회의에서 오간 내용이 없습니다.` 가
      뜬다. **장애가 "이 회의엔 아무 일도 없었다" 로 둔갑하고**, `다시 시도`
      버튼조차 안 그려진다. 이 서비스가 묻는 질문이 "내가 없는 동안 무슨 일이
      있었지" 인데 그 답을 틀리게 말하는 셈이다.

      거절은 그대로 흘려보낸다. 이 훅을 쓰는 쪽은 `error` 를 읽지 않고
      `data` 가 없으면 필터 목록을 비우므로, 삼키지 않아도 전과 같다.
    */
    return mode === WORK_MODE
      ? fetchProjectFlow(scopeId, {}, signal)
      : fetchMeetingFlow(scopeId, {}, signal)
    // `deps` 모양을 `useFlowGraph` 와 **글자 그대로 맞춘다.** 캐시 키는
    // `deps` 를 직렬화해 만들므로, 하나라도 다르면 같은 무필터 조회가 두 키에
    // 담겨 요청이 두 번 나간다. 필터를 걸기 시작하면 뒤의 두 칸이 달라져
    // 저절로 갈린다.
  }, [mode, scopeId, true, '', ''], { cacheKey: 'flow' })
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
    // 아무것도 안 걸렀을 때 `useFlowOptions` 와 **키가 완전히 같아져** 두
    // 요청이 하나로 합쳐진다. 그쪽 `deps` 도 이 모양에 맞춰 뒀다.
    { cacheKey: 'flow' },
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

/**
 * 로그인한 사람. 내 대리인 노드를 찾는 데 쓴다.
 *
 * **캐시 이름이 `me` 가 아니다.** 개인 설정 화면도 "나" 를 읽지만 그쪽은
 * `GET /auth/me` 이고 여기는 `GET /users/me` 다. 이름이 같으면 `dedupe` 가
 * 둘을 한 요청으로 합쳐, 먼저 도착한 쪽 응답이 다른 화면의 것으로 쓰인다.
 * 여기에 붙은 `.catch(() => null)` 까지 그쪽이 물려받아, 개인 설정이 오류
 * 대신 **빈 입력칸**을 그리게 된다. 부르는 곳이 다르면 키도 달라야 한다.
 */
export function useMe() {
  return useResource((signal) => fetchMe(signal).catch(() => null), [], { cacheKey: 'flow-me' })
}
