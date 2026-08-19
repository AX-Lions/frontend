import { useMemo } from 'react'

import { AppLink } from '../../app/AppLink.jsx'
import { FlowMetricBadge } from './FlowMetricBadge'

/**
 * 좌측 탐색 사이드바.
 *
 * ## 참여자 목록 정렬
 *
 * **체크된 사람 가나다 → 안 된 사람 가나다.** 서버가 주는 순서(가입 순)를
 * 그대로 쓰면 여섯 명만 넘어가도 방금 끈 사람이 목록 어디로 갔는지 못 찾는다.
 * 정렬은 체크 상태가 바뀔 때마다 다시 도므로, 끈 사람은 아래로 내려가고 켠
 * 사람은 위로 올라온다 — **무엇이 걸려 있는지가 목록의 위쪽만 봐도 보인다.**
 */
function sortParticipants(rows) {
  return [...rows].sort((a, b) => {
    if (a.checked !== b.checked) {
      return a.checked ? -1 : 1
    }
    return (a.label ?? '').localeCompare(b.label ?? '', 'ko')
  })
}

export function FlowNavigationSidebar({
  activeCategory,
  activeIndex,
  collapsedFilters,
  contentFilters,
  icons,
  indexEmptyText,
  indexes,
  isCollapsed,
  isScrolled,
  isTimeOrdered,
  onCategorySelect,
  onFilterCollapseToggle,
  onContentToggle,
  onIndexSelect,
  onParticipantKeywordChange,
  onParticipantSearchSubmit,
  onParticipantToggle,
  onScroll,
  onSidebarToggle,
  onTeamSwitch,
  onTimeOrderToggle,
  participantKeyword,
  participants,
  teamName,
}) {
  const keyword = participantKeyword.trim().toLowerCase()

  // 아무것도 입력 안 하면 전체가 보인다.
  const visibleParticipants = useMemo(() => sortParticipants(
    keyword
      ? participants.filter((p) => (p.label ?? '').toLowerCase().includes(keyword))
      : participants,
  ), [participants, keyword])

  return (
    <aside className={isCollapsed ? 'flow-sidebar is-collapsed' : 'flow-sidebar'} aria-label="회의 탐색">
      <header className={isScrolled ? 'team-header is-scrolled' : 'team-header'}>
        {/* 앱 안 이동이라 `AppLink` 다. 그냥 `<a href>` 로 두면 브라우저가
            문서를 통째로 다시 받아, 플로우에서 홈으로 갈 때마다 번들 재파싱과
            전체 재조회가 일어난다. */}
        <AppLink className="team-name" href="/">
          {teamName ?? '　'}
        </AppLink>
        {/*
          팀 전환하기(시안 `692:8230`, 여는 자리는 `576:4862`). 프로젝트 이름
          옆의 이 작은 순환 아이콘이 원래 그 자리다 — 컴포넌트 레이어 이름이
          `팀변경아이콘`이다. 아무 동작이 없던 자리를 새로고침으로 오해해서는
          안 된다.
        */}
        <button className="team-switch" type="button" aria-label="팀 전환하기" data-tip="팀 전환하기" onClick={onTeamSwitch}>
          <img src={icons.teamSwitch} alt="" />
        </button>
        <button
          className="sidebar-toggle"
          type="button"
          aria-label={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          data-tip={isCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          aria-expanded={!isCollapsed}
          onClick={onSidebarToggle}
        >
          <img className={isCollapsed ? 'is-collapsed' : ''} src={icons.expandLeftDouble} alt="" />
        </button>
      </header>

      <div className="sidebar-scroll" onScroll={onScroll}>
        <section className="sidebar-section categories" aria-labelledby="category-title">
          <h2 id="category-title">카테고리</h2>
          {/*
            `작업` 은 강조만 바뀌는 버튼이 아니다. 회의와 **경로가 다른** 조회로
            갈아탄다(`/projects/{id}/flow?from&to`). 같은 경로에 `category=WORK`
            를 붙이면 작업 엣지에는 회의가 없어 무엇을 넣든 0건이다.
          */}
          <button
            className={activeCategory === 'meeting' ? 'category-link selected' : 'category-link'}
            type="button"
            onClick={() => onCategorySelect('meeting')}
          >
            <img src={icons.bookCheck} alt="" />
            회의
          </button>
          <button
            className={activeCategory === 'work' ? 'category-link selected' : 'category-link'}
            type="button"
            onClick={() => onCategorySelect('work')}
          >
            <img src={icons.database} alt="" />
            작업
          </button>
        </section>

        <section className="sidebar-section index-section" aria-labelledby="index-title">
          <h2 id="index-title">인덱스</h2>
          {/*
            인덱스는 안건이다. 문자열이 아니라 `{id, label, related_edge_ids}` 라
            누르면 그 안건에 걸린 화살표로 갈 수 있다. 라벨을 key 로 쓰면 같은
            제목의 안건이 둘일 때 하나가 사라진다.
          */}
          <nav className="index-list">
            {indexes.length === 0 ? (
              <p className="index-empty">{indexEmptyText}</p>
            ) : indexes.map((item) => (
              <button
                className={activeIndex?.id === item.id ? 'selected' : ''}
                type="button"
                key={item.id}
                onClick={() => onIndexSelect(item)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </section>

        <section className="sidebar-section filter-section" aria-labelledby="filter-title">
          <h2 id="filter-title">필터링</h2>
          {/*
            핸들러도 상태도 없던 체크박스다. 켜면 서버가 준 `opacity`(최근일수록
            1 에 가깝다)를 선에 걸어 **최근 것이 진해진다.** 항상 걸어 두지 않는
            이유는 회의 초반에 오간 것이 늘 흐려 눈에 안 들어오기 때문이다.
          */}
          <label className="filter-toggle">
            <span>시간순</span>
            <input type="checkbox" checked={isTimeOrdered} onChange={onTimeOrderToggle} />
            <img className="checked-icon" src={icons.checked} alt="" />
            <img className="unchecked-icon" src={icons.unchecked} alt="" />
          </label>

          <button
            className={collapsedFilters.participants ? 'filter-heading is-collapsed' : 'filter-heading'}
            type="button"
            onClick={() => onFilterCollapseToggle('participants')}
          >
            참여자
            <img src={icons.expandDown} alt="" />
          </button>

          {!collapsedFilters.participants ? (
            <>
              {/*
                검색창은 체크박스 목록 **위**에 둔다. 아래에 두면 스크롤이 긴
                팀에서 검색창 자체를 찾아 내려가야 한다.

                엔터를 치면 걸러진 사람들만 체크된다 — 이미 다 체크된 기본
                상태에서 "더 켜기" 는 아무 변화가 없으므로, 검색은 **그 사람들만
                보기**라는 뜻이어야 쓸모가 있다.
              */}
              <form
                className="participant-search"
                onSubmit={(event) => {
                  event.preventDefault()
                  onParticipantSearchSubmit(visibleParticipants.map((p) => p.id))
                }}
              >
                <img src={icons.search} alt="" />
                <input
                  type="search"
                  aria-label="참여자 검색"
                  placeholder="사용자 이름 검색"
                  value={participantKeyword}
                  onChange={(event) => onParticipantKeywordChange(event.currentTarget.value)}
                />
              </form>

              {visibleParticipants.length === 0 ? (
                <p className="index-empty">찾는 이름이 없습니다.</p>
              ) : visibleParticipants.map((participant) => (
                /*
                  `defaultChecked` 에서 `checked` 로 바꿨다. 체크가 조회 조건이
                  되면서 **누른 것과 실제로 걸린 조건이 갈리면 안 되기** 때문이다.
                */
                <label className="check-row" key={participant.id}>
                  <span>{participant.label}</span>
                  <input
                    type="checkbox"
                    checked={participant.checked}
                    onChange={() => onParticipantToggle(participant.id)}
                  />
                  <img className="checked-icon" src={icons.checked} alt="" />
                  <img className="unchecked-icon" src={icons.unchecked} alt="" />
                </label>
              ))}
            </>
          ) : null}

          <button
            className={
              collapsedFilters.content ? 'filter-heading content-heading is-collapsed' : 'filter-heading content-heading'
            }
            type="button"
            onClick={() => onFilterCollapseToggle('content')}
          >
            내용
            <img src={icons.expandDown} alt="" />
          </button>
          {!collapsedFilters.content
            ? contentFilters.map((filter) => (
                <label className="check-row content-row" key={filter.value}>
                  <span>
                    <FlowMetricBadge tone={filter.tone} />
                    {filter.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={filter.checked}
                    onChange={() => onContentToggle(filter.value)}
                  />
                  <img className="checked-icon" src={icons.checked} alt="" />
                  <img className="unchecked-icon" src={icons.unchecked} alt="" />
                </label>
              ))
            : null}
        </section>
      </div>
    </aside>
  )
}
