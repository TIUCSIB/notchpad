import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import initSqlJs, { Database } from 'sql.js'

let db: Database | null = null
let dbPath: string | null = null

export function getDb(): Database | null { return db }

/** Resolve path to sql-wasm.wasm relative to the sql.js package */
function getWasmPath(file: string): string {
  // require.resolve finds the sql.js main entry; dist/ folder is alongside it
  try {
    const sqlMain = require.resolve('sql.js')
    return join(sqlMain, '..', file)
  } catch {
    // Fallback: try from project node_modules
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

function freshDatabase(SQL: ReturnType<typeof initSqlJs> extends Promise<infer T> ? T : never): Database {
  const database = new SQL.Database()
  createTables(database)
  return database
}

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: getWasmPath })
  dbPath = join(app.getPath('userData'), 'memo.db')

  if (fs.existsSync(dbPath)) {
    try {
      const buffer = fs.readFileSync(dbPath)
      db = new SQL.Database(buffer)
      // Verify the database is usable by running a simple query
      db.exec('SELECT 1')
      // Ensure tables exist (handles first-run after schema migration)
      createTables(db)
    } catch (e) {
      console.warn('[Notchpad] Database corrupted, creating fresh database:', e)
      try { fs.renameSync(dbPath, dbPath + '.bak') } catch { /* ignore */ }
      db = freshDatabase(SQL)
    }
  } else {
    db = freshDatabase(SQL)
  }

  saveDatabase()
  return db
}

export function migrateDatabase(): void {
  try { db!.run('ALTER TABLE pages ADD COLUMN pinned INTEGER DEFAULT 0') } catch (_e) { /* exists */ }
  saveDatabase()
}

export function saveDatabase(): void {
  if (!db || !dbPath) return
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
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
  saveDatabase()
  db?.close()
  db = null
}
