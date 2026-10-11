import { BrowserWindow, screen } from 'electron'

const NOTCH_PILL_WIDTH = 72
const NOTCH_PILL_HEIGHT = 14

// 药丸实际尺寸由渲染层 ResizeObserver 实测上报(悬浮放大、样式调整都会跟着变),
// 这里只保留一份初始值兜底,命中判定以渲染层上报为准。
let pillWidth = NOTCH_PILL_WIDTH
let pillHeight = NOTCH_PILL_HEIGHT

export function setPillSize(width: number, height: number): void {
  if (width > 0 && height > 0) {
    pillWidth = width
    pillHeight = height
  }
}

const NOTCH_PILL_TOP = 0
const NOTCH_COOLDOWN = 350
const ALWAYS_ON_TOP_REFRESH_INTERVAL = 3000
/** 收起态轮询间隔:要尽快捕捉鼠标移入药丸,响应优先 */
const POLL_MS_COLLAPSED = 100
/** 展开态轮询间隔:只需判断鼠标是否已移出窗口,可以放松一些 */
const POLL_MS_EXPANDED = 200

let isNotched = false
let notchPollTimer: ReturnType<typeof setTimeout> | null = null
let lastNotchChange = 0
let lastAlwaysOnTopRefresh = 0
let wakeMode = 'hover'
let pillHovering = false
let shortcutPauseUntil = 0
/** 渲染层是否已画过第一帧(决定 showInNotch 走冷启动等待还是热恢复直出) */
let rendererHasPainted = false
let revealTimer: ReturnType<typeof setTimeout> | null = null

export function getIsNotched() {
  return isNotched
}
export function setWakeMode(mode: string) {
  wakeMode = mode
  pillHovering = false
}
export function pauseUntil(time: number) {
  shortcutPauseUntil = time
}

export function enterNotchMode(mainWindow: BrowserWindow | null): void {
  if (!mainWindow || isNotched) return
  isNotched = true
  pillHovering = false
  mainWindow.setIgnoreMouseEvents(true)
  mainWindow.webContents.send('notch-changed', true)
}

export function exitNotchMode(mainWindow: BrowserWindow | null): void {
  if (!mainWindow || !isNotched) return
  isNotched = false
  mainWindow.setIgnoreMouseEvents(false)
  mainWindow.focus()
  mainWindow.webContents.send('notch-changed', false)
}

/** 渲染层画完第一帧后经 renderer-ready 上报;窗口此时还处于 opacity 0,这里负责亮出 */
export function revealWhenReady(mainWindow: BrowserWindow | null): void {
  rendererHasPainted = true
  if (revealTimer) {
    clearTimeout(revealTimer)
    revealTimer = null
  }
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setOpacity(1)
  mainWindow.focus()
}

export function showInNotch(mainWindow: BrowserWindow | null): void {
  if (!mainWindow) return
  isNotched = true
  mainWindow.setIgnoreMouseEvents(true)
  mainWindow.webContents.send('notch-changed', true)
  mainWindow.hide()
  if (rendererHasPainted) {
    // 托盘恢复等热路径:渲染层早已画好,直接亮出,不再走隐形等待
    mainWindow.setOpacity(1)
    mainWindow.show()
    mainWindow.focus()
    return
  }
  // 冷启动:等渲染层画完第一帧(renderer-ready)再亮出,替代写死的 100ms ——
  // 机器快不白等,机器慢不白闪;2s 兜底防止渲染层异常时窗口永远隐形
  mainWindow.setOpacity(0)
  mainWindow.show()
  if (revealTimer) clearTimeout(revealTimer)
  revealTimer = setTimeout(() => {
    revealTimer = null
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1)
      mainWindow.focus()
    }
  }, 2000)
}

/** 单次轮询:维持置顶层级,并判定刘海(收起 / 展开)状态 */
function pollOnce(mainWindow: BrowserWindow | null): void {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return

  const now = Date.now()

  // Periodically re-assert alwaysOnTop to prevent other windows from stealing z-order
  if (now - lastAlwaysOnTopRefresh > ALWAYS_ON_TOP_REFRESH_INTERVAL) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver')
    lastAlwaysOnTopRefresh = now
  }

  if (now - lastNotchChange < NOTCH_COOLDOWN) return

  const cursor = screen.getCursorScreenPoint()
  const bounds = mainWindow.getBounds()

  if (isNotched) {
    const pillLeft = bounds.x + (bounds.width - pillWidth) / 2
    const pillRight = pillLeft + pillWidth
    const pillTop = bounds.y + NOTCH_PILL_TOP
    const pillBottom = pillTop + pillHeight
    const onPill =
      cursor.x >= pillLeft && cursor.x <= pillRight && cursor.y >= pillTop && cursor.y <= pillBottom

    if (wakeMode === 'click') {
      if (onPill && !pillHovering) {
        pillHovering = true
        mainWindow.setIgnoreMouseEvents(false)
      } else if (!onPill && pillHovering) {
        pillHovering = false
        mainWindow.setIgnoreMouseEvents(true)
      }
    } else {
      if (onPill) {
        lastNotchChange = now
        exitNotchMode(mainWindow)
      }
    }
  } else {
    if (now < shortcutPauseUntil) return
    // 光标离开窗口边缘多少像素就收起。只留极小的滞回量防边缘抖动,
    // 太大(比如 40)会让"明明已经离开面板了却迟迟不收"
    const margin = 10
    if (
      cursor.x < bounds.x - margin ||
      cursor.x > bounds.x + bounds.width + margin ||
      cursor.y < bounds.y - margin ||
      cursor.y > bounds.y + bounds.height + margin
    ) {
      lastNotchChange = now
      enterNotchMode(mainWindow)
    }
  }
}

export function startNotchPolling(mainWindow: BrowserWindow | null): void {
  if (notchPollTimer) return

  // 用 setTimeout 递归而不是 setInterval —— 间隔需要随刘海状态变化
  const tick = (): void => {
    pollOnce(mainWindow)
    notchPollTimer = setTimeout(tick, isNotched ? POLL_MS_COLLAPSED : POLL_MS_EXPANDED)
  }
  notchPollTimer = setTimeout(tick, POLL_MS_COLLAPSED)
}

export function stopNotchPolling(): void {
  if (notchPollTimer) {
    clearTimeout(notchPollTimer)
    notchPollTimer = null
  }
}
