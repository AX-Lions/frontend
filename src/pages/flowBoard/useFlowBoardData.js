import { useResource } from '../../lib/useResource.js'
import {
  fetchBriefing,
  fetchEdge,
  fetchMe,
  fetchMeeting,
  fetchMeetingFlow,
  fetchMeetingTimeline,
  fetchParticipantFlow,
  fetchProjectFlow,
  fetchProjectMeetings,
  fetchProjectTimeline,
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
      // 회의를 여는 것만으로 읽음이 되면 안 된다. 읽음은 패널을 실제로 연
      // 순간에 따로 올린다(`FlowBoardPage`).
      fetchBriefing(entry.meetingId, { markRead: false }, signal).catch(() => null),
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

/** 좌측 목록이 비었을 때 내려 줄 것. 응답 모양(`{ count, results }`)과 같다. */
const NO_TIMELINE = { count: 0, results: [] }

/**
 * 좌측 `시간순 인덱스`. 재생 기능의 대본이기도 하다.
 *
 * 스코프는 판과 같이 간다 — 작업 모드면 프로젝트, 아니면 회의다. 회의 id 로
 * 작업 타임라인을 물으면 작업 엣지에는 회의가 없어 무엇을 넣든 0건이다.
 *
 * ## 실패를 삼킨다 — 판(`useFlowGraph`)과 정반대다
 *
 * 판 조회가 실패를 삼키면 안 되는 것은, 삼키는 순간 서버 장애가 `이 회의에서
 * 오간 내용이 없습니다` 로 둔갑하고 `다시 시도` 버튼조차 안 그려지기 때문이다.
 * 이 서비스가 묻는 질문이 "내가 없는 동안 무슨 일이 있었지" 인데 그 답을
 * 틀리게 말하는 셈이 된다.
 *
 * 여기는 그 반대다. 이 조회는 아무와도 키를 나눠 쓰지 않고, 실서버에는
 * `/timeline` 경로가 **아직 없어서 반드시 404 가 난다.** 미구현을 붉은 오류
 * 상자로 그리면 사용자가 할 수 있는 일이 없는 경고를 화면 한 칸이 계속
 * 붙잡고 있게 된다. 좌측 목록이 비는 편이 낫다 — 고장과 미구현은 사용자가
 * 할 수 있는 일이 다르고, 지금은 후자다.
 *
 * 서버가 이 경로를 구현하고 나면 이 `.catch` 는 걷어낸다. 그때부터는 빈
 * 목록이 진짜로 "오간 것이 없다" 를 뜻하게 된다.
 */
export function useFlowTimeline(mode, meetingId, projectId) {
  const scopeId = mode === WORK_MODE ? projectId : meetingId

  return useResource(
    (signal) => {
      if (!scopeId) {
        return Promise.resolve(NO_TIMELINE)
      }
      return mode === WORK_MODE
        ? fetchProjectTimeline(scopeId, signal).catch(() => NO_TIMELINE)
        : fetchMeetingTimeline(scopeId, signal).catch(() => NO_TIMELINE)
    },
    [mode, scopeId],
  )
}

/**
 * 캔버스에 그릴 그래프.
 *
 * 응답 모양은 두 모드가 같다(`meeting_label` ↔ `period_label` 만 다르다).
 * 백엔드가 렌더러를 하나만 만들면 되도록 맞춰 둔 것이라, 여기서도 갈래를
 * **호출 한 줄로만** 둔다.
 *
 * ## 필터를 안 건다
 *
 * 예전에는 참여자·내용 종류 체크가 조회 조건으로 실렸고, 그 목록을 채우려고
 * `useFlowOptions` 라는 **거르지 않은 조회**를 하나 더 두었다. 좌측 `필터링`
 * 이 `시간순 인덱스` 로 바뀌면서 걸 조건이 없어졌으므로 그 훅도 같이 없앴다 —
 * 이제 이 조회 하나가 곧 거르지 않은 조회다.
 *
 * `cacheKey` 는 그대로 `flow` 로 둔다. 두 훅이 합쳐지던 자리라 키를 바꿀
 * 이유가 없고, 남겨 두면 다른 화면이 같은 판을 열 때 캐시를 나눠 쓴다.
 */
export function useFlowGraph({ mode, meetingId, projectId }) {
  const scopeId = mode === WORK_MODE ? projectId : meetingId

  return useResource(
    (signal) => {
      if (!scopeId) {
        return Promise.resolve(null)
      }
      return mode === WORK_MODE
        // `from`·`to` 를 안 보낸다. 안 보내면 백엔드가 최근 7일로 잡고
        // `period_label`(`8.10 - 8.16 작업 흐름`)까지 완성해 준다. 클라이언트가
        // 기간을 만들면 그 라벨과 실제 조회 구간이 갈릴 수 있다.
        ? fetchProjectFlow(scopeId, {}, signal)
        : fetchMeetingFlow(scopeId, {}, signal)
    },
    [mode, scopeId],
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
/**
 * 판에서 고른 사람·대리인 한 명의 상세(시안 `601:9055`).
 *
 * 실서버에는 아직 이 경로가 없다. `.catch(() => null)` 로 **오류가 아니라
 * 없음**으로 내린다 — 패널이 붉은 오류 상자 대신 "아직 서버에 없습니다" 를
 * 그리게 하려는 것이다. 고장과 미구현은 사용자가 할 수 있는 일이 다르다.
 */
export function useParticipantFlow(meetingId, nodeId) {
  return useResource(
    (signal) => (meetingId && nodeId
      ? fetchParticipantFlow(meetingId, nodeId, signal).catch(() => null)
      : Promise.resolve(null)),
    [meetingId, nodeId],
  )
}

export function useMe() {
  return useResource((signal) => fetchMe(signal).catch(() => null), [], { cacheKey: 'flow-me' })
}
