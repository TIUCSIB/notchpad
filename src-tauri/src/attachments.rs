//! 图片附件存储:图片按内容哈希落盘到数据库同级 attachments/ 目录,
//! 正文只存引用。与 Electron 版 attachments.ts 行为一致,文件名规则相同,
//! 两边生成的附件目录可以互换使用。

use base64::Engine as _;
use sha1::{Digest, Sha1};
use std::fs;
use std::path::{Path, PathBuf};

const EXT_BY_MIME: &[(&str, &str)] = &[
  ("image/png", ".png"),
  ("image/jpeg", ".jpg"),
  ("image/webp", ".webp"),
  ("image/gif", ".gif"),
  ("image/bmp", ".bmp"),
];
const MIME_BY_EXT: &[(&str, &str)] = &[
  (".png", "image/png"),
  (".jpg", "image/jpeg"),
  (".jpeg", "image/jpeg"),
  (".webp", "image/webp"),
  (".gif", "image/gif"),
  (".bmp", "image/bmp"),
];

pub fn attachments_dir(db_path: &Path) -> PathBuf {
  db_path
    .parent()
    .unwrap_or_else(|| Path::new("."))
    .join("attachments")
}

/// 只接受纯文件名,挡掉目录穿越(与 Electron 版 resolveAttachment 一致)
fn valid_name(name: &str) -> bool {
  !name.is_empty() && !name.contains('/') && !name.contains('\\') && !name.contains("..")
}

pub fn save_data_url(data_url: &str, db_path: &Path) -> Result<String, String> {
  let rest = data_url
    .strip_prefix("data:image/")
    .ok_or("无法识别的图片数据")?;
  let (mime_tail, b64) = rest.split_once(";base64,").ok_or("无法识别的图片数据")?;
  let mime = format!("image/{mime_tail}").to_lowercase();
  let ext = EXT_BY_MIME
    .iter()
    .find(|(m, _)| *m == mime)
    .map(|(_, e)| *e)
    .unwrap_or(".bin");
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(b64.trim())
    .map_err(|e| e.to_string())?;
  let name = format!("{}{}", &hex::encode(Sha1::digest(&bytes))[..16], ext);
  let dir = attachments_dir(db_path);
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let file = dir.join(&name);
  if !file.exists() {
    fs::write(&file, &bytes).map_err(|e| e.to_string())?;
  }
  Ok(name)
}

pub fn read_file_bytes(name: &str, db_path: &Path) -> Result<(Vec<u8>, &'static str), String> {
  if !valid_name(name) {
    return Err("非法附件名".into());
  }
  let file = attachments_dir(db_path).join(name);
  let bytes = fs::read(&file).map_err(|_| "Not found".to_string())?;
  let ext = file
    .extension()
    .and_then(|e| e.to_str())
    .unwrap_or("")
    .to_lowercase();
  let dot = format!(".{ext}");
  let mime = MIME_BY_EXT
    .iter()
    .find(|(e, _)| *e == dot)
    .map(|(_, m)| *m)
    .unwrap_or("application/octet-stream");
  Ok((bytes, mime))
}

fn read_data_url(name: &str, db_path: &Path) -> Result<String, String> {
  let (bytes, mime) = read_file_bytes(name, db_path)?;
  Ok(format!(
    "data:{mime};base64,{}",
    base64::engine::general_purpose::STANDARD.encode(bytes)
  ))
}

// ======== Tauri commands ========

#[tauri::command(async)]
pub fn save_attachment(state: tauri::State<'_, crate::db::App>, data_url: String) -> serde_json::Value {
  let db_path = state.db_path.lock().unwrap().clone().unwrap_or_default();
  match save_data_url(&data_url, &db_path) {
    Ok(name) => serde_json::json!({ "ok": true, "name": name }),
    Err(e) => serde_json::json!({ "ok": false, "error": e }),
  }
}

#[tauri::command(async)]
pub fn read_attachment(state: tauri::State<'_, crate::db::App>, name: String) -> Option<String> {
  let db_path = state.db_path.lock().unwrap().clone().unwrap_or_default();
  read_data_url(&name, &db_path).ok()
}

/// notchpad:// 自定义协议处理:Windows 下实际请求形如 http://notchpad.localhost/attachments/<name>
pub fn handle_protocol(
  state: &crate::db::App,
  request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
  let uri = request.uri().to_string();
  let name = uri
    .split("/attachments/")
    .nth(1)
    .unwrap_or("")
    .split('?')
    .next()
    .unwrap_or("");
  let db_path = state.db_path.lock().unwrap().clone().unwrap_or_default();
  match read_file_bytes(name, &db_path) {
    Ok((bytes, mime)) => tauri::http::Response::builder()
      .header("Content-Type", mime)
      .body(bytes)
      .unwrap(),
    Err(_) => tauri::http::Response::builder()
      .status(404)
      .body(b"Not found".to_vec())
      .unwrap(),
  }
}

// ======== 内联图片一次性迁移(Electron 版 migrateInlineImages 的移植) ========

fn extract_inline_images(html: &str, db_path: &Path) -> String {
  let re = regex::Regex::new(r#"(?i)(<img[^>]+src=")(data:image/[a-z0-9.+-]+;base64,)([^"]+)(""#)
    .expect("内置正则必定合法");
  re.replace_all(html, |caps: &regex::Captures| {
    let data_url = format!("{}{}", &caps[2], &caps[3]);
    match save_data_url(&data_url, db_path) {
      Ok(name) => format!("{}http://notchpad.localhost/attachments/{}{}", &caps[1], name, &caps[4]),
      Err(e) => {
        eprintln!("[Notchpad] 提取内联图片失败: {e}");
        caps[0].to_string()
      }
    }
  })
  .into_owned()
}

pub fn migrate_inline_images(state: &crate::db::App) -> usize {
  let db_path = state.db_path.lock().unwrap().clone().unwrap_or_default();
  if db_path.as_os_str().is_empty() {
    return 0;
  }
  let migrated = {
    let guard = state.db.lock().unwrap();
    let Some(conn) = guard.as_ref() else { return 0 };
    let Ok(mut stmt) = conn.prepare("SELECT id, content FROM pages WHERE content LIKE '%data:image%'") else { return 0 };
    let rows: Vec<(i64, String)> = stmt
      .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
      .map(|iter| iter.filter_map(|r| r.ok()).collect())
      .unwrap_or_default();
    if rows.is_empty() {
      return 0;
    }
    // 迁移前先备份,避免迁移出问题时无法回退(与 Electron 版一致)
    if db_path.exists() {
      let backup = db_path.with_file_name("memo.db.before-image-migration.bak");
      if let Err(e) = fs::copy(&db_path, &backup) {
        eprintln!("[Notchpad] 迁移前备份失败,已跳过迁移: {e}");
        return 0;
      }
      eprintln!("[Notchpad] 图片迁移前已备份数据库: {}", backup.display());
    }
    let mut count = 0;
    for (id, content) in rows {
      let replaced = extract_inline_images(&content, &db_path);
      if replaced != content {
        let _ = conn.execute("UPDATE pages SET content = ?1 WHERE id = ?2", rusqlite::params![replaced, id]);
        count += 1;
      }
    }
    count
  };
  if migrated > 0 {
    eprintln!("[Notchpad] 已将 {migrated} 个页面的内联图片提取为附件文件");
  }
  migrated
}
