//! 数据库层:rusqlite(内置 SQLite),与 Electron 版 db.ts 一一对应。
//!
//! better-sqlite3 与 rusqlite 写的是同一种标准 SQLite 文件,两边可互换使用同一份 memo.db。

use rusqlite::Connection;
use serde::Serialize;
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Manager, State};

/// 全局应用状态:数据库连接 + 数据库路径 + 刘海状态机
pub struct App {
  pub db: Mutex<Option<Connection>>,
  pub db_path: Mutex<Option<PathBuf>>,
  pub notch: crate::notch::Notch,
}

#[derive(Serialize, Clone)]
pub struct Page {
  pub id: i64,
  pub title: String,
  pub content: String,
  pub sort_order: i64,
  pub pinned: i64,
  pub created_at: String,
  pub updated_at: String,
}

const PAGE_COLUMNS: &str = "id, title, content, sort_order, pinned, created_at, updated_at";
const PAGE_ORDER: &str = "pinned DESC, sort_order ASC, created_at ASC";

fn row_to_page(row: &rusqlite::Row) -> rusqlite::Result<Page> {
  Ok(Page {
    id: row.get("id")?,
    title: row.get("title")?,
    content: row.get("content")?,
    sort_order: row.get("sort_order")?,
    pinned: row.get("pinned")?,
    created_at: row.get("created_at")?,
    updated_at: row.get("updated_at")?,
  })
}

/// 与 Electron 版 userData 对齐(%APPDATA%/notchpad):老版本的数据(memo.db + attachments)
/// 新版直接沿用,零迁移。Tauri 按 identifier 派生的目录与它不同,这里显式指定。
pub fn app_data_dir(_app: &tauri::AppHandle) -> PathBuf {
  dirs::config_dir()
    .map(|d| d.join("notchpad"))
    .unwrap_or_else(|| std::env::temp_dir().join("notchpad"))
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
  app_data_dir(app).join("db-config.json")
}

fn read_custom_db_path(app: &tauri::AppHandle) -> Option<PathBuf> {
  let text = fs::read_to_string(config_path(app)).ok()?;
  let value: serde_json::Value = serde_json::from_str(&text).ok()?;
  let path = value.get("dbPath")?.as_str()?;
  let path = PathBuf::from(path);
  path.exists().then_some(path)
}

fn write_custom_db_path(app: &tauri::AppHandle, path: &Path) {
  let text = serde_json::to_string_pretty(&json!({ "dbPath": path.to_string_lossy() }))
    .unwrap_or_default();
  let _ = fs::write(config_path(app), text);
}

fn create_tables(conn: &Connection) -> rusqlite::Result<()> {
  conn.execute_batch(
    "CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
  )
}

/// 软删除暂存表:删除的页面先移进来,撤销窗口(约 24 小时)过后由渲染层
/// 通知真正清除。老库升级时按需建表
fn ensure_deleted_table(conn: &Connection) {
  let _ = conn.execute_batch(
    "CREATE TABLE IF NOT EXISTS deleted_pages (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT DEFAULT (datetime('now','localtime'))
    );",
  );
}

fn open_connection(path: &Path) -> Connection {
  match Connection::open(path) {
    Ok(conn) => match conn.query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0)) {
      Ok(s) if s == "ok" => {
        let _ = create_tables(&conn);
        conn
      }
      _ => fresh_after_backup(path),
    },
    Err(_) => fresh_after_backup(path),
  }
}

/// 损坏恢复:原文件改名留档,重建一个空库(与 Electron 版行为一致)
fn fresh_after_backup(path: &Path) -> Connection {
  let _ = fs::rename(path, path.with_extension("db.bak"));
  let conn = Connection::open(path).expect("无法创建新的 SQLite 数据库");
  create_tables(&conn).expect("建表失败");
  conn
}

/// 启动时构建全局状态(在 setup 里 manage)
pub fn init(app: &tauri::AppHandle) -> App {
  let data_dir = app_data_dir(app);
  let _ = fs::create_dir_all(&data_dir);
  let db_path = read_custom_db_path(app).unwrap_or_else(|| data_dir.join("memo.db"));
  let conn = open_connection(&db_path);
  let _ = conn.execute("ALTER TABLE pages ADD COLUMN pinned INTEGER DEFAULT 0", []);
  migrate_attachment_urls(&conn);
  ensure_deleted_table(&conn);
  let _ = conn.execute(
    "DELETE FROM deleted_pages WHERE deleted_at < datetime('now', '-24 hours')",
    [],
  );
  // 每日备份在启动线程同步做:库刚打开、几乎无写入,复制是安全的
  daily_backup(&db_path);
  App {
    db: Mutex::new(Some(conn)),
    db_path: Mutex::new(Some(db_path)),
    notch: crate::notch::Notch::new(),
  }
}

/// 一次性迁移:Electron 时代的附件引用在 Windows 下走 http://notchpad.localhost,
/// 旧数据里的 notchpad:// 引用替换为新形式(非 Windows 平台仍用原始 scheme)
fn migrate_attachment_urls(conn: &Connection) {
  if !cfg!(windows) {
    return;
  }
  let migrated = get_setting(conn, "tauriUrlMigrated").is_none();
  if !migrated {
    return;
  }
  let _ = conn.execute(
    "UPDATE pages SET content = replace(content, 'notchpad://attachments/', 'http://notchpad.localhost/attachments/')",
    [],
  );
  set_setting_kv(conn, "tauriUrlMigrated", "true");
}

pub fn get_setting(conn: &Connection, key: &str) -> Option<String> {
  conn
    .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
      row.get(0)
    })
    .ok()
}

pub fn set_setting_kv(conn: &Connection, key: &str, value: &str) {
  let _ = conn.execute(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
    [key, value],
  );
}

fn list_pages(conn: &Connection) -> Vec<Page> {
  let Ok(mut stmt) = conn.prepare(&format!(
    "SELECT {PAGE_COLUMNS} FROM pages ORDER BY {PAGE_ORDER}"
  )) else {
    return Vec::new();
  };
  let rows = stmt.query_map([], row_to_page);
  match rows {
    Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
    Err(_) => Vec::new(),
  }
}

// ======== Tauri commands ========

/// 锁中毒不致命:持锁线程 panic 时数据本身仍一致,恢复使用而不是让
/// 后续所有命令跟着 panic
pub fn lock_db(state: &App) -> std::sync::MutexGuard<'_, Option<Connection>> {
  state.db.lock().unwrap_or_else(|p| p.into_inner())
}

pub fn lock_db_path(state: &App) -> std::sync::MutexGuard<'_, Option<PathBuf>> {
  state.db_path.lock().unwrap_or_else(|p| p.into_inner())
}

fn with_conn<R>(
  state: &App,
  f: impl FnOnce(&Connection) -> R,
) -> R {
  let guard = lock_db(state);
  let conn = guard.as_ref().expect("数据库未初始化");
  f(conn)
}

#[tauri::command(async)]
pub fn get_pages(state: State<'_, App>) -> Vec<Page> {
  with_conn(&state, list_pages)
}

#[tauri::command(async)]
pub fn add_page(state: State<'_, App>) -> Vec<Page> {
  with_conn(&state, |conn| {
    let max: i64 = conn
      .query_row("SELECT COALESCE(MAX(sort_order), -1) FROM pages", [], |r| {
        r.get(0)
      })
      .unwrap_or(-1);
    let _ = conn.execute(
      "INSERT INTO pages (title, content, sort_order) VALUES (?1, ?2, ?3)",
      rusqlite::params!["", "", max + 1],
    );
    list_pages(conn)
  })
}

#[tauri::command(async)]
pub fn delete_page(state: State<'_, App>, id: i64) -> bool {
  let guard = lock_db(&state);
  let Some(conn) = guard.as_ref() else { return false };
  ensure_deleted_table(conn);
  // 软删除:整行先移入 deleted_pages 撤销窗口内可恢复,再从 pages 删掉
  let moved = conn
    .execute(
      "INSERT OR REPLACE INTO deleted_pages
         (id, title, content, sort_order, pinned, created_at, updated_at)
       SELECT id, title, content, sort_order, pinned, created_at, updated_at
         FROM pages WHERE id = ?1",
      [id],
    )
    .is_ok();
  if !moved {
    return false;
  }
  conn.execute("DELETE FROM pages WHERE id = ?1", [id]).is_ok()
}

/// 撤销删除:把暂存的页面移回 pages。成功返回页面内容(渲染层用它重建视图)
#[tauri::command(async)]
pub fn restore_deleted_page(state: State<'_, App>, id: i64) -> Option<Page> {
  let guard = lock_db(&state);
  let conn = guard.as_ref()?;
  ensure_deleted_table(conn);
  let restored = conn
    .execute(
      "INSERT OR REPLACE INTO pages
         (id, title, content, sort_order, pinned, created_at, updated_at)
       SELECT id, title, content, sort_order, pinned, created_at, updated_at
         FROM deleted_pages WHERE id = ?1",
      [id],
    )
    .is_ok();
  if !restored {
    return None;
  }
  let _ = conn.execute("DELETE FROM deleted_pages WHERE id = ?1", [id]);
  page_by_id(conn, id)
}

/// 清掉撤销窗口已过(超过 24 小时)的软删除暂存,启动和删除时顺带执行
#[tauri::command(async)]
pub fn purge_expired_deleted(state: State<'_, App>) {
  let guard = lock_db(&state);
  if let Some(conn) = guard.as_ref() {
    ensure_deleted_table(conn);
    let _ = conn.execute(
      "DELETE FROM deleted_pages WHERE deleted_at < datetime('now', '-24 hours')",
      [],
    );
  }
}

#[tauri::command(async)]
pub fn update_page(state: State<'_, App>, id: i64, content: String) -> Option<Page> {
  with_conn(&state, |conn| {
    let _ = conn.execute(
      "UPDATE pages SET content = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
      rusqlite::params![content, id],
    );
    page_by_id(conn, id)
  })
}

#[tauri::command(async)]
pub fn update_page_title(state: State<'_, App>, id: i64, title: String) -> Option<Page> {
  with_conn(&state, |conn| {
    let _ = conn.execute(
      "UPDATE pages SET title = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
      rusqlite::params![title, id],
    );
    page_by_id(conn, id)
  })
}

fn page_by_id(conn: &Connection, id: i64) -> Option<Page> {
  conn
    .query_row(
      &format!("SELECT {PAGE_COLUMNS} FROM pages WHERE id = ?1"),
      [id],
      row_to_page,
    )
    .ok()
}

#[tauri::command(async)]
pub fn reorder_pages(state: State<'_, App>, ids: Vec<i64>) {
  with_conn(&state, |conn| {
    let Ok(mut stmt) = conn.prepare("UPDATE pages SET sort_order = ?1 WHERE id = ?2") else {
      return;
    };
    for (index, id) in ids.iter().enumerate() {
      let _ = stmt.execute(rusqlite::params![index as i64, id]);
    }
  })
}

#[tauri::command(async)]
pub fn toggle_pin_page(state: State<'_, App>, id: i64) -> Vec<Page> {
  with_conn(&state, |conn| {
    let pinned: i64 = conn
      .query_row("SELECT pinned FROM pages WHERE id = ?1", [id], |r| r.get(0))
      .unwrap_or(0);
    let _ = conn.execute(
      "UPDATE pages SET pinned = ?1 WHERE id = ?2",
      rusqlite::params![1 - pinned, id],
    );
    let Ok(mut stmt) = conn.prepare(
      "UPDATE pages SET sort_order = ?1 WHERE id = ?2",
    ) else {
      return list_pages(conn);
    };
    let Ok(mut rows) = conn.prepare(&format!("SELECT id FROM pages ORDER BY {PAGE_ORDER}")) else {
      return list_pages(conn);
    };
    let ids: Vec<i64> = rows
      .query_map([], |r| r.get(0))
      .map(|iter| iter.filter_map(|r| r.ok()).collect())
      .unwrap_or_default();
    for (index, id) in ids.iter().enumerate() {
      let _ = stmt.execute(rusqlite::params![index as i64, id]);
    }
    list_pages(conn)
  })
}

#[tauri::command(async)]
pub fn get_settings(state: State<'_, App>) -> std::collections::BTreeMap<String, String> {
  with_conn(&state, |conn| {
    let mut map = std::collections::BTreeMap::new();
    if let Ok(mut stmt) = conn.prepare("SELECT key, value FROM settings") {
      if let Ok(rows) = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))) {
        for row in rows.flatten() {
          map.insert(row.0, row.1);
        }
      }
    }
    map
  })
}

#[tauri::command(async)]
pub fn set_setting(
  app: tauri::AppHandle,
  state: State<'_, App>,
  key: String,
  value: String,
) {
  with_conn(&state, |conn| set_setting_kv(conn, &key, &value));
  if key == "autoStart" {
    use tauri_plugin_autostart::ManagerExt as _;
    let launch = app.autolaunch();
    if value == "true" {
      let _ = launch.enable();
    } else {
      let _ = launch.disable();
    }
  }
  if key == "wakeMode" {
    state.notch.set_wake_mode(&value);
    // 与 Electron 版一致:刘海状态下先设为穿透,click 模式由轮询在药丸上恢复
    let is_notched = state.notch.is_notched();
    if is_notched {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(true);
      }
    }
  }
}

#[tauri::command(async)]
pub fn reset_settings(app: tauri::AppHandle, state: State<'_, App>) {
  with_conn(&state, |conn| {
    let _ = conn.execute("DELETE FROM settings", []);
  });
  use tauri_plugin_autostart::ManagerExt as _;
  let _ = app.autolaunch().disable();
}

#[tauri::command(async)]
pub fn get_db_path(state: State<'_, App>) -> String {
  lock_db_path(&state)
    .as_ref()
    .map(|p| p.to_string_lossy().into_owned())
    .unwrap_or_default()
}

#[tauri::command(async)]
pub fn choose_db_dir(app: tauri::AppHandle) -> Option<String> {
  use tauri_plugin_dialog::DialogExt as _;
  app.dialog().file().blocking_pick_folder().and_then(|file| {
    file.as_path().map(|p| p.to_string_lossy().into_owned())
  })
}

#[tauri::command(async)]
pub fn relocate_db(
  app: tauri::AppHandle,
  state: State<'_, App>,
  target_dir: String,
) -> serde_json::Value {
  match relocate_inner(&app, &state, Path::new(&target_dir)) {
    Ok(path) => json!({ "ok": true, "path": path }),
    Err(e) => {
      eprintln!("[Notchpad] relocate-db error: {e}");
      json!({ "ok": false, "error": e.to_string() })
    }
  }
}

fn relocate_inner(app: &tauri::AppHandle, state: &App, target_dir: &Path) -> Result<String, String> {
  let mut db_guard = lock_db(state);
  let mut path_guard = lock_db_path(state);
  if db_guard.as_ref().is_none() || path_guard.as_ref().is_none() {
    return Err("数据库未初始化".into());
  }
  let current = path_guard.clone().unwrap();
  let dest = target_dir.join("memo.db");

  if dest == current {
    write_custom_db_path(app, &dest);
    return Ok(dest.to_string_lossy().into_owned());
  }

  fs::create_dir_all(target_dir).map_err(|e| e.to_string())?;

  // 目标目录已有同名库时先改名备份,避免静默覆盖
  if dest.exists() {
    let stamp = chrono_like_stamp();
    let backup = dest.with_file_name(format!("memo.db.{stamp}.bak"));
    fs::rename(&dest, &backup).map_err(|e| e.to_string())?;
  }

  // db 锁持有期间没有并发写入,直接拷贝文件是一致的。
  // 全程不先关旧连接:任何一步失败,原连接原封不动,应用照常可用
  // (此前先 take() 关库,拷贝失败会让 db 留在 None,后续所有命令 panic)
  let old_attachments = current.parent().map(|p| p.join("attachments"));
  fs::copy(&current, &dest).map_err(|e| e.to_string())?;
  if let Some(old) = old_attachments {
    let new = target_dir.join("attachments");
    if old != new && old.exists() {
      copy_dir_recursive(&old, &new).map_err(|e| e.to_string())?;
    }
  }

  // open_connection 成功后才赋值,赋值会顺带 drop 旧连接
  let conn = open_connection(&dest);
  *db_guard = Some(conn);
  *path_guard = Some(dest.clone());
  write_custom_db_path(app, &dest);
  Ok(dest.to_string_lossy().into_owned())
}

fn chrono_like_stamp() -> String {
  // 仅用于备份文件名唯一性,取纪元秒即可读且唯一
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs()
    .to_string()
}

/// 每日自动备份:启动时把数据库复制到同级 backups/ 目录,保留最近 7 份。
/// 同一天多次启动只保留一份(文件名按日期),是误删/误清后的最后悔药。
pub fn daily_backup(db_path: &Path) {
  let Some(dir) = db_path.parent() else { return };
  let backup_dir = dir.join("backups");
  if fs::create_dir_all(&backup_dir).is_err() {
    return;
  }
  let today = chrono_like_stamp_date();
  let target = backup_dir.join(format!("memo.{today}.db"));
  if target.exists() {
    return;
  }
  if fs::copy(db_path, &target).is_err() {
    return;
  }
  // 只保留最近 7 份
  let mut backups: Vec<PathBuf> = fs::read_dir(&backup_dir)
    .map(|entries| {
      entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| {
          p.file_name()
            .and_then(|n| n.to_str())
            .is_some_and(|n| n.starts_with("memo.") && n.ends_with(".db"))
        })
        .collect()
    })
    .unwrap_or_default();
  backups.sort();
  while backups.len() > 7 {
    let oldest = backups.remove(0);
    let _ = fs::remove_file(oldest);
  }
}

/// 本地日期 YYYYMMDD(备份文件名用,本地时区)
fn chrono_like_stamp_date() -> String {
  let secs = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs() as i64;
  // 东八区偏移按本地时间换算:直接用 libc localtime 的替代——手算偏移不可靠,
  // 改用 chrono 的最小实现:通过环境 TZ 不可行,这里用 UTC+8(产品主要面向中文用户)
  let local = secs + 8 * 3600;
  let days = local.div_euclid(86_400);
  // 自 1970-01-01 起的天数转 y/m/d(公历算法)
  let z = days + 719_468;
  let era = z.div_euclid(146_097);
  let doe = z.rem_euclid(146_097);
  let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
  let y = yoe + era * 400;
  let d = doe - (365 * yoe + yoe / 4 - yoe / 100);
  let mp = (5 * d + 2) / 153;
  let day = d - (153 * mp + 2) / 5 + 1;
  let month = if mp < 10 { mp + 3 } else { mp - 9 };
  let year = if month <= 2 { y + 1 } else { y };
  format!("{year:04}{month:02}{day:02}")
}

fn copy_dir_recursive(from: &Path, to: &Path) -> std::io::Result<()> {
  fs::create_dir_all(to)?;
  for entry in fs::read_dir(from)? {
    let entry = entry?;
    let ty = entry.file_type()?;
    let dest = to.join(entry.file_name());
    if ty.is_dir() {
      copy_dir_recursive(&entry.path(), &dest)?;
    } else {
      fs::copy(entry.path(), dest)?;
    }
  }
  Ok(())
}
