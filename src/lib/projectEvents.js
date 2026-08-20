import { useEffect, useRef } from 'react'

import { getAccessToken } from './auth.js'
import { isMockMode } from '../mocks/enabled.js'

/**
 * 서버가 흘리는 것을 받는 자리.
 *
 *     /ws/projects/{project_id}?token=<access>
 *
 * ## 왜 필요한가
 *
 * 백엔드는 진작부터 보내고 있었다(`apps/common/events.py` 의 `publish`). 그런데
 * `src/` 어디에도 `WebSocket` 이라는 글자가 없었다 — **보내는 쪽은 되는데 받는
 * 쪽이 없는 상태**다. 그래서 상대가 말을 걸어도 내 화면은 새로고침하기 전까지
 * 아무 일도 없었던 것처럼 그대로였다.
 *
 * ## 프로젝트 하나에 소켓 하나다
 *
 * 화면마다 각자 열면 방을 옮길 때마다 연결이 새로 생긴다. 한 프로젝트 안에서
 * 방 셋을 오가면 소켓이 셋 만들어지고, 서버는 같은 사람에게 같은 이벤트를 세 번
 * 보낸다. 그래서 연결은 이 파일이 프로젝트별로 하나만 들고, 듣는 쪽이 몇이든
 * 나눠 쓴다. `lib/minuteClock.js` 가 시계 하나로 여러 화면을 먹이는 것과 같다.
 *
 * ## 온 것을 그대로 그리지 않는다
 *
 * 이 파일은 **무슨 일이 있었다는 사실만** 전한다. 페이로드에 `message_id` 만 오고
 * 본문이 없는 것은 일부러 그런 것이다 — 소켓으로 온 데이터를 화면이 그대로
 * 그리면 권한 검사를 안 거친 것이 뜬다. 듣는 쪽은 이 신호를 받고 **REST 로 다시
 * 읽는다.**
 *
 * ## 쓰기는 여기로 안 보낸다
 *
 * 서버도 이 채널로 명령을 받지 않는다(`ProjectConsumer.receive_json`). 쓰기가
 * 전부 REST 를 거쳐야 권한 검사가 한곳에 남는다.
 */

/** 다시 붙기까지 기다리는 시간. 1s → 2s → 4s … 30s 에서 멈춘다. */
const FIRST_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

/**
 * 이만큼 아무 말이 없으면 죽은 연결로 본다.
 *
 * 서버가 30 초마다 `heartbeat` 를 보낸다. 두 번 반을 놓쳤다면 그 사이에 무언가
 * 끊긴 것이다. **끊겼다고 알려 주지 않고 끊기는 경우가 있어서** 이것이 필요하다 —
 * 중간의 프록시가 조용히 버리면 브라우저는 `close` 조차 못 받고, 화면은 소켓이
 * 살아 있다고 믿으면서 영영 낡은 채로 남는다.
 */
const STALL_MS = 75_000

/**
 * 듣는 사람이 없어진 뒤 이만큼은 붙들고 있는다.
 *
 * 방을 옮기면 `ChatRoom` 이 통째로 새로 만들어진다(`key={selectedChatId}`).
 * 곧바로 끊으면 **같은 프로젝트 안에서 방만 바꿔도 소켓이 끊겼다 붙어**, 그
 * 사이에 온 것이 사라진다. 개발 모드의 `StrictMode` 가 효과를 두 번 도는 것도
 * 같은 자리에서 걸린다.
 */
const LINGER_MS = 5_000

/** 프로젝트 멤버가 아니다(`ProjectConsumer.CLOSE_FORBIDDEN`). */
const CLOSE_FORBIDDEN = 4003

/**
 * 끊겼다가 다시 붙었다.
 *
 * 서버도 붙을 때마다 `connected` 를 주지만 그것은 **처음 붙은 것과 다시 붙은
 * 것을 구별하지 않는다.** 듣는 쪽이 해야 할 일은 그 둘이 다르다 — 처음이라면
 * 방금 읽은 참이라 다시 읽을 이유가 없고, 다시 붙은 것이라면 끊겨 있던 동안
 * 놓친 것이 있으므로 통째로 다시 읽어야 한다.
 */
export const RECONNECTED = 'reconnected'

/** `project_id` → 연결 하나. */
const channels = new Map()

function socketUrl(projectId, token) {
  // 지금 페이지가 https 면 wss 여야 한다. https 화면에서 ws 로 붙으면 브라우저가
  // 섞인 콘텐츠로 보고 막는다 — 코드는 멀쩡한데 배포에서만 안 되는 종류의 일이다.
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  // `/api/v1` 이 아니라 `/ws` 다. 같은 출처라 호스트는 지금 페이지 것을 쓴다.
  return `${scheme}://${window.location.host}/ws/projects/${projectId}`
    + `?token=${encodeURIComponent(token)}`
}

function channelFor(projectId) {
  const found = channels.get(projectId)
  if (found) {
    return found
  }

  const channel = {
    projectId,
    listeners: new Set(),
    socket: null,
    retries: 0,
    retryTimer: null,
    stallTimer: null,
    closeTimer: null,
    // 한 번이라도 붙은 적이 있는가. 다음에 붙는 것은 **다시** 붙는 것이다.
    opened: false,
    // 다시 붙어 봐야 같은 답이 오는 상태.
    stopped: false,
  }
  channels.set(projectId, channel)
  return channel
}

function emit(channel, event) {
  channel.listeners.forEach((fn) => fn(event))
}

function clearStall(channel) {
  window.clearTimeout(channel.stallTimer)
  channel.stallTimer = null
}

/**
 * 살아 있다는 신호를 받을 때마다 시계를 되감는다.
 *
 * 시간이 다 되면 **우리가 먼저 끊는다.** 그러면 `onclose` 로 이어져 평소의
 * 재연결 길을 그대로 탄다 — 죽은 연결을 되살리는 길을 따로 만들지 않는다.
 */
function resetStall(channel) {
  window.clearTimeout(channel.stallTimer)
  channel.stallTimer = window.setTimeout(() => {
    channel.socket?.close()
  }, STALL_MS)
}

function retryLater(channel) {
  if (channel.stopped || channel.retryTimer) {
    return
  }

  // 서버가 내려가 있는 동안 1 초마다 두드리면, 돌아오는 순간 모든 브라우저가
  // 한꺼번에 몰린다. 물러나는 폭을 키우되 30 초에서 멈춘다 — 그보다 길면
  // 서버가 돌아와도 화면이 한참 조용하다.
  const wait = Math.min(FIRST_RETRY_MS * 2 ** channel.retries, MAX_RETRY_MS)
  channel.retries += 1
  channel.retryTimer = window.setTimeout(() => {
    channel.retryTimer = null
    if (channel.listeners.size > 0) {
      connect(channel)
    }
  }, wait)
}

function connect(channel) {
  if (channel.stopped || channel.socket) {
    return
  }

  const token = getAccessToken()
  if (!token) {
    // 토큰 없이 붙으면 서버가 4001 로 끊는다. 실패한 연결을 하나 더 만드는
    // 대신 물러났다 다시 본다 — 로그인 직후처럼 곧 생기는 값이다.
    retryLater(channel)
    return
  }

  let socket
  try {
    socket = new WebSocket(socketUrl(channel.projectId, token))
  } catch {
    // 주소가 잘못됐거나 브라우저가 막은 경우. 여기서 던지면 화면이 통째로
    // 죽는데, 실시간이 안 되는 것과 화면이 안 뜨는 것은 무게가 다르다.
    retryLater(channel)
    return
  }
  channel.socket = socket

  socket.onopen = () => {
    channel.retries = 0
    resetStall(channel)
    if (channel.opened) {
      emit(channel, { event_type: RECONNECTED, payload: {} })
    }
    channel.opened = true
  }

  socket.onmessage = (message) => {
    // 무엇이 왔든 연결이 살아 있다는 뜻이다. 읽다가 실패해도 이건 먼저 해 둔다.
    resetStall(channel)

    let body
    try {
      body = JSON.parse(message.data)
    } catch {
      // 우리가 모르는 모양이 왔다. 연결까지 끊을 일은 아니다.
      return
    }

    // `heartbeat` · `pong` 은 살아 있다는 말뿐이고, `connected` 는 위에서
    // `RECONNECTED` 로 옮겨 적었다. 셋 다 화면이 할 일이 없다.
    const type = body?.event_type
    if (type === 'heartbeat' || type === 'pong' || type === 'connected') {
      return
    }
    emit(channel, body)
  }

  // `onerror` 는 걸지 않는다. 오류 뒤에는 `onclose` 가 반드시 따라오므로,
  // 양쪽에서 재연결을 걸면 두 번 건다.
  socket.onclose = (event) => {
    // 이미 갈아탄 소켓의 뒤늦은 통보. 지금 쓰는 연결을 건드리면 안 된다.
    if (channel.socket !== socket) {
      return
    }
    channel.socket = null
    clearStall(channel)

    if (event.code === CLOSE_FORBIDDEN) {
      // 이 프로젝트의 멤버가 아니다. 몇 번을 다시 붙어도 같은 답이 온다 —
      // 계속 두드리면 콘솔만 오류로 채워진다.
      channel.stopped = true
      return
    }

    if (channel.listeners.size > 0) {
      retryLater(channel)
    }
  }
}

function shutdown(channel) {
  if (channel.listeners.size > 0) {
    return
  }

  channels.delete(channel.projectId)
  window.clearTimeout(channel.retryTimer)
  clearStall(channel)
  const { socket } = channel
  channel.socket = null
  // 우리가 닫는 것이므로 뒤따르는 `onclose` 가 다시 붙지 않게 못을 박는다.
  channel.stopped = true
  socket?.close()
}

function subscribe(projectId, fn) {
  const channel = channelFor(projectId)
  channel.listeners.add(fn)
  // 끊으려던 참이었으면 없던 일로 한다.
  window.clearTimeout(channel.closeTimer)
  channel.closeTimer = null

  // 다시 붙기를 기다리는 중이면 그 차례를 지킨다. 새 화면이 하나 뜰 때마다
  // 물러난 폭이 초기화되면 백오프가 있으나 마나다.
  if (!channel.socket && !channel.retryTimer) {
    connect(channel)
  }

  return () => {
    channel.listeners.delete(fn)
    if (channel.listeners.size > 0) {
      return
    }
    channel.closeTimer = window.setTimeout(() => shutdown(channel), LINGER_MS)
  }
}

/**
 * 이 프로젝트에서 일어나는 일을 듣는다.
 *
 *     useProjectEvents(room?.projectId, (event) => {
 *       if (event.event_type === 'chat.message.created') { ... }
 *     })
 *
 * `onEvent` 는 매 렌더 새 함수여도 된다 — 최신 것만 들고 가므로 소켓은 그대로
 * 있는다. 이걸 의존성에 넣으면 인라인 화살표 함수를 넘길 때마다 연결이 끊겼다
 * 붙는다(`useResource` 의 `load` 와 같은 이유다).
 *
 * @param projectId 없으면 아무것도 하지 않는다.
 * @param onEvent   `{ event_type, project_id, user_id, payload }`
 */
export function useProjectEvents(projectId, onEvent) {
  // 렌더 도중에 ref 를 고치면 같은 렌더를 두 번 그릴 때 값이 갈리므로
  // 효과에서 옮긴다.
  const latest = useRef(onEvent)
  useEffect(() => {
    latest.current = onEvent
  })

  useEffect(() => {
    /*
      프로젝트에 안 매달린 방이 있다 — 1:1 과 대리인 방이 그렇다.

      서버 `_deliver()` 가 `if body["project_id"]` 로 걸러서, 그런 방의
      이벤트는 **갈 채널 자체가 없다.** 붙을 곳이 없는 것이지 잘못된 것이
      아니므로 조용히 넘어간다.
    */
    if (!projectId) {
      return undefined
    }

    /*
      가상 데이터 모드에서는 아예 열지 않는다.

      서버가 없는 상태로 보는 화면이라 붙을 곳이 없고, 붙어 보려는 시도마다
      콘솔에 연결 실패가 쌓인다. 시연을 이 모드로 하는데 콘솔이 빨갛게 차 있으면
      **가짜 데이터라서 나는 오류인지 진짜 고장인지** 구별할 수 없다.

      모드를 켜는 자리는 로그인 화면뿐이고 끄면 `window.location.assign('/')` 로
      통째로 다시 뜨므로, 여기서 한 번 보는 것으로 충분하다.
    */
    if (isMockMode()) {
      return undefined
    }

    return subscribe(String(projectId), (event) => latest.current?.(event))
  }, [projectId])
}
