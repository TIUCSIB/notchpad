import { app } from 'electron'
import { dirname, join } from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'

// better-sqlite3 是同步落盘的原生 SQLite:每条 UPDATE/INSERT 即时写入,
// 不再有 sql.js "整库驻内存 + 防抖全量导出重写文件" 的模型,
// 因此旧的 saveDatabase / saveDatabaseImmediate 全部移除,调用方无需关心刷盘。

let db: Database.Database | null = null
let dbPath: string | null = null

/** Config file that persists the custom db path across restarts (stored in userData). */
const configPath = join(app.getPath('userData'), 'db-config.json')

interface DbConfig {
  dbPath?: string
}

function readConfig(): DbConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return {}
  }
}

function writeConfig(cfg: DbConfig): void {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2))
}

export function getDb(): Database.Database | null {
  return db
}

function createTables(database: Database.Database): void {
  database.exec(`CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`)
  database.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
}

export function initDatabase(): Database.Database {
  // Prefer custom path from config, fall back to default userData/memo.db
  const cfg = readConfig()
  const defaultPath = join(app.getPath('userData'), 'memo.db')
  dbPath = cfg.dbPath && fs.existsSync(cfg.dbPath) ? cfg.dbPath : defaultPath

  try {
    // sql.js 时代写出的就是标准 SQLite 文件,better-sqlite3 直接打开,无需数据迁移
    db = new Database(dbPath)
    db.exec('SELECT 1')
    createTables(db)
  } catch (e) {
    console.warn('[Notchpad] Database corrupted, creating fresh database:', e)
    try {
      fs.renameSync(dbPath, dbPath + '.bak')
    } catch {
      /* ignore */
    }
    db = new Database(dbPath)
    createTables(db)
  }
  return db
}

export function migrateDatabase(): void {
  try {
    db!.exec('ALTER TABLE pages ADD COLUMN pinned INTEGER DEFAULT 0')
  } catch (_e) {
    /* exists */
  }
}

export function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  if (!db) return []
  const stmt = db.prepare(sql)
  return stmt.all(...params) as Record<string, unknown>[]
}

export function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  if (!db) return null
  const stmt = db.prepare(sql)
  return (stmt.get(...params) as Record<string, unknown> | undefined) ?? null
}

export function closeDatabase(): void {
  db?.close()
  db = null
}

/** Return the current active database file path. */
export function getDbPath(): string {
  return dbPath ?? ''
}

/** Relocate the database to a new directory. Copies current db there, updates config. */
export function relocateDatabase(targetDir: string): string {
  if (!db || !dbPath) throw new Error('Database not initialised')
  const dest = join(targetDir, 'memo.db')

  // If already at target, just persist the config
  if (dest === dbPath) {
    writeConfig({ dbPath: dest })
    return dest
  }

  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

  // 目标目录已有同名库时先改名备份,避免静默覆盖掉人家原有的数据
  if (fs.existsSync(dest)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backup = `${dest}.${stamp}.bak`
    fs.renameSync(dest, backup)
    console.log('[Notchpad] 目标目录已存在 memo.db,已备份为:', backup)
  }

  // 先关库再拷贝,保证文件处于一致状态
  db.close()

  // 附件目录(图片)跟着数据库一起搬,否则迁移后正文里的图片引用会全部失效
  const oldAttachments = join(dirname(dbPath), 'attachments')
  const newAttachments = join(targetDir, 'attachments')

  fs.copyFileSync(dbPath, dest)

  if (oldAttachments !== newAttachments && fs.existsSync(oldAttachments)) {
    fs.cpSync(oldAttachments, newAttachments, { recursive: true })
    console.log('[Notchpad] 已一并迁移附件目录:', oldAttachments, '->', newAttachments)
  }

  db = new Database(dest)
  dbPath = dest
  writeConfig({ dbPath: dest })
  return dest
}
