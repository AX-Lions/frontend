import { useMemo, useState } from 'react'

import { GlobalSidebar } from '../../shared/components/GlobalSidebar.jsx'
import { Empty, LoadError, Loading } from '../../shared/components/LoadState.jsx'
import { useResource } from '../../lib/useResource.js'
import { navigate } from '../../app/navigation.js'
import { fetchInbox } from './inbox.data.js'
import './inbox.css'

/**
 * 내 요청함.
 *
 * Bordo가 대신 활동하며 사용자의 답변 · 확인 · 승인이 필요한 것을 회의 구분
 * 없이 날짜별로 모아 보여준다(시안 `666:5248`).
 *
 * ## 날짜는 오늘만 펼쳐서 보여준다
 *
 * 시안 이름이 `홈화면_요청함 선택` 이다 — 오늘 하나만 펼쳐지고 나머지 날짜는
 * 제목 줄만 보이다가 눌러야 열린다. 처리할 것이 쌓일수록 날짜가 늘어나는
 * 화면이라, 전부 펼쳐 두면 오래된 날짜를 훑느라 정작 오늘 것을 놓친다.
 */
export function InboxPage() {
  const { data, error, loading, reload } = useResource(fetchInbox, [], { cacheKey: 'inbox' })
  const [query, setQuery] = useState('')
  const [openDates, setOpenDates] = useState(null)

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

  if (loading && !data) {
    return (
      <div className="inbox-page">
        <GlobalSidebar active="inbox" />
        <Loading label="요청함을 불러오는 중입니다…" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="inbox-page">
        <GlobalSidebar active="inbox" />
        <LoadError error={error} onRetry={reload} />
      </div>
    )
  }

  return (
    <div className="inbox-page">
      <GlobalSidebar active="inbox" />

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
    </div>
  )
}

function InboxCard({ item, onOpen }) {
  const rows = [
    { label: '답변 필요', count: item.needs_answer },
    { label: '확인 필요', count: item.needs_confirm },
    { label: '승인 필요', count: item.needs_approval },
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
            onClick={onOpen}
          >
            <span>{row.label}</span>
            <span className="inbox-card-count">{row.count}</span>
          </button>
        ))}
      </div>
    </article>
  )
}
