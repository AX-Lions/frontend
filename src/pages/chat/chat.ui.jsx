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

export function AvatarStack() {
  return (
    <span className="avatar-stack" aria-hidden="true">
      <img src="/flowchart/profile-1.jpeg" alt="" />
      <img src="/flowchart/profile-2.jpeg" alt="" />
      <img src="/flowchart/profile-3.jpeg" alt="" />
      <BordoAvatar small />
    </span>
  )
}
