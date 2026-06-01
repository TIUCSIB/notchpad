import { app } from 'electron'
import { join } from 'path'
import fs from 'fs'
import initSqlJs, { Database } from 'sql.js'

let db: Database | null = null
let dbPath: string | null = null

export function getDb(): Database | null { return db }

export async function initDatabase(): Promise<Database> {
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
  if (params.length) stmt.bind(params as initSqlJs.BindParams)
  const rows: Record<string, unknown>[] = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

export function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  return queryAll(sql, params)[0] || null
}

export function closeDatabase(): void {
  saveDatabase()
  db?.close()
  db = null
}
