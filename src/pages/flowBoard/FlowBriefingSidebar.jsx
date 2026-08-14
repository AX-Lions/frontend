export function FlowBriefingSidebar({
  activeBriefTag,
  activeReplyId,
  briefTags,
  checkItems,
  icons,
  isChatActive,
  isSearchActive,
  isScrolled,
  onBriefTagToggle,
  onChatActiveChange,
  onReplyToggle,
  onScroll,
  onSearchActiveChange,
  replyItems,
  requestItems,
}) {
  return (
    <aside className={activeReplyId ? 'briefing-panel has-active-reply' : 'briefing-panel'} aria-label="Zero 브리핑">
      <header className={isScrolled ? 'briefing-header is-scrolled' : 'briefing-header'}>
        <h2>Zero 브리핑</h2>
        <label className={isSearchActive ? 'brief-search is-active' : 'brief-search'}>
          <img src={icons.search} alt="" />
          <input
            type="search"
            aria-label="브리핑 검색"
            onFocus={() => onSearchActiveChange(true)}
            onBlur={(event) => onSearchActiveChange(event.currentTarget.value.trim().length > 0)}
          />
        </label>
      </header>

      <div className="briefing-scroll" onScroll={onScroll}>
        <section className="brief-section overview">
          <h3>회의 한눈에 보기</h3>
          <p>
            이번 회의에서는 백엔드 개발 진행 상황과 프론트엔드/디자인 싱크를 중심으로 논의했어요. API 연동 일정이
            변경되었으며, 디자인 최종안은 다음 회의 전까지 확정하기로 했어요.
          </p>
          <div className="brief-tags">
            {briefTags.map((tag) => (
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

        <section className="brief-section">
          <h3>확인이 필요해요</h3>
          <div className="brief-card-list">
            {checkItems.map((item) => (
              <button className="brief-card" type="button" key={item.title}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
                <img src={icons.expandRight} alt="" />
              </button>
            ))}
          </div>
        </section>

        <section className="brief-section">
          <h3>나에게 요청한 내용</h3>
          <div className="brief-card-list">
            {requestItems.map((item) => (
              <button className="brief-card muted" type="button" key={item.title}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="brief-section reply-section">
          <h3>답변이 필요해요</h3>
          <div className="reply-card-list">
            {replyItems.map((item) => {
              const isActive = item.id === activeReplyId

              return (
                <button
                  className={isActive ? 'reply-card is-active' : 'reply-card'}
                  type="button"
                  key={item.id}
                  onClick={() => onReplyToggle(item.id)}
                >
                  <strong>{item.question}</strong>
                  <span>
                    <em>{item.meta}</em>
                    <b>{isActive ? '답변중...' : '답변하기'}</b>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <form className={isChatActive ? 'brief-chat is-active' : 'brief-chat'}>
        <textarea
          aria-label="Zero에게 질문"
          placeholder="Zero에게 물어보세요..."
          onFocus={() => onChatActiveChange(true)}
          onBlur={(event) => onChatActiveChange(event.currentTarget.value.trim().length > 0)}
        />
        <div>
          <button type="button" aria-label="내용 추가">
            <img src={icons.add} alt="" />
          </button>
          <button type="button" aria-label="필터">
            <span />
          </button>
          <button className="send-button" type="submit" aria-label="보내기">
            ›
          </button>
        </div>
      </form>
    </aside>
  )
}
