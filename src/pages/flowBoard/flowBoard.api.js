export const icons = {
  add: '/icons/AddIcon.svg',
  bookCheck: '/icons/Book_check.svg',
  chat: '/icons/Chat.svg',
  checked: '/icons/checked.svg',
  database: '/icons/Database.svg',
  expandDown: '/icons/ExpandDown.svg',
  expandLeftDouble: '/icons/Expand_left_double.svg',
  expandRight: '/icons/Expandright.svg',
  home: '/icons/HomeIcon.svg',
  refresh: '/icons/Refresh.svg',
  search: '/icons/Search.svg',
  unchecked: '/icons/unchecked.svg',
}

export const toneIcons = {
  opinion: '/flowchart/icons/opinion.svg',
  request: '/flowchart/icons/request.svg',
  change: '/flowchart/icons/change.svg',
  schedule: '/flowchart/icons/schedule.svg',
  conclusion: '/flowchart/icons/decision.svg',
  etc: '/flowchart/icons/decision.svg',
}

export const toneLabels = {
  opinion: '의견',
  request: '요청사항',
  change: '변동사항',
  schedule: '일정',
  conclusion: '결론',
  etc: '기타',
}

export const participants = [
  { name: '유수인', checked: true },
  { name: '서재민', checked: true },
  { name: '강다은', checked: true },
  { name: '임수연의 Bordo', checked: true },
  { name: '최보미', checked: false },
  { name: '전수진', checked: false },
]

export const contentFilters = [
  { name: '의견', tone: 'opinion', checked: true },
  { name: '요청사항', tone: 'request', checked: true },
  { name: '변동사항', tone: 'change', checked: true },
  { name: '일정', tone: 'schedule', checked: true },
  { name: '결론', tone: 'conclusion', checked: true },
  { name: '기타', tone: 'etc', checked: true },
]

export const indexes = [
  '진행 상황 공유',
  '백엔드 개발 논의',
  '프론트엔드 디자인 싱크 맞추기',
  '기획서 작성 방향 논의',
  '작업 마감 기한 논의',
]

export const summaryColumns = [
  {
    title: '발견한 문제',
    items: ['로그인 오류 발생', '모바일 화면 깨짐', 'API 응답 속도 저하', '알림 일부 누락', '사용자 피드백 부족'],
  },
  {
    title: '변동 사항',
    items: ['개발 일정 2일 연기', '담당자 변경', '디자인 시안 수정', '기능 우선순위 변경', '테스트 범위 확대'],
  },
  {
    title: '이후 계획',
    items: ['로그인 오류 수정', 'QA 테스트 진행', '수정안 최종 검토', '개발 팀에 내용 공유', '다음 회의에서 확정'],
  },
]

export const boardMetrics = {
  top: [
    { tone: 'opinion', count: 3 },
    { tone: 'request', count: 5 },
    { tone: 'change', count: 2 },
  ],
  left: [
    { tone: 'opinion', count: 3 },
    { tone: 'request', count: 2 },
    { tone: 'change', count: 2 },
  ],
  right: [
    { tone: 'opinion', count: 1 },
    { tone: 'request', count: 1 },
    { tone: 'change', count: 2 },
    { tone: 'schedule', count: 1 },
  ],
}

export const meetingRecord = {
  title: '서재민의 회의록',
  highlightTitle: '주요 발언',
  highlight:
    '로그인 오류는 인증 토큰 처리 과정에서 발생한 것 같아요. API 연동 일정은 이틀 정도 미뤄야 할 것 같습니다. 수정된 화면은 개발팀에 공유 부탁드려요.',
  tags: [
    { label: '의견', count: 3 },
    { label: '요청사항', count: 5 },
    { label: '변동사항', count: 4 },
    { label: '일정', count: 1 },
    { label: '결정', count: 1 },
  ],
  sections: [
    {
      title: '전달한 내용',
      groups: [
        {
          tone: 'opinion',
          label: '의견',
          items: [
            {
              title: '로그인 오류 원인',
              body: '“확인해보니까 토큰 만료 처리 쪽에서 문제가 발생하는 것 같아요.”',
              meta: '→ 임수연의 Bordo · 14:18',
            },
            {
              title: '에러 메시지 처리',
              body: '“그러면 로그인 실패 원인을 구분해서 메시지를 보여주는 건 어떤가요.”',
              meta: '→ 임수연의 Bordo · 14:24',
            },
            {
              title: '로딩 처리',
              body: '“API 응답이 늦어질 수 있어서 로딩 상태는 넣는 게 좋을 것 같습니다.”',
              meta: '→ 임수연의 Bordo · 14:31',
            },
            {
              title: '로그인 유지 방식',
              body: '“사용자가 앱을 다시 실행했을 때 매번 로그인하지 않도록 로그인 상태를 일정 기간 유지하면 좋을 것 같아요.”',
              meta: '→ 강다은 · 18:04',
            },
          ],
        },
        {
          tone: 'request',
          label: '요청사항',
          items: [
            {
              title: '수정된 디자인 확인 요청',
              body: '“로그인 화면 수정된 시안 나오면 공유 부탁드릴게요.”',
              meta: '→ 임수연의 Bordo · 14:27',
            },
            {
              title: '프론트엔드 확인 요청',
              body: '“에러 코드 전달드리면 화면에서 어떻게 처리할지 한 번 확인해주세요.”',
              meta: '→ 임수연의 Bordo · 18:48',
            },
            {
              title: 'QA 테스트 요청',
              body: '“로그인 수정 완료되면 QA 한 번 같이 진행해주시면 될 것 같아요.”',
              meta: '→ 강다은 · 29:33',
            },
          ],
        },
        {
          tone: 'change',
          label: '변동사항',
          items: [
            {
              title: '비밀번호 오류 처리 변경',
              body: '“비밀번호 오류 발생 시 기존 공통 에러 메시지 대신 로그인 실패 사유를 구분해서 전달하도록 변경됐어요.”',
              meta: '→ 강다은 · 24:48',
            },
            {
              title: '로그인 처리 방식 변경',
              body: '“토큰 만료 시에는 재로그인시키는 방식으로 변경할게요.”',
              meta: '→ 임수연의 Bordo · 34:29',
            },
            {
              title: '개발 범위 변경',
              body: '“이번에는 소셜 로그인까지 말고 일반 로그인 수정까지만 진행하겠습니다.”',
              meta: '→ 강다은 · 41:01',
            },
            {
              title: '로그인 API 응답 구조 변경',
              body: '“로그인 API 응답값에 사용자 프로필 정보가 함께 포함되도록 응답 구조 변경했습니다.”',
              meta: '→ 강다은 · 41:01',
            },
          ],
        },
        {
          tone: 'schedule',
          label: '일정',
          items: [
            {
              title: 'API 연동 일정',
              body: '“API 연동 완료일은 8월 19일까지로 다시 잡겠습니다.”',
              meta: '→ 강다은 · 37:10',
            },
          ],
        },
      ],
    },
    {
      title: '전달받은 내용',
      groups: [
        {
          tone: 'opinion',
          label: '의견',
          items: [
            {
              title: '로그인 오류 원인',
              body: '“확인해보니까 토큰 만료 처리 쪽에서 문제가 발생하는 것 같아요.”',
              meta: '유수인 → · 14:18',
            },
            {
              title: '에러 메시지 처리',
              body: '“그러면 로그인 실패 원인을 구분해서 메시지를 보여주는 건 어떤가요.”',
              meta: '유수인 → · 14:24',
            },
            {
              title: '로딩 처리',
              body: '“API 응답이 늦어질 수 있어서 로딩 상태는 넣는 게 좋을 것 같습니다.”',
              meta: '유수인 → · 14:31',
            },
          ],
        },
        {
          tone: 'request',
          label: '요청사항',
          items: [
            {
              title: '수정된 디자인 확인 요청',
              body: '“로그인 화면 수정된 시안 나오면 공유 부탁드릴게요.”',
              meta: '유수인 → · 14:27',
            },
            {
              title: '프론트엔드 확인 요청',
              body: '“에러 코드 전달드리면 화면에서 어떻게 처리할지 한 번 확인해주세요.”',
              meta: '유수인 → · 18:48',
            },
            {
              title: 'QA 테스트 요청',
              body: '“로그인 수정 완료되면 QA 한 번 같이 진행해주시면 될 것 같아요.”',
              meta: '유수인 → · 29:33',
            },
          ],
        },
      ],
    },
  ],
}

export const BOARD_CONTENT_BOUNDS = {
  left: 0,
  top: 0,
  width: 776,
  height: 931,
}
