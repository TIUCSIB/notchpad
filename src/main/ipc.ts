import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { queryAll, queryOne, saveDatabase, getDb, getDbPath, relocateDatabase } from './db'
import { enterNotchMode, exitNotchMode, getIsNotched, setWakeMode } from './notch'

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null,
  getSwitchDisplay: () => (() => void) | null
): void {

  ipcMain.handle('get-pages', () => {
    return queryAll('SELECT * FROM pages ORDER BY pinned DESC, sort_order ASC, created_at ASC')
  })


  ipcMain.handle('toggle-pin-page', (_: Electron.IpcMainInvokeEvent, id: number) => {
    const db = getDb()
    if (!db) return []
    const row = queryOne('SELECT pinned FROM pages WHERE id = ?', [id])
    const newPinned = row ? (row.pinned ? 0 : 1) : 1
    db.run('UPDATE pages SET pinned = ? WHERE id = ?', [newPinned, id])
    const all = queryAll('SELECT id FROM pages ORDER BY pinned DESC, sort_order ASC, created_at ASC')
    all.forEach((r, i) => { db.run('UPDATE pages SET sort_order = ? WHERE id = ?', [i, r.id]) })
    saveDatabase()
    return queryAll('SELECT * FROM pages ORDER BY pinned DESC, sort_order ASC, created_at ASC')
  })

  ipcMain.handle('add-page', () => {
    const db = getDb()
    if (!db) return null
    try {
      const maxOrder = queryOne('SELECT COALESCE(MAX(sort_order), -1) as m FROM pages')
      const order = ((maxOrder?.m as number) ?? -1) + 1
      db.run('INSERT INTO pages (title, content, sort_order) VALUES (?, ?, ?)', ['', '', order])
      saveDatabase()
      return queryAll('SELECT * FROM pages ORDER BY pinned DESC, sort_order ASC, created_at ASC')
    } catch (e) {
      console.error('[Notchpad] add-page error:', e)
      return null
    }
  })

  ipcMain.handle('delete-page', (_: Electron.IpcMainInvokeEvent, id: number) => {
    getDb()!.run('DELETE FROM pages WHERE id = ?', [id])
    saveDatabase()
  })

  ipcMain.handle('update-page', (_: Electron.IpcMainInvokeEvent, id: number, _title: string, content: string) => {
    getDb()!.run('UPDATE pages SET title = ?, content = ?, updated_at = datetime(?, ?) WHERE id = ?', [
      _title, content, 'now', 'localtime', id
    ])
    saveDatabase()
    return queryOne('SELECT * FROM pages WHERE id = ?', [id])
  })

  ipcMain.handle('update-page-title', (_: Electron.IpcMainInvokeEvent, id: number, title: string) => {
    getDb()!.run('UPDATE pages SET title = ?, updated_at = datetime(?, ?) WHERE id = ?', [
      title, 'now', 'localtime', id
    ])
    saveDatabase()
    return queryOne('SELECT * FROM pages WHERE id = ?', [id])
  })

  ipcMain.handle('reorder-pages', (_: Electron.IpcMainInvokeEvent, ids: number[]) => {
    const db = getDb()
    ids.forEach((id, i) => { db!.run('UPDATE pages SET sort_order = ? WHERE id = ?', [i, id]) })
    saveDatabase()
  })

  ipcMain.on('close-window', () => { getMainWindow()?.close() })

  ipcMain.handle('switch-display', () => {
    const fn = getSwitchDisplay()
    if (fn) fn()
  })

  ipcMain.handle('enter-notch', () => { enterNotchMode(getMainWindow()) })
  ipcMain.handle('exit-notch', () => { exitNotchMode(getMainWindow()) })
  ipcMain.handle('get-notch-state', () => getIsNotched())

  ipcMain.handle('get-settings', () => {
    const db = getDb()
    if (!db) return {}
    const rows = db.exec('SELECT key, value FROM settings')
    if (!rows.length) return {}
    const result: Record<string, string> = {}
    for (const row of rows[0].values) result[row[0] as string] = row[1] as string
    return result
  })

  ipcMain.handle('set-setting', (_: Electron.IpcMainInvokeEvent, key: string, value: string) => {
    const db = getDb()
    if (!db) return
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
    saveDatabase()
    if (key === 'autoStart') app.setLoginItemSettings({ openAtLogin: value === 'true', path: app.getPath('exe') })
    if (key === 'wakeMode') {
      setWakeMode(value)
      const mw = getMainWindow()
      if (getIsNotched() && mw) mw.setIgnoreMouseEvents(true)
    }
  })

  ipcMain.handle('reset-settings', () => {
    const db = getDb()
    if (!db) return
    db.run('DELETE FROM settings')
    saveDatabase()
    app.setLoginItemSettings({ openAtLogin: false, path: app.getPath('exe') })
  })

  ipcMain.on('open-external', (_: Electron.IpcMainEvent, url: string) => { shell.openExternal(url) })

  // --- Database storage path ---
  ipcMain.handle('get-db-path', () => getDbPath())

  ipcMain.handle('choose-db-dir', async () => {
    const win = getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '选择数据库存储目录',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('relocate-db', async (_: Electron.IpcMainInvokeEvent, targetDir: string) => {
    try {
      const newPath = relocateDatabase(targetDir)
      return { ok: true, path: newPath }
    } catch (e) {
      console.error('[Notchpad] relocate-db error:', e)
      return { ok: false, error: String(e) }
    }
  })
}
