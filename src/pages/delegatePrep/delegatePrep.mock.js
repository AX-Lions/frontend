/**
 * 회의 대리 참석 준비 — 아직 서버에 없는 것.
 *
 * ## 왜 목 데이터인가
 *
 * `CLAUDE.md` 가 정한 순서가 **화면 정의 → 목 데이터 형태 확정 → 그 형태가 곧
 * API 계약 → 백엔드 구현** 이다. 이 화면(Figma `685:7160`)이 요구하는 것 중
 * **예상 논쟁점과 나의 입장은 백엔드에 아직 아무것도 없다.** `bordo-openapi.yaml`
 * 에도 없고 `Agenda` 는 다른 것이다 — 안건은 회의가 공유하는 항목이고, 논쟁점은
 * **갈릴 것을 미리 예상한 것**이라 선택지와 예측 근거를 갖는다.
 *
 * 그래서 여기서 형태를 확정한다. **이 파일의 모양을 바꾸는 것은 API 스펙을
 * 바꾸는 것이다.**
 *
 *     GET /api/v1/meetings/{meeting_id}/contentions
 *     → { results: [ Contention, ... ] }
 *
 *     Contention {
 *       id            string
 *       order         1 부터. 화면의 `논쟁점 01` 이 이 값이다
 *       title         "최종 QA 일정을 연기할 것인가, 기존 일정을 유지할 것인가?"
 *       options       [{ key: "A", label, hint }]  갈릴 두 갈래. 없으면 []
 *       prediction    { rationale, evidences: [Evidence] }
 *       my_stance     { text, updated_at } | null   내가 적어 둔 입장
 *     }
 *
 *     Evidence {
 *       kind      MEETING | TASK
 *       label     "이전 회의" · "작업 변경사항"
 *       subtitle  "8월 15일 · 기능 구현 범위 논의"
 *       actor     "최비성 · 14:32" · "서재민의 작업"
 *       body      인용문이나 변경 내용
 *       link      { label, href } | null
 *     }
 *
 * ## 상태는 서버가 주지 않는다
 *
 * `답변완료 · 답변중… · 답변필요` 는 뱃지 문구만 다른 것이 아니다. **답변필요만
 * 사용자가 지금 해야 할 일**이고, 나머지 둘은 이미 손을 댄 것이다. 하나로 묶으면
 * 회의 직전에 무엇부터 봐야 하는지가 사라진다.
 *
 * 그런데 셋 다 **가지고 있는 것에서 나온다.**
 *
 *     my_stance 가 있다        답변완료
 *     지금 펼쳐 본 줄이다      답변중...
 *     그 밖                    답변필요
 *
 * 특히 `답변중` 은 사람이 그 줄을 열어 답을 쓰려는 참이라는 뜻이라 **브라우저
 * 밖에서는 관측되지 않는다.** 서버가 그것까지 들고 있으면 다른 기기에서 열어 둔
 * 것이 여기서도 `답변중` 으로 보인다. 그래서 `status` 필드를 두지 않는다 —
 * 아무도 안 읽는 필드를 계약에 남기면 백엔드가 그것을 채우려 든다.
 *
 * ## 근거를 함께 준다
 *
 * Bordo 가 "이 논쟁이 생길 것 같다" 고만 하면 사용자는 그 말을 검증할 수 없다.
 * 어느 회의의 누구 발언이었고 어느 작업이 어떻게 바뀌었는지까지 붙어야 **판단을
 * 맡길지 말지**를 사람이 정할 수 있다. 유보와 근거 제시가 이 서비스의 차별점이라
 * 예측 화면에서도 같은 원칙을 지킨다.
 */

const DEMO = [
  {
    id: 'contention-01',
    order: 1,
    title: '최종 QA 일정을 연기할 것인가, 기존 일정을 유지할 것인가?',
    options: [
      { key: 'A', label: 'A. QA 하루 연기', hint: '개발이 밀린 만큼 QA도 뒤로' },
      { key: 'B', label: 'B. 기존 일정 유지', hint: '범위를 줄여서라도 8월 17일 착수' },
    ],
    prediction: {
      rationale: '개발 완료 예정일이 하루 밀렸는데 최종 마감은 8월 18일 그대로라, QA에 쓸'
        + ' 시간이 반나절로 줄었어요. 일정을 미룰지 범위를 줄일지에서 의견이 갈릴 가능성이'
        + ' 있다고 판단했어요.',
      evidences: [
        {
          kind: 'MEETING',
          label: '이전 회의',
          subtitle: '8월 15일 · 기능 구현 범위 논의',
          actor: '서재민 · 15:07',
          body: '“QA는 마감 하루 전에는 시작해야 고칠 시간이 남아요.”',
          link: { label: '회의에서 보기 →', href: null },
        },
        {
          kind: 'TASK',
          label: '작업 변경사항',
          subtitle: '8월 16일 · QA 체크리스트',
          actor: '유수인의 작업',
          body: 'QA 항목이 12개에서 18개로 늘어났어요.',
          link: { label: '작업에서 보기 →', href: null },
        },
      ],
    },
    my_stance: {
      text: 'QA를 미루면 고칠 시간이 사라지니 일정은 그대로 갑니다. 대신 18개 전부를 보지 말고'
        + ' 시연 경로에 걸리는 항목부터 순서를 매겨 주세요. 못 본 항목은 남겨 두되 무엇을'
        + ' 안 봤는지는 적어 두면 좋겠습니다.',
      updated_at: null,
    },
  },
  {
    id: 'contention-02',
    order: 2,
    title: '개발 범위를 축소할 것인가, 기존 범위를 유지할 것인가?',
    options: [
      { key: 'A', label: 'A.핵심 기능만 구현', hint: '남은 기간을 고려해 기능 범위를 축소' },
      { key: 'B', label: 'B. 기존 기획 범위 유지', hint: '계획한 기능을 최대한 구현' },
    ],
    prediction: {
      rationale: '이전 회의에서 기능 범위를 축소하자는 의견이 있었고, 이후 개발 일정이 하루'
        + ' 지연되었어요. 따라서 이번 회의에서 구현 범위를 두고 의견이 갈릴 가능성이 있다고'
        + ' 판단했어요.',
      evidences: [
        {
          kind: 'MEETING',
          label: '이전 회의',
          subtitle: '8월 15일 · 기능 구현 범위 논의',
          actor: '최비성 · 14:32',
          body: '“남은 기간을 생각하면 핵심 기능부터 구현해야 할 것 같아요.”',
          link: { label: '회의에서 보기 →', href: null },
        },
        {
          kind: 'TASK',
          label: '작업 변경사항',
          subtitle: '8월 16일 · 개발 일정',
          actor: '서재민의 작업',
          body: '개발 완료 예정일이 8월 17일 → 8월 18일로 변경되었어요.',
          link: { label: '작업에서 보기 →', href: null },
        },
      ],
    },
    my_stance: null,
  },
  {
    id: 'contention-03',
    order: 3,
    title: '발표 완성도를 높이는 데에 집중할 것인가, 남은 기능 구현을 우선할 것인가?',
    options: [
      { key: 'A', label: 'A. 발표 완성도 우선', hint: '시연 흐름과 자료를 다듬기' },
      { key: 'B', label: 'B. 남은 기능 구현 우선', hint: '시연에 걸리는 기능을 마저 붙이기' },
    ],
    prediction: {
      rationale: '남은 기능 두 개가 모두 시연 화면에 걸쳐 있는데 리허설은 아직 한 번도 돌리지'
        + ' 못했어요. 같은 반나절을 어디에 쓸지 정해야 해서 의견이 갈릴 가능성이 있다고'
        + ' 판단했어요.',
      evidences: [
        {
          kind: 'MEETING',
          label: '이전 회의',
          subtitle: '8월 15일 · 시연 시나리오 점검',
          actor: '유수인 · 15:41',
          body: '“리허설을 한 번은 돌려 봐야 어디서 막히는지 알 것 같아요.”',
          link: { label: '회의에서 보기 →', href: null },
        },
        {
          kind: 'TASK',
          label: '작업 변경사항',
          subtitle: '8월 17일 · 발표 자료',
          actor: '임수연의 작업',
          body: '발표 자료 초안이 아직 시작되지 않았어요.',
          link: { label: '작업에서 보기 →', href: null },
        },
      ],
    },
    my_stance: null,
  },
]

export const STATUS_LABEL = {
  ANSWERED: '답변완료',
  ANSWERING: '답변 중',
  NEEDS_ANSWER: '답변필요',
}

/**
 * 서버가 생기면 이 함수만 `api.get` 으로 바꾼다.
 *
 * 부르는 쪽이 이미 `Promise` 를 기다리게 해 둬서, 바꿀 때 화면은 건드리지 않는다.
 * 목 데이터를 화면 안에 박아 두면 그 자리를 전부 찾아 고쳐야 한다.
 */
export function fetchContentions() {
  return Promise.resolve({ results: DEMO.map((row) => ({ ...row })) })
}
