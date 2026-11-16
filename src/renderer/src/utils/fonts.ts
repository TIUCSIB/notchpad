/**
 * 全局默认字体相关纯逻辑,不依赖 Vue / window,便于单测。
 */

/** 系统默认字体栈,与 App.css .panel 的历史默认值保持一致 */
export const SYSTEM_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif"

/** 后端字体枚举不可用时的回落预设(工具栏已有的常用字体) */
export const FALLBACK_FONT_OPTIONS = [
  'Microsoft YaHei',
  'SimSun',
  'SimHei',
  'KaiTi',
  'FangSong',
  'Arial',
  'Georgia',
  'Courier New'
]

/**
 * 把单个字体名拼成 CSS font-family 值。
 * 带空格的字体名必须加引号;顺手去掉引号/分号/大括号等字符,避免破坏 CSS 声明。
 * 末尾保留系统栈做 fallback:所选字体缺字时仍能正常显示。
 */
export function fontFamilyStack(name: string): string {
  const clean = name.replace(/["\\;{}<>]/g, '').trim()
  return clean ? `"${clean}", ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK
}
