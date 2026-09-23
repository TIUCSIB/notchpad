import { BrowserWindow, screen } from 'electron'

const NOTCH_PILL_WIDTH = 72
const NOTCH_PILL_HEIGHT = 14
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

export function getIsNotched() { return isNotched }
export function setWakeMode(mode: string) { wakeMode = mode; pillHovering = false }
export function pauseUntil(time: number) { shortcutPauseUntil = time }

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

export function showInNotch(mainWindow: BrowserWindow | null): void {
  if (!mainWindow) return
  isNotched = true
  mainWindow.setIgnoreMouseEvents(true)
  mainWindow.webContents.send('notch-changed', true)
  mainWindow.hide()
  mainWindow.setOpacity(0)
  mainWindow.show()
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(1)
      mainWindow.focus()
    }
  }, 100)
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
    const pillLeft = bounds.x + (bounds.width - NOTCH_PILL_WIDTH) / 2
    const pillRight = pillLeft + NOTCH_PILL_WIDTH
    const pillTop = bounds.y + NOTCH_PILL_TOP
    const pillBottom = pillTop + NOTCH_PILL_HEIGHT
    const onPill = cursor.x >= pillLeft && cursor.x <= pillRight && cursor.y >= pillTop && cursor.y <= pillBottom

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
    const margin = 40
    if (cursor.x < bounds.x - margin || cursor.x > bounds.x + bounds.width + margin ||
        cursor.y < bounds.y - margin || cursor.y > bounds.y + bounds.height + margin) {
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
  if (notchPollTimer) { clearTimeout(notchPollTimer); notchPollTimer = null }
}
