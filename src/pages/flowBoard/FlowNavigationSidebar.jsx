import { AppLink } from '../../app/AppLink.jsx'

/**
 * 맥락 재생 조작 버튼 3종의 아이콘.
 *
 * 디자이너 에셋이 없다. 디자인 산출물은 디자이너가 직접 커밋하는 규칙이라
 * **개발자가 `public/icons` 에 SVG 파일을 새로 만들어 두지 않는다** — 나중에
 * 진짜 에셋이 들어올 때 같은 자리를 두고 파일이 둘이 되거나, 커밋 기록에 남의
 * 영역이 섞인다. 같은 이유로 `FlowMetricBadge` 가 작업 모드 다섯을 인라인으로
 * 그린다.
 *
 * 굵기와 끝처리는 `public/icons/Refresh.svg` 를 따라간다(1.33 · round). 바로
 * 옆에 나란히 서는 말린 화살표가 그 파일이라, 하나만 결이 다르면 두 아이콘이
 * 서로 다른 세트에서 온 것처럼 보인다. 색은 `currentColor` 라 상태별 색은 CSS
 * 가 정하고, 비활성일 때도 여기서 손댈 곳이 없다.
 */
const transportGlyphs = {
  // 뒤로 — 왼쪽 벽에 부딪히는 삼각형
  back: (
    <>
      <path d="M12.5 3.6v8.8L5.8 8z" />
      <path d="M3.5 3.6v8.8" />
    </>
  ),
  // 일시정지 — 나란한 두 획
  pause: <path d="M6.2 3.4v9.2M9.8 3.4v9.2" />,
  // 재생 — 오른쪽을 보는 삼각형
  play: <path d="M4.9 3.4v9.2L12.6 8z" />,
  // 앞으로 — 오른쪽 벽에 부딪히는 삼각형
  forward: (
    <>
      <path d="M3.5 3.6v8.8L10.2 8z" />
      <path d="M12.5 3.6v8.8" />
    </>
  ),
}

function TransportIcon({ shape }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.33333"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {transportGlyphs[shape]}
    </svg>
  )
}

/**
 * 줄 하나에 걸리는 클래스.
 *
 * 셋이 겹칠 수 있어 삼항 연산으로는 못 쓴다.
 *
 * - `selected` — 사람이 골라 둔 줄. 재생과 무관하게 유지된다.
 * - `is-upcoming` — **아직 안 드러난 줄.** 재생 중에만 붙는다. 판에서 아직 안
 *   그려진 화살표를 목록에서는 멀쩡히 보여주면 왼쪽과 오른쪽이 서로 다른
 *   이야기를 해서, 지금 몇 번째를 보고 있는지를 판에서만 세게 된다.
 * - `is-current` — 방금 드러난 줄. 목록에서 눈이 따라갈 지점이 여기다.
 *
 * 재생이 끝나면 `isPlaying` 이 내려가 뒤의 두 클래스가 한꺼번에 사라진다.
 * 끝난 판은 거르지 않은 전체를 그리므로 목록도 전체가 또렷해야 맞다.
 */
function timelineRowClass(item, activeEdgeId, playback) {
  const classes = []

  if (activeEdgeId === item.edge_id) {
    classes.push('selected')
  }

  if (playback.isPlaying && item.seq > playback.step) {
    classes.push('is-upcoming')
  }

  if (playback.isPlaying && item.seq === playback.step) {
    classes.push('is-current')
  }

  return classes.join(' ')
}

/**
 * 좌측 탐색 사이드바.
 *
 * ## 인덱스·필터링을 걷어내고 시간순 인덱스 하나로 바꿨다
 *
 * 예전에는 `안건 목록` 과 `필터링`(시간순 체크 · 참여자 검색 · 내용 종류)이
 * 세로로 쌓여 있었다. 셋 다 **판을 줄이는 도구**였는데, 정작 이 화면에 온
 * 사람이 알고 싶은 것은 "무엇을 지울까" 가 아니라 **"무슨 일이 어떤 순서로
 * 있었는가"** 다. 체크박스를 아무리 잘 다뤄도 그 답은 나오지 않는다.
 *
 * 그래서 자리를 통째로 내주고 **전달 내용 한 건 한 건을 시간 오름차순으로
 * 세운 목록**을 놓았다. 왼쪽 순번은 판의 화살표에 붙는 번호와 같아서, 목록에서
 * 본 것을 판에서 찾을 수 있다. `카테고리`(회의·작업)만 위에 그대로 남는다 —
 * 그쪽은 거르는 도구가 아니라 **다른 조회로 갈아타는** 자리다.
 *
 * ## 맥락 재생
 *
 * 제목 옆 말린 화살표를 누르면 판이 비워지고 0.5초 간격으로 한 건씩 다시
 * 쌓인다. 순서는 멈춰 있는 판에서 좀처럼 읽히지 않는다 — 화살표가 스무 개면
 * 어느 것이 먼저인지 세어 볼 방법이 없다. 시간을 실제로 흘려보내는 것이 가장
 * 짧은 설명이다.
 *
 * 세는 일은 `useFlowPlayback` 이 하고 여기는 받은 값(`playback`)을 그리기만
 * 한다. 같은 값을 판도 받으므로 왼쪽 목록과 판은 언제나 같은 지점을 가리킨다.
 */
export function FlowNavigationSidebar({
  activeCategory,
  activeEdgeId,
  icons,
  isCollapsed,
  isScrolled,
  onCategorySelect,
  onScroll,
  onSidebarToggle,
  onTeamSwitch,
  onTimelineSelect,
  playback,
  teamName,
  timeline,
  timelineEmptyText,
}) {
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

        <section className="sidebar-section timeline-section" aria-labelledby="timeline-title">
          <header className="timeline-head">
            <h2 id="timeline-title">시간순 인덱스</h2>

            {/*
              말린 화살표 — 맥락 재생.

              재생 중에는 라벨이 `처음부터 다시` 로 바뀐다. 같은 버튼이지만
              그때는 하는 일이 다르게 읽혀야 한다. 멈추는 일은 옆의 일시정지가
              맡으므로, 이 버튼은 언제 눌러도 처음으로 돌아간다.

              그릴 것이 없으면 막는다. 빈 판에서 재생이 시작되면 아무 변화 없이
              조작 버튼 세 개만 나타나 고장으로 읽힌다.
            */}
            <button
              className="timeline-play"
              type="button"
              aria-label={playback.isPlaying ? '처음부터 다시 재생' : '맥락 재생'}
              data-tip={playback.isPlaying ? '처음부터 다시' : '맥락 재생'}
              disabled={timeline.length === 0}
              onClick={playback.start}
            >
              <img src={icons.replay} alt="" />
            </button>

            {/*
              뒤로·일시정지·앞으로는 **재생 중에만** 뜬다. 늘 띄워 두면 아무
              일도 일어나지 않는 화면에서 세 버튼이 계속 회색으로 앉아 있어,
              제목 줄 전체가 재생기처럼 보인다. 이 줄의 주인은 목록이다.
            */}
            {playback.isPlaying ? (
              <div className="timeline-transport" role="group" aria-label="맥락 재생 조작">
                {/* 아직 아무것도 안 드러났으면 더 뒤로 갈 곳이 없다. */}
                <button
                  type="button"
                  aria-label="뒤로"
                  data-tip="뒤로"
                  disabled={playback.step <= 0}
                  onClick={playback.stepBack}
                >
                  <TransportIcon shape="back" />
                </button>
                {/*
                  멈춘 동안에는 ▶ 로 바뀐다. ⏸ 를 그대로 두면 "이미 멈췄는데 또
                  멈추라는 건가" 가 되어, 이어서 보려는 사람이 누를 곳을 잃는다.
                */}
                <button
                  type="button"
                  aria-label={playback.isPaused ? '재생' : '일시정지'}
                  data-tip={playback.isPaused ? '재생' : '일시정지'}
                  onClick={playback.togglePause}
                >
                  <TransportIcon shape={playback.isPaused ? 'play' : 'pause'} />
                </button>
                <button
                  type="button"
                  aria-label="앞으로"
                  data-tip="앞으로"
                  onClick={playback.stepForward}
                >
                  <TransportIcon shape="forward" />
                </button>
              </div>
            ) : null}
          </header>

          {/*
            한 줄이 전달 내용 한 건이다(의견·요청사항·변동사항·일정·결론…).
            `key` 는 반드시 `edge_id` 다 — 제목은 "일정 조율" 처럼 같은 것이
            여럿 나올 수 있어, 제목을 key 로 쓰면 그중 하나가 사라진다.

            말풍선에 `종류 · 방향 · 시각` 을 실어 둔 것은 줄에 제목만 남겼기
            때문이다. 목록이 목록으로 읽히려면 한 줄이 한 줄이어야 하는데,
            누가 누구에게 언제 한 말인지도 결국 필요하다. 그 셋을 말풍선으로
            미룬다.
          */}
          <nav className="timeline-list">
            {timeline.length === 0 ? (
              <p className="index-empty">{timelineEmptyText}</p>
            ) : timeline.map((item) => (
              <button
                className={timelineRowClass(item, activeEdgeId, playback)}
                type="button"
                key={item.edge_id}
                data-tip={`${item.label} · ${item.direction_label} · ${item.at_label}`}
                onClick={() => onTimelineSelect(item)}
              >
                <b className="timeline-seq">{item.seq}</b>
                <span className="timeline-title">{item.title}</span>
              </button>
            ))}
          </nav>
        </section>
      </div>
    </aside>
  )
}
