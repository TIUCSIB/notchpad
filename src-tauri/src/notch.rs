//! 刘海状态机:移植自 Electron 版 notch.ts。
//! 收起态轮询 100ms / 展开态 200ms,判定光标是否落在药丸(命中尺寸由渲染层上报)
//! 或已离开窗口(带 10px 滞回)。收起态窗口鼠标穿透,click 唤醒模式在药丸上恢复事件。

use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use windows::Win32::Foundation::POINT;
use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

const NOTCH_COOLDOWN_MS: i64 = 350;
const ALWAYS_ON_TOP_REFRESH_MS: i64 = 3000;
const POLL_MS_COLLAPSED: u64 = 100;
const POLL_MS_EXPANDED: u64 = 200;
/// 光标离开窗口边缘多少像素(逻辑)就收起,只留极小滞回防边缘抖动
const COLLAPSE_MARGIN_LOGICAL: f64 = 10.0;
const SHORTCUT_PAUSE_MS: i64 = 1500;

pub struct Notch {
  is_notched: AtomicBool,
  pill_width: AtomicU32,
  pill_height: AtomicU32,
  wake_mode: Mutex<String>,
  pill_hovering: AtomicBool,
  pause_until_ms: AtomicI64,
  last_change_ms: AtomicI64,
  last_top_refresh_ms: AtomicI64,
  /// 渲染层是否已画过第一帧(冷启动隐藏窗口,等 renderer_ready 再亮出)
  painted: AtomicBool,
}

impl Notch {
  pub fn new() -> Self {
    Self {
      is_notched: AtomicBool::new(true),
      pill_width: AtomicU32::new(72),
      pill_height: AtomicU32::new(14),
      wake_mode: Mutex::new("hover".into()),
      pill_hovering: AtomicBool::new(false),
      pause_until_ms: AtomicI64::new(0),
      last_change_ms: AtomicI64::new(0),
      last_top_refresh_ms: AtomicI64::new(0),
      painted: AtomicBool::new(false),
    }
  }

  pub fn is_notched(&self) -> bool {
    self.is_notched.load(Ordering::Relaxed)
  }

  /// 渲染层是否已画过第一帧(兜底亮窗定时器据此判断)
  pub fn painted(&self) -> bool {
    self.painted.load(Ordering::Relaxed)
  }

  pub fn set_wake_mode(&self, mode: &str) {
    *self.wake_mode.lock().unwrap() = mode.to_string();
    self.pill_hovering.store(false, Ordering::Relaxed);
  }
}

fn now_ms() -> i64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis() as i64
}

fn cursor_pos() -> (i32, i32) {
  let mut p = POINT::default();
  let _ = unsafe { GetCursorPos(&mut p) };
  (p.x, p.y)
}

fn main_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
  app.get_webview_window("main")
}

fn begin_notch(app: &tauri::AppHandle) {
  let state = app.state::<crate::db::App>();
  state.notch.is_notched.store(true, Ordering::Relaxed);
  state.notch.pill_hovering.store(false, Ordering::Relaxed);
  if let Some(window) = main_window(app) {
    let _ = window.set_ignore_cursor_events(true);
  }
  let _ = app.emit("notch-changed", true);
}

fn end_notch(app: &tauri::AppHandle) {
  let state = app.state::<crate::db::App>();
  state.notch.is_notched.store(false, Ordering::Relaxed);
  if let Some(window) = main_window(app) {
    let _ = window.set_ignore_cursor_events(false);
    let _ = window.set_focus();
  }
  let _ = app.emit("notch-changed", false);
}

/// 渲染层画完第一帧(renderer_ready):亮窗并进入刘海态
pub fn reveal(app: &tauri::AppHandle) {
  let state = app.state::<crate::db::App>();
  state.notch.painted.store(true, Ordering::Relaxed);
  if let Some(window) = main_window(app) {
    if !window.is_visible().unwrap_or(true) {
      let _ = window.show();
    }
    let _ = window.set_focus();
  }
  begin_notch(app);
}

/// 托盘"显示窗口"/ 双击托盘 / 二实例唤起:渲染层早已画好,直接亮出
pub fn show_in_notch(app: &tauri::AppHandle) {
  let state = app.state::<crate::db::App>();
  if !state.notch.painted.load(Ordering::Relaxed) {
    return;
  }
  if let Some(window) = main_window(app) {
    let _ = window.show();
    let _ = window.set_focus();
  }
  begin_notch(app);
}

/// 全局快捷键 Ctrl+Alt+Z:呼出窗口、展开、短暂抑制自动收回
pub fn activate_by_shortcut(app: &tauri::AppHandle) {
  if let Some(window) = main_window(app) {
    if !window.is_visible().unwrap_or(false) {
      let _ = window.show();
    }
    if !window.is_focused().unwrap_or(false) {
      let _ = window.set_focus();
    }
  }
  end_notch(app);
  let state = app.state::<crate::db::App>();
  state
    .notch
    .pause_until_ms
    .store(now_ms() + SHORTCUT_PAUSE_MS, Ordering::Relaxed);
}

/// 单次轮询(与 Electron 版 pollOnce 逻辑一致)
fn poll_once(app: &tauri::AppHandle) {
  let Some(window) = main_window(app) else { return };
  if !window.is_visible().unwrap_or(false) {
    return;
  }
  let state = app.state::<crate::db::App>();
  let notch = &state.notch;
  let now = now_ms();

  // 周期性重申置顶层级,防止其他窗口抢 z 序
  if now - notch.last_top_refresh_ms.load(Ordering::Relaxed) > ALWAYS_ON_TOP_REFRESH_MS {
    let _ = window.set_always_on_top(true);
    notch.last_top_refresh_ms.store(now, Ordering::Relaxed);
  }

  if now - notch.last_change_ms.load(Ordering::Relaxed) < NOTCH_COOLDOWN_MS {
    return;
  }

  let (cx, cy) = cursor_pos();
  let Ok(pos) = window.outer_position() else { return };
  let Ok(size) = window.outer_size() else { return };
  let scale = window.scale_factor().unwrap_or(1.0);

  if notch.is_notched() {
    let pw = (notch.pill_width.load(Ordering::Relaxed) as f64 * scale).round() as i32;
    let ph = (notch.pill_height.load(Ordering::Relaxed) as f64 * scale).round() as i32;
    let left = pos.x + (size.width as i32 - pw) / 2;
    let top = pos.y;
    let on_pill = cx >= left && cx <= left + pw && cy >= top && cy <= top + ph;

    let mode = notch.wake_mode.lock().unwrap().clone();
    if mode == "click" {
      if on_pill && !notch.pill_hovering.load(Ordering::Relaxed) {
        notch.pill_hovering.store(true, Ordering::Relaxed);
        let _ = window.set_ignore_cursor_events(false);
      } else if !on_pill && notch.pill_hovering.load(Ordering::Relaxed) {
        notch.pill_hovering.store(false, Ordering::Relaxed);
        let _ = window.set_ignore_cursor_events(true);
      }
    } else if on_pill {
      notch.last_change_ms.store(now, Ordering::Relaxed);
      end_notch(app);
    }
  } else {
    if now < notch.pause_until_ms.load(Ordering::Relaxed) {
      return;
    }
    let margin = (COLLAPSE_MARGIN_LOGICAL * scale).round() as i32;
    let outside = cx < pos.x - margin
      || cx > pos.x + size.width as i32 + margin
      || cy < pos.y - margin
      || cy > pos.y + size.height as i32 + margin;
    if outside {
      notch.last_change_ms.store(now, Ordering::Relaxed);
      begin_notch(app);
    }
  }
}

/// 轮询线程:间隔随刘海状态变化,收起态优先响应
pub fn spawn_polling(app: tauri::AppHandle) {
  std::thread::spawn(move || loop {
    let notched = app
      .try_state::<crate::db::App>()
      .map(|s| s.notch.is_notched())
      .unwrap_or(true);
    poll_once(&app);
    std::thread::sleep(std::time::Duration::from_millis(if notched {
      POLL_MS_COLLAPSED
    } else {
      POLL_MS_EXPANDED
    }));
  });
}

// ======== Tauri commands ========

pub fn position_top_center(window: &tauri::WebviewWindow, monitor: &tauri::Monitor) {
  let mp = monitor.position();
  let ms = monitor.size();
  let Ok(size) = window.outer_size() else { return };
  let x = mp.x + (ms.width as i32 - size.width as i32) / 2;
  let _ = window.set_position(tauri::PhysicalPosition::new(x, mp.y));
}

#[tauri::command(async)]
pub fn switch_display(app: tauri::AppHandle) {
  let Some(window) = main_window(&app) else { return };
  let Ok(monitors) = window.available_monitors() else { return };
  if monitors.len() <= 1 {
    return;
  }
  let Ok(pos) = window.outer_position() else { return };
  let Ok(size) = window.outer_size() else { return };
  let cx = pos.x + size.width as i32 / 2;
  let cy = pos.y + size.height as i32 / 2;
  let current = monitors
    .iter()
    .position(|m| {
      let mp = m.position();
      let ms = m.size();
      cx >= mp.x && cx < mp.x + ms.width as i32 && cy >= mp.y && cy < mp.y + ms.height as i32
    })
    .unwrap_or(0);
  let next = &monitors[(current + 1) % monitors.len()];
  position_top_center(&window, next);
  // 持久化选择,下次启动定位到同一显示器
  let state = app.state::<crate::db::App>();
  let guard = crate::db::lock_db(&state);
  if let Some(conn) = guard.as_ref() {
    let name = next.name().map(|s| s.to_string()).unwrap_or_default();
    crate::db::set_setting_kv(conn, "displayName", &name);
  }
}

#[tauri::command]
pub fn close_window(app: tauri::AppHandle) {
  if let Some(window) = main_window(&app) {
    let _ = window.hide();
  }
}

#[tauri::command]
pub fn open_external(app: tauri::AppHandle, url: String) {
  if url.starts_with("http://") || url.starts_with("https://") {
    use tauri_plugin_opener::OpenerExt as _;
    let _ = app.opener().open_url(url, None::<&str>);
  }
}

#[tauri::command]
pub fn enter_notch(app: tauri::AppHandle) {
  begin_notch(&app);
}

#[tauri::command]
pub fn exit_notch(app: tauri::AppHandle) {
  end_notch(&app);
}

#[tauri::command(async)]
pub fn update_pill_size(state: tauri::State<'_, crate::db::App>, width: f64, height: f64) {
  if width > 0.0 {
    state
      .notch
      .pill_width
      .store(width.round() as u32, Ordering::Relaxed);
  }
  if height > 0.0 {
    state
      .notch
      .pill_height
      .store(height.round() as u32, Ordering::Relaxed);
  }
}

#[tauri::command]
pub fn renderer_ready(app: tauri::AppHandle) {
  reveal(&app);
}
