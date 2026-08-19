import { useEffect, useMemo, useState } from 'react'

import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { useResource } from '../../lib/useResource.js'
import { navigate } from '../../app/navigation.js'
import { getCurrentTeamId, onCurrentTeamChange } from '../../lib/currentTeam.js'
import { NewProjectDialog } from '../home/NewProjectDialog.jsx'
import { Sidebar } from '../home/Sidebar.jsx'
import { fetchHome } from '../home/home.api.js'
// `Sidebar` 는 자기 스타일을 안 갖고 다닌다(`.sidebar` · `.home-layout` 이
// 전부 `home.css` 에 있다) — 회의 일정 화면과 같은 이유로 여기서도 가져온다.
import '../home/home.css'
import { ApprovalDialog } from './ApprovalDialog.jsx'
import { fetchInbox } from './inbox.data.js'
import './inbox.css'
import './approval.css'

/**
 * 내 요청함.
 *
 * Bordo가 대신 활동하며 사용자의 답변 · 확인 · 승인이 필요한 것을 회의 구분
 * 없이 날짜별로 모아 보여준다(시안 `666:5248`).
 *
 * ## 왼쪽은 홈과 같은 사이드바다
 *
 * 세로 아이콘 레일(`GlobalSidebar`)을 쓰고 있었다. 시안(`666:5248`)의 왼쪽은
 * **홈과 똑같은 240px 사이드바**다 — 로고 밑 아이콘 줄에 요청함이 켜진 채로
 * 있고, 그 아래로 프로젝트 목록이 그대로 이어진다. 요청함은 홈에서 아이콘
 * 하나를 눌러 들어오는 자리라, 들어오자마자 왼쪽이 좁은 레일로 바뀌면 다른
 * 앱에 온 것처럼 보인다.
 *
 * ## 날짜는 오늘만 펼쳐서 보여준다
 *
 * 시안 이름이 `홈화면_요청함 선택` 이다 — 오늘 하나만 펼쳐지고 나머지 날짜는
 * 제목 줄만 보이다가 눌러야 열린다. 처리할 것이 쌓일수록 날짜가 늘어나는
 * 화면이라, 전부 펼쳐 두면 오래된 날짜를 훑느라 정작 오늘 것을 놓친다.
 */
export function InboxPage() {
  const { data, error, loading, reload } = useResource(fetchInbox, [], { cacheKey: 'inbox' })
  // 사이드바가 그릴 프로젝트 목록·바로가기·프로필. 홈이 이미 한 번에 주므로
  // 요청함 전용 요청을 따로 만들지 않는다(`cacheKey` 도 같아 재사용된다).
  const home = useResource(fetchHome, [], { cacheKey: 'home' })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [addingProject, setAddingProject] = useState(false)
  const [currentTeamId, setCurrentTeamIdState] = useState(getCurrentTeamId)
  useEffect(() => onCurrentTeamChange(setCurrentTeamIdState), [])
  const [query, setQuery] = useState('')
  const [openDates, setOpenDates] = useState(null)
  // 「승인 필요」 줄이 여는 팝업의 대상 태스크. 항목마다 태스크가 여럿일 수
  // 있어(`pending_approval_task_ids`) 맨 앞 것부터 하나씩 처리한다.
  const [approvingTaskId, setApprovingTaskId] = useState(null)

  const groups = useMemo(() => data?.groups ?? [], [data])

  // 첫 데이터가 도착했을 때만 "오늘"을 연다. 그 뒤로는 사용자가 접고 편 상태를
  // `reload` 가 건드리지 않는다 — 검토 중이던 날짜가 새로고침마다 도로 닫히면
  // 어디까지 봤는지 잃는다.
  const effectiveOpenDates = openDates ?? new Set(groups.slice(0, 1).map((g) => g.date_key))

  const toggleDate = (dateKey) => {
    const next = new Set(effectiveOpenDates)
    if (next.has(dateKey)) {
      next.delete(dateKey)
    } else {
      next.add(dateKey)
    }
    setOpenDates(next)
  }

  const filteredGroups = useMemo(() => {
    const q = query.trim()
    if (!q) {
      return groups
    }
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.title.includes(q) || item.project_label.includes(q)),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, query])

  const homeData = home.data
  const inCurrentTeam = (project) => !currentTeamId || project.team_id === currentTeamId

  /*
    사이드바는 요청함이 실패해도 자리에 있어야 한다. 요청함을 못 불러왔다고
    프로젝트로 갈 길까지 사라지면 사용자는 새로고침 말고 할 수 있는 것이 없다.
  */
  const sidebar = (
    <Sidebar
      active="inbox"
      isCollapsed={isSidebarCollapsed}
      onToggleCollapse={() => setIsSidebarCollapsed((was) => !was)}
      favoriteProjects={(homeData?.favorite_projects ?? []).filter(inCurrentTeam)}
      recentProjects={(homeData?.recent_projects ?? []).filter(inCurrentTeam)}
      shortcuts={homeData?.shortcuts}
      userName={homeData?.user_name}
      avatarUrl={homeData?.user_avatar_url}
      onAddProject={() => setAddingProject(true)}
    />
  )

  if (loading && !data) {
    return (
      <div className="home-layout inbox-page">
        {sidebar}
        <Loading label="요청함을 불러오는 중입니다…" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="home-layout inbox-page">
        {sidebar}
        <LoadError error={error} onRetry={reload} />
      </div>
    )
  }

  return (
    <div className="home-layout inbox-page">
      {sidebar}

      <main className="inbox-main">
        <header className="inbox-header">
          <div className="inbox-heading">
            <h1>내 요청함</h1>
            <p>Bordo가 대신 활동하며 사용자의 답변이나 확인이 필요한 내용을 모아두었어요.</p>
          </div>
          <div className="inbox-search">
            <img src="/icons/Search.svg" alt="" aria-hidden="true" />
            <input
              type="search"
              placeholder="검색어를 입력하세요..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="요청함 검색"
            />
          </div>
        </header>

        {groups.length === 0 ? (
          <Empty>아직 처리할 요청이 없습니다.</Empty>
        ) : query && filteredGroups.length === 0 ? (
          <Empty>“{query}”와 일치하는 요청이 없습니다.</Empty>
        ) : (
          <div className="inbox-groups">
            {filteredGroups.map((group) => {
              const isOpen = Boolean(query) || effectiveOpenDates.has(group.date_key)

              return (
                <section className="inbox-group" key={group.date_key}>
                  <button
                    type="button"
                    className="inbox-group-heading"
                    onClick={() => toggleDate(group.date_key)}
                    aria-expanded={isOpen}
                  >
                    <span>{group.date_label}</span>
                    <img
                      className={isOpen ? 'inbox-chevron is-open' : 'inbox-chevron'}
                      src="/icons/ExpandDown.svg"
                      alt=""
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen ? (
                    group.items.length === 0 ? (
                      <p className="inbox-group-empty">이 날짜엔 처리할 요청이 없습니다.</p>
                    ) : (
                      <div className="inbox-cards">
                        {group.items.map((item) => (
                          <InboxCard
                            key={item.id}
                            item={item}
                            onOpen={() => navigate(`/flow-board?meeting=${item.meeting_id}`)}
                            onApprove={() => setApprovingTaskId(item.pending_approval_task_ids?.[0] ?? null)}
                          />
                        ))}
                      </div>
                    )
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </main>

      {approvingTaskId ? (
        <ApprovalDialog
          taskId={approvingTaskId}
          onClose={() => setApprovingTaskId(null)}
          // 승인·반려 뒤 다시 읽는다. 처리한 태스크는 `applyTaskPatches` 가
          // 걸러내므로 뱃지 숫자가 그만큼 줄어든 채로 돌아온다.
          onResolved={() => reload()}
        />
      ) : null}

      {addingProject ? (
        <NewProjectDialog
          onClose={() => setAddingProject(false)}
          onCreated={(project) => home.setData((current) => (current ? {
            ...current,
            recent_projects: [project, ...(current.recent_projects ?? [])],
            project_progress: [project, ...(current.project_progress ?? [])],
          } : current))}
        />
      ) : null}
    </div>
  )
}

function InboxCard({ item, onOpen, onApprove }) {
  const rows = [
    { label: '답변 필요', count: item.needs_answer, onClick: onOpen },
    { label: '확인 필요', count: item.needs_confirm, onClick: onOpen },
    { label: '승인 필요', count: item.needs_approval, onClick: onApprove },
  ]

  return (
    <article className="inbox-card">
      <div className="inbox-card-head">
        <span className="inbox-card-project">{item.project_label}</span>
        {item.urgent ? <span className="inbox-card-dot" aria-hidden="true" /> : null}
      </div>

      <h3 className="inbox-card-title">{item.title}</h3>
      <hr className="inbox-card-divider" />

      <div className="inbox-card-rows">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            className="inbox-card-row"
            disabled={row.count === 0}
            onClick={row.onClick}
          >
            <span>{row.label}</span>
            <span className="inbox-card-count">{row.count}</span>
          </button>
        ))}
      </div>
    </article>
  )
}
