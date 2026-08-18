import { viewer as bisung } from './viewers/bisung.js'
import { viewer as daeun } from './viewers/daeun.js'
import { viewer as jaemin } from './viewers/jaemin.js'
import { viewer as sooyeon } from './viewers/sooyeon.js'
import { viewer as susu } from './viewers/susu.js'

/**
 * 사람마다 다른 것.
 *
 * 세계(팀 · 프로젝트 · 회의 · 오간 말)는 하나이고 여기 있는 것만 갈린다 —
 * 자기 대리인 방, 대리인 설정, 평소 지시, 그리고 **빠진 회의의 브리핑**.
 *
 * 파일을 사람별로 나눈 이유는 한 파일이 너무 커지기 때문이기도 하지만,
 * **한 사람을 고치다 다른 사람을 건드리는 일**을 막기 위해서다. 계정별로
 * 보이는 것이 달라야 하는데 그 차이가 실수로 지워지면 이 모드의 쓸모가 없다.
 *
 * `__fallback` 은 사람 파일이 아직 없을 때 화면이 터지지 않게 하는 자리다.
 * 비어 있으면 `perspective.js` 가 공용 값으로 물러선다.
 */
export const VIEWERS = {
  'susu@bordo.dev': susu,
  'backend01@bordo.dev': bisung,
  'front01@bordo.dev': sooyeon,
  'jaemin@bordo.dev': jaemin,
  'daeun@bordo.dev': daeun,
  __fallback: {
    agentRoomId: '6e1b85a4-d3b7-4abd-92f8-1e4eb692caec',
    favoriteMeetings: [],
    briefings: {},
  },
}
