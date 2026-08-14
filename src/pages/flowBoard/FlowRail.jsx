export function FlowRail({ activeRail, icons, onRailSelect }) {
  return (
    <aside className="flow-rail" aria-label="주요 메뉴">
      <a
        className={activeRail === 'home' ? 'rail-link active' : 'rail-link'}
        href="/"
        aria-label="홈"
        onClick={() => onRailSelect('home')}
      >
        <img src={icons.home} alt="" />
      </a>
      <a
        className={activeRail === 'meeting' ? 'rail-link active' : 'rail-link'}
        href="/flow-board"
        aria-label="회의"
        onClick={() => onRailSelect('meeting')}
      >
        <img src={icons.bookCheck} alt="" />
      </a>
      <button
        className={activeRail === 'chat' ? 'rail-link active' : 'rail-link'}
        type="button"
        aria-label="채팅"
        onClick={() => onRailSelect('chat')}
      >
        <img src={icons.chat} alt="" />
      </button>
      <span className="rail-user" />
    </aside>
  )
}
