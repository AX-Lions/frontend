import { useResource } from '../../lib/useResource.js'
import {
  fetchBriefing,
  fetchIndexes,
  fetchMeeting,
  fetchMeetingFlow,
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
 */
export function useFlowBoardMeeting(category = 'MEETING') {
  return useResource(async (signal) => {
    const meetingId = await resolveMeetingId(signal)
    if (!meetingId) {
      return { meetingId: null, detail: null, indexes: [], summary: null, briefing: null }
    }

    const [detail, indexes, summary, briefing, unfiltered] = await Promise.all([
      fetchMeeting(meetingId, signal),
      fetchIndexes(meetingId, category, signal).catch(() => ({ results: [] })),
      fetchSummaryTable(meetingId, signal).catch(() => null),
      fetchBriefing(meetingId, signal).catch(() => null),
      // 필터 목록을 **거르지 않은 조회에서** 받는다.
      //
      // `filter_options.content_types` 는 그 조회에 실제로 나온 종류만 담는다.
      // 필터를 건 응답에서 목록을 뽑으면 `의견` 을 끄는 순간 `의견` 칸 자체가
      // 사라져 **다시 켤 방법이 없다.** 한 번 더 부르는 값이 있다.
      fetchMeetingFlow(meetingId, {}, signal).catch(() => null),
    ])

    return {
      meetingId,
      detail,
      indexes: indexes?.results ?? [],
      summary,
      briefing,
      options: unfiltered?.filter_options ?? null,
    }
  }, [category])
}

export function useMeetingFlow(meetingId, participantIds, contentTypes) {
  return useResource(
    (signal) => (meetingId
      ? fetchMeetingFlow(meetingId, { participantIds, contentTypes }, signal)
      : Promise.resolve(null)),
    // 배열을 그대로 넣으면 매 렌더마다 새 배열이라 끝없이 다시 읽는다.
    [meetingId, participantIds.join(','), contentTypes.join(',')],
  )
}
