import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import initSqlJs, { Database, SqlJsStatic } from 'sql.js'

let db: Database | null = null
let dbPath: string | null = null
let sqlStatic: SqlJsStatic | null = null

// --- Debounced write: batch rapid saves into a single disk write ---
let dbDirty = false
let dbWriteTimer: ReturnType<typeof setTimeout> | null = null
const DB_WRITE_DELAY = 500

function scheduleDbWrite(): void {
  dbDirty = true
  if (dbWriteTimer) return
  dbWriteTimer = setTimeout(() => {
    dbWriteTimer = null
    flushDbWrite()
  }, DB_WRITE_DELAY)
}

function flushDbWrite(): void {
  if (!dbDirty || !db || !dbPath) return
  dbDirty = false
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

/** Config file that persists the custom db path across restarts (stored in userData). */
const configPath = join(app.getPath('userData'), 'db-config.json')

interface DbConfig { dbPath?: string }

function readConfig(): DbConfig {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')) } catch { return {} }
}

function writeConfig(cfg: DbConfig): void {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2))
}

export function getDb(): Database | null { return db }

/** Resolve path to sql-wasm.wasm relative to the sql.js package */
function getWasmPath(file: string): string {
  try {
    const sqlMain = require.resolve('sql.js')
    return join(sqlMain, '..', file)
  } catch {
    const base = app.isPackaged
      ? join(process.resourcesPath, 'node_modules')
      : join(__dirname, '../../node_modules')
    return join(base, 'sql.js', 'dist', file)
  }
}

function createTables(database: Database): void {
  database.run(`CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`)
  database.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
}

function freshDatabase(): Database {
  const database = new sqlStatic!.Database()
  createTables(database)
  return database
}

export async function initDatabase(): Promise<Database> {
  sqlStatic = await initSqlJs({ locateFile: getWasmPath })

  // Prefer custom path from config, fall back to default userData/memo.db
  const cfg = readConfig()
  const defaultPath = join(app.getPath('userData'), 'memo.db')
  dbPath = cfg.dbPath && fs.existsSync(cfg.dbPath) ? cfg.dbPath : defaultPath

  if (fs.existsSync(dbPath)) {
    try {
      const buffer = fs.readFileSync(dbPath)
      db = new sqlStatic.Database(buffer)
      db.exec('SELECT 1')
      createTables(db)
    } catch (e) {
      console.warn('[Notchpad] Database corrupted, creating fresh database:', e)
      try { fs.renameSync(dbPath, dbPath + '.bak') } catch { /* ignore */ }
      db = freshDatabase()
    }
  } else {
    db = freshDatabase()
  }

  // Force an immediate write on init (not debounced)
  if (db && dbPath) {
    const data = db.export()
    fs.writeFileSync(dbPath, Buffer.from(data))
  }
  return db
}

export function migrateDatabase(): void {
  try { db!.run('ALTER TABLE pages ADD COLUMN pinned INTEGER DEFAULT 0') } catch (_e) { /* exists */ }
  scheduleDbWrite()
}

/** Mark the database as changed; actual disk write is batched with a short delay. */
export function saveDatabase(): void {
  scheduleDbWrite()
}

/** Force an immediate synchronous write to disk, bypassing the debounce. */
export function saveDatabaseImmediate(): void {
  if (dbWriteTimer) { clearTimeout(dbWriteTimer); dbWriteTimer = null }
  flushDbWrite()
}

export function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  if (!db) return []
  const stmt = db.prepare(sql)
  try {
    if (params.length) stmt.bind(params as initSqlJs.BindParams)
    const rows: Record<string, unknown>[] = []
    while (stmt.step()) {
      const obj = stmt.getAsObject()
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'bigint') obj[key] = Number(obj[key])
      }
      rows.push(obj)
    }
    return rows
  } finally {
    stmt.free()
  }
}

export function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  return queryAll(sql, params)[0] || null
}

export function closeDatabase(): void {
  saveDatabaseImmediate()
  db?.close()
  db = null
}

/** Return the current active database file path. */
export function getDbPath(): string { return dbPath ?? '' }

/** Relocate the database to a new directory. Copies current db there, updates config. */
export function relocateDatabase(targetDir: string): string {
  if (!db || !dbPath || !sqlStatic) throw new Error('Database not initialised')
  const dest = join(targetDir, 'memo.db')

  // If already at target, just persist the config
  if (dest === dbPath) {
    writeConfig({ dbPath: dest })
    return dest
  }

  saveDatabaseImmediate() // flush current in-memory state to current file first
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
  fs.copyFileSync(dbPath, dest)

  db.close()
  const buffer = fs.readFileSync(dest)
  db = new sqlStatic.Database(buffer)
  dbPath = dest

  writeConfig({ dbPath: dest })
  saveDatabaseImmediate()
  return dest
}
