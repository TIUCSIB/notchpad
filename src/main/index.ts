import { app, BrowserWindow, screen, Tray, Menu, nativeImage, shell, globalShortcut } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import { initDatabase, migrateDatabase, queryOne, closeDatabase } from './db'
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

function createWindow(): void {
  const workArea = screen.getPrimaryDisplay().workArea
  mainWindow = new BrowserWindow({
    x: Math.round(workArea.x + (workArea.width - WIN_WIDTH) / 2),
    y: workArea.y,
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
registerIpcHandlers(getMainWindow)

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
