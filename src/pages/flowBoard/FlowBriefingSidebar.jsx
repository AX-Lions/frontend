import { useState } from 'react'
import { FlowMetricBadge } from './FlowMetricBadge'

const bordoBriefing = {
  title: 'Bordo 브리핑',
  overview:
    '이번 회의에서는 백엔드 개발 진행 상황과 프론트엔드/디자인 싱크를 중심으로 논의했어요. API 연동 일정이 변경되었으며, 디자인 최종안은 다음 회의 전까지 확정하기로 했어요.',
  tags: [
    { label: '중요', count: 3 },
    { label: '결정', count: 3 },
    { label: '요청사항', count: 2 },
    { label: '변동사항', count: 4 },
  ],
  checks: [
    {
      title: '백엔드 개발 일정 변경',
      body: 'API 연동 완료일이 8/16 -> 8/19로 변경됐어요.',
    },
    {
      title: '디자인 수정 요청',
      body: '임수연님이 회의 화면의 우측 패널 너비 조정을 요청했어요.',
    },
  ],
  requests: [
    {
      title: '8/15까지 회의 화면 디자인 수정',
      body: '서재민님이 요청했어요.',
    },
    {
      title: '수정된 화면 개발팀에 공유',
      body: '다음 회의 전까지 확인이 필요해요.',
    },
  ],
}

function RecordGroup({ group }) {
  return (
    <article className="record-group">
      <header className="record-group-heading">
        <span>
          <FlowMetricBadge tone={group.tone} />
          {group.label}
        </span>
        <button type="button" aria-label={`${group.label} 더보기`}>
          ···
        </button>
      </header>
      <div className="record-item-list">
        {group.items.map((item) => (
          <div className="record-item" key={`${group.label}-${item.title}-${item.meta}`}>
            <h5>{item.title}</h5>
            <p>{item.body}</p>
            <time>{item.meta}</time>
          </div>
        ))}
      </div>
    </article>
  )
}

export function FlowBriefingSidebar({
  activeBriefTag,
  icons,
  isChatActive,
  isSearchActive,
  isScrolled,
  meetingRecord,
  mode = 'meeting',
  onBriefTagToggle,
  onChatActiveChange,
  onScroll,
  onSearchActiveChange,
}) {
  const [chatValue, setChatValue] = useState('')
  const [stuckSectionTitle, setStuckSectionTitle] = useState(null)
  const canSend = chatValue.trim().length > 0
  const handleRecordScroll = (event) => {
    onScroll(event)

    const scrollElement = event.currentTarget
    const containerRect = scrollElement.getBoundingClientRect()
    const stuckHeading = Array.from(scrollElement.querySelectorAll('.record-section h3')).find((heading) => {
      const headingRect = heading.getBoundingClientRect()
      const sectionRect = heading.parentElement.getBoundingClientRect()

      return headingRect.top <= containerRect.top + 1 && sectionRect.bottom > containerRect.top + headingRect.height
    })

    setStuckSectionTitle(stuckHeading?.textContent ?? null)
  }

  if (mode === 'bordo') {
    return (
      <aside
        className={isScrolled ? 'briefing-panel record-panel bordo-panel is-record-scrolled' : 'briefing-panel record-panel bordo-panel'}
        aria-label={bordoBriefing.title}
      >
        <header className={isScrolled ? 'briefing-header is-scrolled' : 'briefing-header'}>
          <h2>{bordoBriefing.title}</h2>
          <label className={isSearchActive ? 'brief-search is-active' : 'brief-search'}>
            <img src={icons.search} alt="" />
            <input
              type="search"
              aria-label="Bordo 브리핑 검색"
              placeholder="검색어를 입력하세요..."
              onFocus={() => onSearchActiveChange(true)}
              onBlur={(event) => onSearchActiveChange(event.currentTarget.value.trim().length > 0)}
            />
          </label>
        </header>

        <div className="briefing-scroll bordo-scroll" onScroll={onScroll}>
          <section className="bordo-section bordo-overview">
            <h3>회의 한눈에 보기</h3>
            <p>{bordoBriefing.overview}</p>
            <div className="brief-tags bordo-tags">
              {bordoBriefing.tags.map((tag) => (
                <button
                  className={activeBriefTag === tag.label ? 'is-active' : ''}
                  type="button"
                  key={tag.label}
                  onClick={() => onBriefTagToggle(tag.label)}
                >
                  {tag.label}
                  <b>{tag.count}</b>
                </button>
              ))}
            </div>
          </section>

          <section className="bordo-section bordo-action-section">
            <h3>확인이 필요해요</h3>
            <div className="bordo-card-list">
              {bordoBriefing.checks.map((item) => (
                <button className="bordo-action-card" type="button" key={item.title}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </span>
                  <img src={icons.expandRight} alt="" />
                </button>
              ))}
            </div>
          </section>

          <section className="bordo-section bordo-request-section">
            <h3>나에게 요청한 내용</h3>
            <div className="bordo-card-list">
              {bordoBriefing.requests.map((item) => (
                <article className="bordo-request-card" key={item.title}>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </article>
              ))}
            </div>
          </section>
        </div>

        <form className={isChatActive ? 'brief-chat is-active' : 'brief-chat'}>
          <textarea
            aria-label="Bordo에게 질문"
            placeholder="Bordo에게 물어보세요..."
            value={chatValue}
            onChange={(event) => setChatValue(event.currentTarget.value)}
            onFocus={() => onChatActiveChange(true)}
            onBlur={(event) => onChatActiveChange(event.currentTarget.value.trim().length > 0)}
          />
          <div>
            <button type="button" aria-label="내용 추가">
              <img src="/chat-icons/add-round.svg" alt="" />
            </button>
            <button type="button" aria-label="필터">
              <img src="/chat-icons/filter-alt.svg" alt="" />
            </button>
            <button className="send-button" type="submit" aria-label="보내기" disabled={!canSend}>
              <img src="/chat-icons/send-hor.svg" alt="" />
            </button>
          </div>
        </form>
      </aside>
    )
  }

  return (
    <aside
      className={isScrolled ? 'briefing-panel record-panel is-record-scrolled' : 'briefing-panel record-panel'}
      aria-label={meetingRecord.title}
    >
      <header className={isScrolled ? 'briefing-header is-scrolled' : 'briefing-header'}>
        <h2>{meetingRecord.title}</h2>
        <label className={isSearchActive ? 'brief-search is-active' : 'brief-search'}>
          <img src={icons.search} alt="" />
          <input
            type="search"
            aria-label="회의록 검색"
            placeholder="검색어를 입력하세요..."
            onFocus={() => onSearchActiveChange(true)}
            onBlur={(event) => onSearchActiveChange(event.currentTarget.value.trim().length > 0)}
          />
        </label>
      </header>

      <div className="briefing-scroll record-scroll" onScroll={handleRecordScroll}>
        <section className="record-highlight">
          <h3>{meetingRecord.highlightTitle}</h3>
          <p>{meetingRecord.highlight}</p>
          <div className="brief-tags">
            {meetingRecord.tags.map((tag) => (
              <button
                className={activeBriefTag === tag.label ? 'is-active' : ''}
                type="button"
                key={tag.label}
                onClick={() => onBriefTagToggle(tag.label)}
              >
                {tag.label}
                <b>{tag.count}</b>
              </button>
            ))}
          </div>
        </section>

        {meetingRecord.sections.map((section) => (
          <section className="record-section" key={section.title}>
            <h3 className={stuckSectionTitle === section.title ? 'is-stuck' : ''}>{section.title}</h3>
            <div className="record-group-list">
              {section.groups.map((group) => (
                <RecordGroup group={group} key={`${section.title}-${group.label}`} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <form className={isChatActive ? 'brief-chat is-active' : 'brief-chat'}>
        <textarea
          aria-label="회의록에 대해 질문"
          placeholder="Bordo에게 물어보세요..."
          value={chatValue}
          onChange={(event) => setChatValue(event.currentTarget.value)}
          onFocus={() => onChatActiveChange(true)}
          onBlur={(event) => onChatActiveChange(event.currentTarget.value.trim().length > 0)}
        />
        <div>
          <button type="button" aria-label="내용 추가">
            <img src="/chat-icons/add-round.svg" alt="" />
          </button>
          <button type="button" aria-label="필터">
            <img src="/chat-icons/filter-alt.svg" alt="" />
          </button>
          <button className="send-button" type="submit" aria-label="보내기" disabled={!canSend}>
            <img src="/chat-icons/send-hor.svg" alt="" />
          </button>
        </div>
      </form>
    </aside>
  )
}


