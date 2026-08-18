/**
 * 새 프로젝트 · 새 팀 팝업이 나눠 쓰는 입력 칸.
 *
 * 둘은 **한 흐름**이다 — 프로젝트 팝업에서 `+ 새로운 팀 생성하기` 를 누르면
 * 팀 팝업으로 바뀌고, 팀을 만들면 그 팀이 골라진 채로 돌아온다. 그래서 칸
 * 모양을 같은 것으로 둔다.
 */

/**
 * 시안의 `시스템 프롬프트 입력창` — 한 줄 입력 + 오른쪽 `입력버튼`.
 *
 * 단추는 **Enter 와 같은 것**이다. 시안에 단추가 있는데 아무 일도 안 하게 두면
 * 누른 사람은 저장이 안 된 줄 알고 다시 누른다. 그래서 `onSubmit` 을 받아
 * 둘을 한 자리에 묶는다 — 값을 확정하고 다음 칸으로 넘긴다.
 *
 * 한글은 조합 중에도 Enter 가 온다(`isComposing`). 걸러 내지 않으면 글자를
 * 만드는 도중에 다음 칸으로 튄다.
 */
export function TextBox({
  value,
  onChange,
  onSubmit,
  placeholder,
  ariaLabel,
  inputRef,
  disabled = false,
  maxLength = 120,
}) {
  return (
    <div className="np-box">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            onSubmit?.()
          }
        }}
      />
      <button
        className="np-send"
        type="button"
        aria-label="입력"
        disabled={disabled}
        onClick={onSubmit}
      >
        <img src="/icons/CornerDownRight.svg" alt="" />
      </button>
    </div>
  )
}

/** 숫자만 받는 작은 칸(`2026` `08` `20`). 단위는 칸 안 오른쪽에 붙는다. */
export function NumberBox({
  value,
  onChange,
  unit,
  width,
  ariaLabel,
  placeholder = '',
  disabled = false,
  maxLength = 2,
}) {
  return (
    <div className={`np-box ${width}`}>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel}
        // 숫자만 남긴다. `type="number"` 는 브라우저마다 화살표가 붙어
        // 57px 칸 안에서 값이 잘린다.
        onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
      />
      {unit ? <span className="np-unit">{unit}</span> : null}
    </div>
  )
}
