import { app, BrowserWindow, screen, Tray, Menu, nativeImage, shell, globalShortcut, Display } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import { initDatabase, migrateDatabase, queryOne, closeDatabase, saveDatabase, getDb } from './db'
import { exitNotchMode, showInNotch, startNotchPolling, stopNotchPolling, pauseUntil, setWakeMode } from './notch'
import { registerIpcHandlers } from './ipc'

const WIN_WIDTH = 523
const WIN_HEIGHT = 364

let isQuitting = false
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function getMainWindow() { return mainWindow }

function createTrayIcon(): Electron.NativeImage {
  const resDir = app.isPackaged ? join(process.resourcesPath, 'resources') : join(__dirname, '../../resources')
  console.log('[Notchpad] Tray icon search dir:', resDir)
  for (const name of ['tray-icon.png', 'icon.png']) {
    const p = join(resDir, name)
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p)
      if (!img.isEmpty()) return img
    }
  }
  return nativeImage.createEmpty()
}

// ======== Display helpers ========

/** Read the saved display ID from the database. Falls back to primary display. */
function getSavedDisplayId(): number {
  const row = queryOne("SELECT value FROM settings WHERE key = 'displayId'")
  if (row) {
    const id = Number(row.value)
    if (!isNaN(id)) return id
  }
  return screen.getPrimaryDisplay().id
}

/** Find a display by its ID, or fall back to primary. */
function findDisplay(displayId: number): Display {
  return screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay()
}

/** Position the window at the top-center of the given display. */
function positionOnDisplay(display: Display): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { x, width } = display.workArea
  mainWindow.setBounds({
    x: Math.round(x + (width - WIN_WIDTH) / 2),
    y: display.workArea.y,
    width: WIN_WIDTH,
    height: WIN_HEIGHT
  })
}

/** Cycle to the next display and persist the choice. */
export function switchToNextDisplay(): void {
  const displays = screen.getAllDisplays()
  if (displays.length <= 1) return
  const currentId = mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds()).id
    : getSavedDisplayId()
  const currentIdx = displays.findIndex((d) => d.id === currentId)
  const nextIdx = (currentIdx + 1) % displays.length
  const nextDisplay = displays[nextIdx]
  positionOnDisplay(nextDisplay)
  // Persist
  const db = getDb()
  if (db) {
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('displayId', ?)", [String(nextDisplay.id)])
    saveDatabase()
  }
}

// ======== Window ========

function createWindow(): void {
  const display = findDisplay(getSavedDisplayId())
  const { x, width } = display.workArea
  mainWindow = new BrowserWindow({
    x: Math.round(x + (width - WIN_WIDTH) / 2),
    y: display.workArea.y,
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, devTools: is.dev }
  })

  mainWindow.on('ready-to-show', () => { showInNotch(mainWindow); startNotchPolling(mainWindow) })
  mainWindow.on('close', (e) => { if (!isQuitting) { e.preventDefault(); mainWindow?.hide() } })
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.webContents.on('will-navigate', (e, url) => { e.preventDefault(); shell.openExternal(url) })

  if (is.dev) {
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') mainWindow?.webContents.toggleDevTools()
    })
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register IPC handlers
registerIpcHandlers(getMainWindow, () => switchToNextDisplay)

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.notchpad.app')
  app.on('browser-window-created', (_, window) => { optimizer.watchWindowShortcuts(window) })

  await initDatabase()
  migrateDatabase()

  const shortcutRegistered = globalShortcut.register('CommandOrControl+Alt+Z', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (!mainWindow.isFocused()) mainWindow.focus()
      if (mainWindow) exitNotchMode(mainWindow)
      pauseUntil(Date.now() + 1500)
    }
  })
  if (!shortcutRegistered) console.warn('[Notchpad] Global shortcut Ctrl+Alt+Z already registered by another instance')

  const savedWakeMode = queryOne("SELECT value FROM settings WHERE key = 'wakeMode'")
  if (savedWakeMode) {
    setWakeMode(savedWakeMode.value as string)
  }

  createWindow()

  tray = new Tray(createTrayIcon())
  tray.setToolTip('Notchpad')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示窗口', click: () => showInNotch(mainWindow) },
    { type: 'separator' },
    { label: '退出', click: () => { isQuitting = true; app.quit() } }
  ]))
  tray.on('double-click', () => { showInNotch(mainWindow) })
})

app.on('window-all-closed', () => { app.quit() })

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
  stopNotchPolling()
  closeDatabase()
})
