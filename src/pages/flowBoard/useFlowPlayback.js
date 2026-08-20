import { useCallback, useEffect, useState } from 'react'

/**
 * 한 칸 넘어가는 데 걸리는 시간.
 *
 * 0.5초로 뒀었는데 실제로 써 보니 너무 빨라, 새로 뜬 화살표를 읽기도 전에
 * 다음 칸으로 넘어갔다. 1.1초로 늘린다 — 스무 건짜리 회의를 끝까지 보는
 * 데 22초쯤 걸리지만, 뒤로·앞으로 버튼이 있어 급한 사람은 직접 넘기면 된다.
 */
const STEP_INTERVAL_MS = 1100

/**
 * 맥락 재생.
 *
 * 판을 한 번에 다 그리면 화살표 스무 개가 동시에 눈에 들어와, **무엇이 먼저고
 * 무엇이 그것의 대답인지**가 사라진다. 이 화면이 답해야 하는 질문은 "내가 없는
 * 동안 무슨 일이 있었지" 이고, 그 답에서 순서는 곁가지가 아니라 내용 자체다.
 * 그래서 시간 오름차순으로 한 건씩 쌓아 다시 보여준다.
 *
 * 훅은 **몇 번째까지 드러났는지(`step`)만 센다.** 무엇을 그릴지는 부르는 쪽이
 * 정한다 — 판도 왼쪽 목록도 같은 `step` 하나를 보고 각자 거른다. 여기서 엣지
 * 배열을 들고 있으면 필터가 바뀔 때마다 이 훅까지 따라 고쳐야 하고, 판과
 * 목록이 서로 다른 기준으로 거를 여지가 생긴다.
 *
 * `total` 은 지금 판에 드러날 수 있는 전달 내용의 개수다. 다른 회의를 열면 이
 * 값이 바뀌고, 그때 재생은 멈춘다.
 */
export function useFlowPlayback(total) {
  /*
    "재생 중" 을 상태로 들고 있지 않는다. **몇 개짜리 판에서 시작했는지**만
    적어 두고 재생 여부는 매 렌더에서 계산한다.

    처음에는 `isPlaying` 을 `useState` 로 두고 끝에 닿으면 effect 안에서
    내렸는데, effect 본문의 setState 는 렌더를 한 번 더 부른다
    (`react-hooks/set-state-in-effect`). 게다가 끝났다는 사실은 이미
    `step` 과 `total` 안에 다 들어 있어서, 같은 정보를 상태로 한 벌 더 들고
    있다가 둘이 어긋나는 쪽이 위험하다.

    - `startedFor !== total` — 시작할 때와 다른 판이다. 회의나 모드가 바뀌었다.
    - `step >= total` — 끝까지 다 드러났다.

    앞의 조건은 **개수로** 판을 구별하므로, 재생 도중에 12건 → 8건 → 12건으로
    돌아오면 재생이 되살아난다. 0.5초 간격 안에 필터를 두 번 되돌려야 나오는
    경우라 그대로 둔다 — 되살아나 봐야 순서대로 다시 그려질 뿐이다.
  */
  const [startedFor, setStartedFor] = useState(null)
  const [isPaused, setIsPaused] = useState(false)
  const [step, setStep] = useState(0)

  const isPlaying = startedFor === total && step < total
  /*
    끝까지 다 봤다 — `isPlaying` 이 스스로 내려가는 바로 그 조건의 반대쪽이다.
    `stop()` 을 부른 적이 없어야 하므로 `startedFor === total` 도 같이 본다 —
    안 그러면 재생을 한 번도 안 한 판(`startedFor === null`)도 우연히
    `step >= total`(둘 다 0) 이 되어 "끝까지 봤다" 로 잘못 읽힌다.

    이 값이 필요한 이유 — 재생이 끝나면 `isPlaying` 이 꺼지면서 오른쪽
    「전체 회의록」 패널도 같이 닫혔다. 방금 다 본 것을 다시 훑어볼 새도 없이
    치워지는 것이라, 끝났다는 사실을 따로 들고 있다가 패널을 그대로 열어
    둔다(`FlowBoardPage.jsx`).
  */
  const isFinished = startedFor === total && total > 0 && step >= total

  /*
    돌려주는 함수는 전부 `useCallback` 으로 감싼다. 부모가 "패널을 닫으면 재생을
    끈다" 같은 effect 의 의존성에 이것들을 넣기 때문인데, 매번 새 함수가 나가면
    그 effect 가 렌더마다 다시 돌아 **재생이 시작되자마자 스스로 꺼진다.**
  */
  const stop = useCallback(() => {
    setStartedFor(null)
    setIsPaused(false)
    setStep(0)
  }, [])

  /*
    재생 중에 눌러도 처음부터 다시다.

    말린 화살표는 재생 중에 `처음부터 다시` 로 라벨이 바뀐다. 중간까지 보다가
    "어? 방금 그게 뭐였지" 싶을 때 누르는 자리라, 여기서 토글(멈춤)로 동작하면
    **멈추려던 사람도 다시 보려던 사람도 원하는 것을 못 얻는다.** 멈추는 일은
    옆의 일시정지가 맡는다.
  */
  const start = useCallback(() => {
    // 그릴 것이 없으면 판이 빈 채로 재생 중이 되어 조작 버튼만 덩그러니 뜬다.
    if (total === 0) {
      return
    }

    setStep(0)
    setIsPaused(false)
    setStartedFor(total)
  }, [total])

  const togglePause = useCallback(() => {
    setIsPaused((paused) => !paused)
  }, [])

  /*
    뒤로·앞으로는 **누르는 순간 일시정지한다.**

    안 그러면 0.5초 뒤 타이머가 한 칸을 도로 밀어 올려, 뒤로 간 것이 저절로
    되돌아온다. 버튼이 아무 뜻도 없어지는 셈이다. 손으로 넘기기 시작했다는 것
    자체가 "자동으로 흘러가지 말라" 는 뜻이라고 읽는다.
  */
  const stepBack = useCallback(() => {
    setIsPaused(true)
    setStep((current) => Math.max(0, current - 1))
  }, [])

  /*
    끝에 닿으면 `step === total` 이 되어 `isPlaying` 이 스스로 내려간다 —
    앞으로 버튼으로 마지막 칸을 밟는 것과 타이머가 밟는 것이 같은 결말이다.
  */
  const stepForward = useCallback(() => {
    setIsPaused(true)
    setStep((current) => Math.min(total, current + 1))
  }, [total])

  /*
    한 칸씩 밀어 올리는 타이머.

    `setTimeout` 을 effect 안에서 걸고 cleanup 에서 반드시 지운다. 안 지우면
    회의를 바꿔도 이전 타이머가 계속 돌아 **남의 판이 저 혼자 움직인다.**
    `step` 이 의존성에 있어 한 칸마다 타이머를 새로 걸므로, 일시정지도 회의
    전환도 다음 칸이 오기 전에 확실히 끊긴다. 끝에 닿으면 `isPlaying` 이
    내려가 다음 타이머가 아예 걸리지 않는다.
  */
  useEffect(() => {
    if (!isPlaying || isPaused) {
      return undefined
    }

    const timer = setTimeout(() => setStep(step + 1), STEP_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [isPaused, isPlaying, step])

  return {
    isFinished,
    isPaused,
    isPlaying,
    start,
    /*
      재생 중도 아니고 끝난 것도 아닐 때만 0 을 준다 — 시작한 적이 없거나
      `stop()` 으로 껐을 때다. 그때 `step` 이 마지막 숫자로 남아 있으면,
      부르는 쪽이 `isPlaying`(과 `isFinished`)을 빠뜨렸을 때 **판이 조용히
      그 숫자까지만 그린다.** 0 이면 "판이 비어 있다" 로 곧장 드러나 못
      보고 넘어가지 않는다.

      끝까지 봤을 때(`isFinished`)는 진짜 `step`(= `total`)을 그대로 준다 —
      「전체 회의록」이 끝난 뒤에도 열려 있으려면 드러난 전부를 계속 그릴
      수 있어야 한다.
    */
    step: isPlaying || isFinished ? step : 0,
    stepBack,
    stepForward,
    stop,
    togglePause,
  }
}
