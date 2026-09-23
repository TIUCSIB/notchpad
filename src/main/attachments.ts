/**
 * 图片附件存储
 *
 * 背景:图片原本以 base64 data URL 内联在正文 HTML 里,
 * 一张 5MB 的截图会让单条记录膨胀到约 6.7MB,而 sql.js 每次落盘都是整库导出,
 * 于是"每 500ms 全量重写几 MB"。
 *
 * 现在改成:图片写到磁盘,正文里只存一个 notchpad://attachments/<文件名> 引用。
 *
 * 附件目录跟随数据库所在目录 —— 用户在设置里把库迁到别的盘时,图片会一起过去。
 */

import { app, net, protocol } from 'electron'
import { dirname, extname, isAbsolute, join, relative } from 'path'
import { pathToFileURL } from 'url'
import fs from 'fs'
import crypto from 'crypto'
import { getDb, getDbPath, queryAll, saveDatabaseImmediate } from './db'

export const ATTACHMENT_SCHEME = 'notchpad'
export const ATTACHMENT_HOST = 'attachments'
/** 正文中引用附件时的 URL 前缀 */
export const ATTACHMENT_PREFIX = `${ATTACHMENT_SCHEME}://${ATTACHMENT_HOST}/`

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp'
}

/** 附件目录 = 数据库同级目录下的 attachments/ */
export function getAttachmentsDir(): string {
  const dbPath = getDbPath()
  const base = dbPath ? dirname(dbPath) : app.getPath('userData')
  return join(base, 'attachments')
}

export function ensureAttachmentsDir(): string {
  const dir = getAttachmentsDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * 把附件名解析为绝对路径,同时挡掉目录穿越。
 * 只接受纯文件名(不含路径分隔符)。
 */
export function resolveAttachment(name: string): string | null {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null
  const dir = getAttachmentsDir()
  const file = join(dir, name)
  const rel = relative(dir, file)
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  return fs.existsSync(file) ? file : null
}

/**
 * 保存一个 data URL 为附件文件,返回文件名。
 * 按内容哈希命名,同一张图重复粘贴不会产生多份。
 */
export function saveAttachment(dataUrl: string): string | null {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(dataUrl)
  if (!m) return null

  const mime = m[1].toLowerCase()
  const ext = EXT_BY_MIME[mime] ?? '.bin'
  const buf = Buffer.from(m[2], 'base64')
  const name = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + ext

  const file = join(ensureAttachmentsDir(), name)
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf)
  return name
}

/** 读取附件为 data URL(导出备份时用来把内容还原成自包含) */
export function readAttachmentAsDataUrl(name: string): string | null {
  const file = resolveAttachment(name)
  if (!file) return null
  const buf = fs.readFileSync(file)
  const mime = MIME_BY_EXT[extname(file).toLowerCase()] ?? 'application/octet-stream'
  return `data:${mime};base64,${buf.toString('base64')}`
}

/**
 * 注册自定义协议,让渲染进程能通过 notchpad://attachments/<name> 显示图片。
 * 必须在 app ready 之后调用(registerSchemesAsPrivileged 才需要在 ready 之前)。
 */
export function registerAttachmentProtocol(): void {
  protocol.handle(ATTACHMENT_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      if (url.hostname !== ATTACHMENT_HOST) {
        return new Response('Not found', { status: 404 })
      }
      const name = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      const file = resolveAttachment(name)
      if (!file) {
        return new Response('Not found', { status: 404 })
      }
      return await net.fetch(pathToFileURL(file).toString())
    } catch (e) {
      console.error('[Notchpad] 附件协议处理失败:', e)
      return new Response('Error', { status: 500 })
    }
  })
}

/** 匹配正文里内联的 base64 图片 */
const INLINE_IMG_RE = /(<img[^>]+src=")(data:image\/[a-z0-9.+-]+;base64,[^"]+)(")/gi

/** 把一段 HTML 里的内联 base64 图片提取成附件文件,返回替换后的 HTML */
export function extractInlineImages(html: string): string {
  return html.replace(INLINE_IMG_RE, (whole, before: string, dataUrl: string, after: string) => {
    try {
      const name = saveAttachment(dataUrl)
      return name ? `${before}${ATTACHMENT_PREFIX}${name}${after}` : whole
    } catch (e) {
      console.error('[Notchpad] 提取内联图片失败:', e)
      return whole
    }
  })
}

/**
 * 一次性迁移:把历史数据里内联的 base64 图片提取到附件目录。
 * 跑之前会先给数据库留一份备份,避免迁移出问题时无法回退。
 * 返回迁移的页面数。
 */
export function migrateInlineImages(): number {
  const db = getDb()
  if (!db) return 0

  const rows = queryAll("SELECT id, content FROM pages WHERE content LIKE '%data:image%'")
  if (!rows.length) return 0

  const dbPath = getDbPath()
  if (dbPath && fs.existsSync(dbPath)) {
    try {
      fs.copyFileSync(dbPath, dbPath + '.before-image-migration.bak')
      console.log('[Notchpad] 图片迁移前已备份数据库:', dbPath + '.before-image-migration.bak')
    } catch (e) {
      console.error('[Notchpad] 迁移前备份失败,已跳过迁移:', e)
      return 0
    }
  }

  let migrated = 0
  for (const row of rows) {
    const id = row.id as number
    const content = String(row.content ?? '')
    const replaced = extractInlineImages(content)
    if (replaced !== content) {
      db.run('UPDATE pages SET content = ? WHERE id = ?', [replaced, id])
      migrated++
    }
  }

  if (migrated) {
    saveDatabaseImmediate()
    console.log(`[Notchpad] 已将 ${migrated} 个页面的内联图片提取为附件文件`)
  }
  return migrated
}
