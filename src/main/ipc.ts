import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { queryAll, queryOne, getDb, getDbPath, relocateDatabase } from './db'
import {
  enterNotchMode,
  exitNotchMode,
  getIsNotched,
  setWakeMode,
  setPillSize,
  revealWhenReady
} from './notch'
import { readAttachmentAsDataUrl, saveAttachment } from './attachments'

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
    db.prepare('UPDATE pages SET pinned = ? WHERE id = ?').run(newPinned, id)
    const all = queryAll(
      'SELECT id FROM pages ORDER BY pinned DESC, sort_order ASC, created_at ASC'
    )
    const setOrder = db.prepare('UPDATE pages SET sort_order = ? WHERE id = ?')
    all.forEach((r, i) => {
      setOrder.run(i, r.id)
    })
    return queryAll('SELECT * FROM pages ORDER BY pinned DESC, sort_order ASC, created_at ASC')
  })

  ipcMain.handle('add-page', () => {
    const db = getDb()
    if (!db) return null
    try {
      const maxOrder = queryOne('SELECT COALESCE(MAX(sort_order), -1) as m FROM pages')
      const order = ((maxOrder?.m as number) ?? -1) + 1
      db.prepare('INSERT INTO pages (title, content, sort_order) VALUES (?, ?, ?)').run(
        '',
        '',
        order
      )
      return queryAll('SELECT * FROM pages ORDER BY pinned DESC, sort_order ASC, created_at ASC')
    } catch (e) {
      console.error('[Notchpad] add-page error:', e)
      return null
    }
  })

  // 返回是否真的删了,渲染层据此决定要不要更新本地列表
  ipcMain.handle('delete-page', (_: Electron.IpcMainInvokeEvent, id: number) => {
    const db = getDb()
    if (!db) return false
    db.prepare('DELETE FROM pages WHERE id = ?').run(id)
    return true
  })

  // 只更新正文。标题有独立的 update-page-title 通道 ——
  // 之前这里会把传入的 title 一起写库,而保存流程传的是空串,导致用户设的标题被静默清空。
  ipcMain.handle('update-page', (_: Electron.IpcMainInvokeEvent, id: number, content: string) => {
    const db = getDb()
    if (!db) return null
    db.prepare('UPDATE pages SET content = ?, updated_at = datetime(?, ?) WHERE id = ?').run(
      content,
      'now',
      'localtime',
      id
    )
    return queryOne('SELECT * FROM pages WHERE id = ?', [id])
  })

  ipcMain.handle(
    'update-page-title',
    (_: Electron.IpcMainInvokeEvent, id: number, title: string) => {
      const db = getDb()
      if (!db) return null
      db.prepare('UPDATE pages SET title = ?, updated_at = datetime(?, ?) WHERE id = ?').run(
        title,
        'now',
        'localtime',
        id
      )
      return queryOne('SELECT * FROM pages WHERE id = ?', [id])
    }
  )

  ipcMain.handle('reorder-pages', (_: Electron.IpcMainInvokeEvent, ids: number[]) => {
    const db = getDb()
    if (!db) return
    const setOrder = db.prepare('UPDATE pages SET sort_order = ? WHERE id = ?')
    ids.forEach((id, i) => {
      setOrder.run(i, id)
    })
  })

  ipcMain.on('close-window', () => {
    getMainWindow()?.close()
  })

  ipcMain.handle('switch-display', () => {
    const fn = getSwitchDisplay()
    if (fn) fn()
  })

  ipcMain.handle('enter-notch', () => {
    enterNotchMode(getMainWindow())
  })
  ipcMain.handle('exit-notch', () => {
    exitNotchMode(getMainWindow())
  })
  ipcMain.handle('get-notch-state', () => getIsNotched())

  // 药丸尺寸随悬浮放大 / 样式调整变化,由渲染层实测后高频上报,只做单向上报不走 invoke
  ipcMain.on('update-pill-size', (_: Electron.IpcMainEvent, width: number, height: number) => {
    setPillSize(width, height)
  })

  // 渲染层画完第一帧后上报,把 opacity 0 的窗口亮出来(见 notch.ts 的 showInNotch)
  ipcMain.on('renderer-ready', () => {
    revealWhenReady(getMainWindow())
  })

  ipcMain.handle('get-settings', () => {
    const db = getDb()
    if (!db) return {}
    const rows = db.prepare('SELECT key, value FROM settings').all() as {
      key: string
      value: string
    }[]
    const result: Record<string, string> = {}
    for (const row of rows) result[row.key] = row.value
    return result
  })

  ipcMain.handle('set-setting', (_: Electron.IpcMainInvokeEvent, key: string, value: string) => {
    const db = getDb()
    if (!db) return
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    if (key === 'autoStart')
      app.setLoginItemSettings({ openAtLogin: value === 'true', path: app.getPath('exe') })
    if (key === 'wakeMode') {
      setWakeMode(value)
      const mw = getMainWindow()
      if (getIsNotched() && mw) mw.setIgnoreMouseEvents(true)
    }
  })

  ipcMain.handle('reset-settings', () => {
    const db = getDb()
    if (!db) return
    db.prepare('DELETE FROM settings').run()
    app.setLoginItemSettings({ openAtLogin: false, path: app.getPath('exe') })
  })

  ipcMain.on('open-external', (_: Electron.IpcMainEvent, url: string) => {
    shell.openExternal(url)
  })

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

  // --- 图片附件 ---
  ipcMain.handle('save-attachment', (_: Electron.IpcMainInvokeEvent, dataUrl: string) => {
    try {
      const name = saveAttachment(dataUrl)
      return name ? { ok: true, name } : { ok: false, error: '无法识别的图片数据' }
    } catch (e) {
      console.error('[Notchpad] save-attachment error:', e)
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.handle('read-attachment', (_: Electron.IpcMainInvokeEvent, name: string) => {
    try {
      return readAttachmentAsDataUrl(name)
    } catch (e) {
      console.error('[Notchpad] read-attachment error:', e)
      return null
    }
  })
}
