use notchpad::attachments::clean_attachments_impl;
use std::fs;

#[test]
fn cleans_unreferenced_keeps_referenced_and_recent() {
  let tmp = std::env::temp_dir().join("notch-clean-test");
  let _ = fs::remove_dir_all(&tmp);
  fs::create_dir_all(tmp.join("attachments")).unwrap();
  let db_path = tmp.join("memo.db");
  let conn = rusqlite::Connection::open(&db_path).unwrap();
  conn
    .execute_batch(
      "CREATE TABLE pages (id INTEGER PRIMARY KEY, content TEXT NOT NULL DEFAULT '');
       INSERT INTO pages (content) VALUES ('<img src=\"http://notchpad.localhost/attachments/1111111111111111.jpg\">');
       INSERT INTO pages (content) VALUES ('<img src=\"notchpad://attachments/2222222222222222.png\">');",
    )
    .unwrap();
  let dir = tmp.join("attachments");
  fs::write(dir.join("1111111111111111.jpg"), b"a").unwrap();
  fs::write(dir.join("2222222222222222.png"), b"b").unwrap();
  fs::write(dir.join("3333333333333333.jpg"), b"orphan").unwrap();
  fs::write(dir.join("4444444444444444.jpg"), b"recent").unwrap();
  fs::write(dir.join("notes.txt"), b"not an attachment").unwrap();

  // 3333 的 mtime 拨到 3 分钟前(2 分钟豁免窗口外);4444 保持现在
  let old = filetime::FileTime::from_system_time(
    std::time::SystemTime::now() - std::time::Duration::from_secs(180),
  );
  filetime::set_file_mtime(dir.join("3333333333333333.jpg"), old).unwrap();

  let deleted = clean_attachments_impl(&db_path);
  assert_eq!(deleted, 1, "只应删除 3333 孤儿文件");
  assert!(dir.join("1111111111111111.jpg").exists(), "http:// 引用的应保留");
  assert!(dir.join("2222222222222222.png").exists(), "notchpad:// 引用的应保留");
  assert!(dir.join("4444444444444444.jpg").exists(), "10 分钟内新增的应豁免");
  assert!(dir.join("notes.txt").exists(), "非附件命名的文件应保留");
  assert!(!dir.join("3333333333333333.jpg").exists(), "孤儿应被删除");
}
