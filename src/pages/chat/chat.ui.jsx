import { icons } from './chat.icons.js'

/**
 * 채팅 화면 여러 곳이 같이 쓰는 조각.
 *
 * 목록·대화창·설정이 각각 자기 아이콘 버튼과 아바타를 들고 있으면, 뱃지 하나를
 * 고칠 때 세 군데를 찾아야 한다. 실제로 아바타 규칙(대리인인지 사람인지)이
 * 목록과 대화창에서 따로 적혀 있었다.
 */

export function Icon({ src, alt = '', className = 'ui-icon' }) {
  return <img className={className} src={src} alt={alt} />
}

export function IconButton({ children, label, active = false, disabled = false, onClick }) {
  return (
    <button
      className={active ? 'chat-icon-button active' : 'chat-icon-button'}
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function RequestIcon({ muted = false, small = false }) {
  return (
    <Icon
      className={small ? 'request-icon small' : 'request-icon'}
      src={muted ? icons.requestSmall : icons.request}
    />
  )
}

export function BordoAvatar({ small = false }) {
  return (
    <span className={small ? 'bordo-avatar small' : 'bordo-avatar'} aria-hidden="true">
      <Icon className="bordo-avatar-icon" src={icons.profile} />
    </span>
  )
}

/**
 * 단체방 썸네일.
 *
 * 서버가 참여자 아바타를 최대 4장 준다(`avatar_urls`). 예전에는 이 자리에
 * `/flowchart/profile-1..3.jpeg` 세 장이 박혀 있어서 **어느 방이든 같은 세 사람
 * 얼굴**이 떴다 — 썸네일이 방을 구분해 주기는커녕 방들이 다 같아 보였다.
 *
 * 아바타를 아직 아무도 안 올린 방은 빈 자리로 둔다. `src` 가 비면 브라우저가
 * 깨진 이미지 아이콘을 그리므로 `img` 를 아예 안 만든다.
 */
export function AvatarStack({ avatars = [] }) {
  const shown = avatars.filter(Boolean).slice(0, 4)

  if (shown.length === 0) {
    return (
      <span className="avatar-stack empty" aria-hidden="true">
        <Icon className="bordo-avatar-icon" src={icons.profile} />
      </span>
    )
  }

  return (
    <span className="avatar-stack" aria-hidden="true">
      {shown.map((url, index) => (
        <img alt="" key={`${url}-${index}`} src={url} />
      ))}
    </span>
  )
}

/**
 * 미읽음 뱃지.
 *
 * 0 이면 아예 그리지 않는다. `0` 을 띄우면 사용자는 그것도 볼 것이 남은 것으로
 * 읽는다 — 뱃지의 뜻은 숫자가 아니라 "여기 볼 것이 있다" 다.
 *
 * 세 자리부터 `99+` 로 줄인다. 접힌 팀의 합계는 세 자리가 쉽게 나오는데,
 * 그러면 뱃지가 팀 이름을 밀어낸다.
 */
export function UnreadBadge({ count, label }) {
  if (!count) {
    return null
  }

  return (
    <span className="unread-badge" title={label ? `${label} · 안 읽은 메시지 ${count}건` : undefined}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
