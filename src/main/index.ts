import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs'
import initSqlJs, { Database } from 'sql.js'

const WIN_WIDTH = 530
const WIN_HEIGHT = 364
const NOTCH_PILL_WIDTH = 64
const NOTCH_PILL_HEIGHT = 8
const NOTCH_PILL_TOP = 4

let isNotched = false
let isQuitting = false
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let db: Database | null = null
let dbPath: string | null = null
let notchPollTimer: ReturnType<typeof setInterval> | null = null
let lastNotchChange = 0
let wakeMode = 'hover'
let pillHovering = false
const NOTCH_COOLDOWN = 350

async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs()
  dbPath = join(app.getPath('userData'), 'memo.db')

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`)

  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  saveDatabase()
  return db
}

function saveDatabase(): void {
  if (!db || !dbPath) return
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  if (!db) return []
  const stmt = db.prepare(sql)
  if (params.length) stmt.bind(params as initSqlJs.BindParams)
  const rows: Record<string, unknown>[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  return queryAll(sql, params)[0] || null
}

function createTrayIcon(): Electron.NativeImage {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="6" fill="#1a1a1a" stroke="#4ade80" stroke-width="2"/><line x1="8" y1="10" x2="24" y2="10" stroke="#4ade80" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="16" x2="24" y2="16" stroke="#666" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="22" x2="18" y2="22" stroke="#666" stroke-width="2" stroke-linecap="round"/></svg>'
  return nativeImage.createFromBuffer(Buffer.from(svg), { width: 32, height: 32 })
}

function createWindow(): void {
  const workArea = screen.getPrimaryDisplay().workArea
  const x = Math.round(workArea.x + (workArea.width - WIN_WIDTH) / 2)
  const y = workArea.y

  mainWindow = new BrowserWindow({
    x,
    y,
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    isNotched = true
    mainWindow?.setIgnoreMouseEvents(true)
    mainWindow?.show()
    mainWindow?.webContents.send('notch-changed', true)
    startNotchPolling()
  })

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.webContents.on('will-navigate', (e, url) => {
    e.preventDefault()
    shell.openExternal(url)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- Notch mode ---
function enterNotchMode(): void {
  if (!mainWindow || isNotched) return
  isNotched = true
  pillHovering = false
  mainWindow.setIgnoreMouseEvents(true)
  mainWindow.webContents.send('notch-changed', true)
}

function exitNotchMode(): void {
  if (!mainWindow || !isNotched) return
  isNotched = false
  mainWindow.setIgnoreMouseEvents(false)
  mainWindow.webContents.send('notch-changed', false)
}

function startNotchPolling(): void {
  if (notchPollTimer) return
  notchPollTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return
    if (Date.now() - lastNotchChange < NOTCH_COOLDOWN) return

    const cursor = screen.getCursorScreenPoint()
    const bounds = mainWindow.getBounds()

    if (isNotched) {
      const pillLeft = bounds.x + (bounds.width - NOTCH_PILL_WIDTH) / 2
      const pillRight = pillLeft + NOTCH_PILL_WIDTH
      const pillTop = bounds.y + NOTCH_PILL_TOP
      const pillBottom = pillTop + NOTCH_PILL_HEIGHT
      const onPill =
        cursor.x >= pillLeft &&
        cursor.x <= pillRight &&
        cursor.y >= pillTop &&
        cursor.y <= pillBottom

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
          lastNotchChange = Date.now()
          exitNotchMode()
        }
      }
    } else {
      const margin = 40
      if (
        cursor.x < bounds.x - margin ||
        cursor.x > bounds.x + bounds.width + margin ||
        cursor.y < bounds.y - margin ||
        cursor.y > bounds.y + bounds.height + margin
      ) {
        lastNotchChange = Date.now()
        enterNotchMode()
      }
    }
  }, 50)
}

// IPC Handlers
ipcMain.handle('get-pages', () => {
  return queryAll('SELECT * FROM pages ORDER BY sort_order ASC, created_at ASC')
})

ipcMain.handle('add-page', () => {
  const maxOrder = queryOne('SELECT MAX(sort_order) as m FROM pages')
  const order = maxOrder && maxOrder.m !== null ? (maxOrder.m as number) + 1 : 0
  db!.run('INSERT INTO pages (title, content, sort_order) VALUES (?, ?, ?)', ['', '', order])
  saveDatabase()
  const maxId = queryOne('SELECT MAX(id) as m FROM pages')
  return queryOne('SELECT * FROM pages WHERE id = ?', [maxId?.m])
})

ipcMain.handle('delete-page', (_: Electron.IpcMainInvokeEvent, id: number) => {
  db!.run('DELETE FROM pages WHERE id = ?', [id])
  saveDatabase()
})

ipcMain.handle(
  'update-page',
  (_: Electron.IpcMainInvokeEvent, id: number, title: string, content: string) => {
    db!.run('UPDATE pages SET title = ?, content = ?, updated_at = datetime(?, ?) WHERE id = ?', [
      title,
      content,
      'now',
      'localtime',
      id
    ])
    saveDatabase()
    return queryOne('SELECT * FROM pages WHERE id = ?', [id])
  }
)

ipcMain.handle('reorder-pages', (_: Electron.IpcMainInvokeEvent, ids: number[]) => {
  ids.forEach((id, i) => {
    db!.run('UPDATE pages SET sort_order = ? WHERE id = ?', [i, id])
  })
  saveDatabase()
})

ipcMain.on('close-window', () => {
  mainWindow?.hide()
})

ipcMain.handle('enter-notch', () => {
  enterNotchMode()
})

ipcMain.handle('exit-notch', () => {
  exitNotchMode()
})
ipcMain.handle('get-notch-state', () => {
  return isNotched
})

ipcMain.handle('get-settings', () => {
  if (!db) return {}
  const rows = db.exec('SELECT key, value FROM settings')
  if (!rows.length) return {}
  const result: Record<string, string> = {}
  for (const row of rows[0].values) {
    result[row[0] as string] = row[1] as string
  }
  return result
})

ipcMain.handle('set-setting', (_: Electron.IpcMainInvokeEvent, key: string, value: string) => {
  if (!db) return
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  saveDatabase()
  if (key === 'autoStart') {
    app.setLoginItemSettings({ openAtLogin: value === 'true', path: app.getPath('exe') })
  }
  if (key === 'wakeMode') {
    wakeMode = value
    pillHovering = false
    if (isNotched && mainWindow) {
      mainWindow.setIgnoreMouseEvents(true)
    }
  }
})

ipcMain.on('open-external', (_: Electron.IpcMainEvent, url: string) => {
  shell.openExternal(url)
})

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.floating-memo')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await initDatabase()

  // Load wake mode from settings
  const savedWakeMode = queryOne("SELECT value FROM settings WHERE key = 'wakeMode'")
  if (savedWakeMode) wakeMode = savedWakeMode.value as string

  const allPages = queryAll('SELECT * FROM pages')
  const nonEmpty = allPages.filter((p) => p.title || p.content)
  if (nonEmpty.length === 0) {
    db!.run('DELETE FROM pages')
    db!.run('INSERT INTO pages (title, content, sort_order) VALUES (?, ?, ?)', ['', '', 0])
    saveDatabase()
  }

  createWindow()

  tray = new Tray(createTrayIcon())
  tray.setToolTip('\u60ac\u6d6e\u4fbf\u7b7e')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '\u663e\u793a\u7a97\u53e3',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      { type: 'separator' },
      {
        label: '\u9000\u51fa',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
})

app.on('window-all-closed', () => {})

app.on('before-quit', () => {
  isQuitting = true
  if (notchPollTimer) {
    clearInterval(notchPollTimer)
    notchPollTimer = null
  }
  saveDatabase()
  db?.close()
})
