#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod attachments;
mod db;
mod notch;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
  let show = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &quit])?;
  TrayIconBuilder::with_id("main")
    .icon(tauri::image::Image::from_bytes(include_bytes!(
      "../icons/32x32.png"
    ))?)
    .tooltip("Notchpad")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      "show" => notch::show_in_notch(app),
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
        notch::show_in_notch(tray.app_handle());
      }
    })
    .build(app)?;
  Ok(())
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      // 二次启动:唤起已有实例
      notch::show_in_notch(app);
    }))
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None,
    ))
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, _shortcut, event| {
          if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
            notch::activate_by_shortcut(app);
          }
        })
        .build(),
    )
    .register_uri_scheme_protocol("notchpad", |ctx, request| {
      let state = ctx.app_handle().state::<db::App>();
      attachments::handle_protocol(&state, request)
    })
    .setup(|app| {
      let state = db::init(app.handle());
      // 启动定位:优先上次选择的显示器,否则主显示器,屏幕顶部居中
      if let Some(window) = app.get_webview_window("main") {
        let saved = {
          let guard = state.db.lock().unwrap();
          guard.as_ref().and_then(|conn| db::get_setting(conn, "displayName"))
        };
        let monitors = window.available_monitors().unwrap_or_default();
        let primary = window.primary_monitor().ok().flatten();
        let target = monitors
          .iter()
          .find(|m| m.name().map(|s| s.as_str()) == saved.as_deref())
          .or_else(|| primary.as_ref())
          .or_else(|| monitors.first());
        if let Some(monitor) = target {
          notch::position_top_center(&window, monitor);
        }
      }
      app.manage(state);

      setup_tray(app.handle())?;

      use tauri_plugin_global_shortcut::GlobalShortcutExt as _;
      if let Err(e) = app.global_shortcut().register("ctrl+alt+z") {
        eprintln!("[Notchpad] 全局快捷键注册失败(可能被占用): {e}");
      }

      notch::spawn_polling(app.handle().clone());

      // 渲染层异常时兜底亮窗(对齐 Electron 版的强制显示):
      // renderer_ready 迟迟不来就把窗口亮出来,避免永远隐形
      let fallback = app.handle().clone();
      std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(4));
        let state = fallback.state::<db::App>();
        if !state.notch.painted() {
          if let Some(window) = fallback.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
          }
        }
      });

      // 内联图片迁移比较耗时,延迟到窗口显示之后再跑(与 Electron 版一致)
      let handle = app.handle().clone();
      std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        let state = handle.state::<db::App>();
        attachments::migrate_inline_images(&state);
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      db::get_pages,
      db::add_page,
      db::delete_page,
      db::update_page,
      db::update_page_title,
      db::reorder_pages,
      db::toggle_pin_page,
      db::get_settings,
      db::set_setting,
      db::reset_settings,
      db::get_db_path,
      db::choose_db_dir,
      db::relocate_db,
      attachments::save_attachment,
      attachments::read_attachment,
      attachments::clean_attachments,
      notch::enter_notch,
      notch::exit_notch,
      notch::update_pill_size,
      notch::renderer_ready,
      notch::switch_display,
      notch::close_window,
      notch::open_external
    ])
    .on_window_event(|window, event| {
      // 关闭 = 隐藏,常驻托盘(与 Electron 版一致)
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
