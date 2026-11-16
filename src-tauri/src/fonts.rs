//! 系统字体枚举。Windows 用 GDI 的 EnumFontFamiliesExW 取字体族名,
//! 其它平台暂时返回空列表,渲染层会回落到内置预设字体。

use std::collections::BTreeSet;

/// 规范化字体名:去首尾空白、丢掉空串和 @ 开头的垂直字体、去重 + 排序。
/// 抽成纯函数便于单测。
pub fn normalize_font_names(names: Vec<String>) -> Vec<String> {
  names
    .into_iter()
    .map(|s| s.trim().to_string())
    .filter(|s| !s.is_empty() && !s.starts_with('@'))
    .collect::<BTreeSet<_>>()
    .into_iter()
    .collect()
}

#[cfg(windows)]
mod platform {
  use super::normalize_font_names;
  use windows::Win32::Foundation::LPARAM;
  use windows::Win32::Graphics::Gdi::{
    EnumFontFamiliesExW, GetDC, ReleaseDC, DEFAULT_CHARSET, FONTENUMPROCW, LOGFONTW, TEXTMETRICW,
  };

  pub fn list_fonts() -> Vec<String> {
    let mut names: Vec<String> = Vec::new();
    unsafe {
      let hdc = GetDC(None);
      if !hdc.is_invalid() {
        let mut logfont = LOGFONTW::default();
        logfont.lfCharSet = DEFAULT_CHARSET;
        // lfFaceName 保持全 0 = 枚举所有字体族
        let callback: FONTENUMPROCW = Some(enum_font_callback);
        let _ = EnumFontFamiliesExW(
          hdc,
          &logfont,
          callback,
          LPARAM(&mut names as *mut Vec<String> as isize),
          0,
        );
        ReleaseDC(None, hdc);
      }
    }
    normalize_font_names(names)
  }

  unsafe extern "system" fn enum_font_callback(
    logfont: *const LOGFONTW,
    _metric: *const TEXTMETRICW,
    _font_type: u32,
    lparam: LPARAM,
  ) -> i32 {
    let names = &mut *(lparam.0 as *mut Vec<String>);
    // LOGFONTW 是 ENUMLOGFONTEXW 的首字段,lfFaceName 直接可读
    let face = &(*logfont).lfFaceName;
    let len = face.iter().position(|&c| c == 0).unwrap_or(face.len());
    if len > 0 {
      names.push(String::from_utf16_lossy(&face[..len]));
    }
    1 // 返回 1 继续枚举
  }
}

#[cfg(not(windows))]
mod platform {
  pub fn list_fonts() -> Vec<String> {
    Vec::new()
  }
}

#[tauri::command]
pub fn list_fonts() -> Vec<String> {
  platform::list_fonts()
}
