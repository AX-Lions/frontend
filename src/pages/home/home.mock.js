export const mockHomeData = {
  user_name: '유수인',
  greeting_mode: 'BRIEFING_AVAILABLE',
  briefing_pending: {
    exists: true,
    meeting_id: 'mtg_hackathon_02',
    always_open: false,
  },
  recent_meetings: [
    {
      meeting_id: 'mtg_union_01',
      project_id: 'prj_union',
      title: '역할분담 및 문제정의 자료조사...',
      displayed_at: '2026.08.12 · 11:32',
      thumbnail_url: null,
      is_favorite: false,
    },
    {
      meeting_id: 'mtg_hackathon_01',
      project_id: 'prj_hackathon',
      title: '글로벌 회의 일정 및 개발 방향 논의...',
      displayed_at: '2026.08.12 · 11:32',
      thumbnail_url: null,
      is_favorite: true,
    },
    {
      meeting_id: 'mtg_hackathon_02',
      project_id: 'prj_hackathon',
      title: '글로벌 회의 일정 및 개발 방향 논의...',
      displayed_at: '2026.08.12 · 11:32',
      thumbnail_url: null,
      is_favorite: false,
    },
    {
      meeting_id: 'mtg_hackathon_03',
      project_id: 'prj_hackathon',
      title: '글로벌 회의 일정 및 개발 방향 논의...',
      displayed_at: '2026.08.12 · 11:32',
      thumbnail_url: null,
      is_favorite: false,
    },
    {
      meeting_id: 'mtg_hackathon_04',
      project_id: 'prj_hackathon',
      title: '글로벌 회의 일정 및 개발 방향 논의...',
      displayed_at: '2026.08.12 · 11:32',
      thumbnail_url: null,
      is_favorite: false,
    },
  ],
  today_schedule: [
    {
      at: '2026-08-14T09:00:00+09:00',
      time_range: '09:00 - 10:00',
      project_id: 'prj_hackathon',
      project_name: '멋사 중앙해커톤',
      location: 'Discord',
      title: '정기 팀 회의',
    },
    {
      at: '2026-08-14T13:00:00+09:00',
      time_range: '13:00 - 14:00',
      project_id: 'prj_hackathon',
      project_name: '멋사 중앙해커톤',
      location: 'Discord',
      title: '디자인 리뷰',
    },
    {
      at: '2026-08-14T17:00:00+09:00',
      time_range: '17:00 - 18:00',
      project_id: 'prj_hackathon',
      project_name: '멋사 중앙해커톤',
      location: 'Discord',
      title: '개발팀 Sync',
    },
  ],
  recent_meeting_summary: {
    meeting_id: 'mtg_hackathon_02',
    project_name: '멋사 중앙해커톤',
    title: '글로벌 회의 일정 및 개발 방향 논의',
    displayed_at: '08.12 · 11:32',
    status: '불참한 회의',
    main_decisions: ['8월 18일까지 디자인 시안 확정', '개발 일정 1주 연장'],
    zero_summary: '디자인 작업을 우선 진행한 후 개발팀에 전달하기로 결정했어요.',
  },
  project_progress: [
    {
      id: 'prj_union',
      team_id: 'team_ax',
      name: '연합학술제',
      is_favorite: false,
    },
    {
      id: 'prj_hackathon',
      team_id: 'team_ax',
      name: '멋사 중앙해커톤',
      is_favorite: true,
    },
    {
      id: 'prj_bordo',
      team_id: 'team_ax',
      name: '프로젝트 이름',
      is_favorite: false,
    },
  ],
  recent_projects: [
    {
      id: 'prj_union',
      team_id: 'team_ax',
      name: '프로젝트 이름',
      is_favorite: false,
    },
    {
      id: 'prj_hackathon',
      team_id: 'team_ax',
      name: '프로젝트 이름',
      is_favorite: true,
    },
    {
      id: 'prj_bordo',
      team_id: 'team_ax',
      name: '프로젝트 이름',
      is_favorite: false,
    },
    {
      id: 'prj_zero',
      team_id: 'team_ax',
      name: '프로젝트 이름',
      is_favorite: false,
    },
    {
      id: 'prj_design',
      team_id: 'team_ax',
      name: '프로젝트 이름',
      is_favorite: false,
    },
  ],
  favorite_projects: [
    {
      id: 'prj_hackathon',
      team_id: 'team_ax',
      name: '프로젝트 이름',
      is_favorite: true,
    },
  ],
}

export function getMockHomeData() {
  return structuredClone(mockHomeData)
}
