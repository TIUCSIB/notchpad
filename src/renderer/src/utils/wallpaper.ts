/**
 * 壁纸相关的纯逻辑:颜色换算、文字明暗决策、主题变量覆盖。
 * 不依赖 Vue / window,方便单测。
 */

export type WallpaperTone = 'light' | 'dark'
export type WallpaperText = 'auto' | 'light' | 'dark'

/** #rrggbb -> rgba(),供半透明背景/遮罩用;非法输入退回原值 */
export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 1000) / 1000
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** 把设置里的数值解析成 [min,max] 区间内的整数,空/非法取默认值 */
export function clampInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const n = parseInt(raw ?? '', 10)
  if (Number.isNaN(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

/**
 * 文字明暗:auto 跟随壁纸整体明暗(亮壁纸用深字,暗壁纸用浅字),
 * light / dark 为用户强制指定。
 */
export function resolveWallpaperText(tone: WallpaperTone, pref: WallpaperText): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref
  return tone === 'dark' ? 'light' : 'dark'
}

/**
 * 壁纸开启时覆盖的主题变量:卡片/工具栏改半透明让壁纸透出,
 * 文字、边框、悬停态随明暗切换,保证在任意壁纸上都读得清。
 */
export function wallpaperVars(text: 'light' | 'dark'): Record<string, string> {
  if (text === 'light') {
    return {
      '--text-primary': '#f7f4ee',
      '--text-secondary': 'rgba(247,244,238,0.75)',
      '--label-color': 'rgba(247,244,238,0.62)',
      '--editor-heading-color': '#f7f4ee',
      '--border': 'rgba(255,255,255,0.22)',
      '--border-strong': 'rgba(255,255,255,0.36)',
      '--divider': 'rgba(255,255,255,0.16)',
      '--hover-bg': 'rgba(255,255,255,0.12)',
      '--hover-bg-strong': 'rgba(255,255,255,0.2)',
      '--active-bg': 'rgba(255,255,255,0.14)',
      '--input-bg': 'rgba(20,20,20,0.6)',
      '--editor-code-color': '#f0a13a',
      // 设置面板/图片预览挂在全屏遮罩上,遮罩须和文字反色才读得清
      '--overlay-bg': 'rgba(0,0,0,0.45)'
    }
  }
  return {
    '--text-primary': '#1f1d19',
    '--text-secondary': 'rgba(31,29,25,0.74)',
    '--label-color': 'rgba(31,29,25,0.6)',
    '--editor-heading-color': '#1f1d19',
    '--border': 'rgba(0,0,0,0.18)',
    '--border-strong': 'rgba(0,0,0,0.3)',
    '--divider': 'rgba(0,0,0,0.12)',
    '--hover-bg': 'rgba(0,0,0,0.08)',
    '--hover-bg-strong': 'rgba(0,0,0,0.14)',
    '--active-bg': 'rgba(0,0,0,0.1)',
    '--input-bg': 'rgba(255,255,255,0.72)',
    '--editor-code-color': '#a04a12',
    '--overlay-bg': 'rgba(245,242,235,0.55)'
  }
}

/**
 * 半透明卡片/工具栏底色:由当前主题调色板派生,保留风格包观感。
 * opacity 是内容卡的百分比(0-100),栏位比卡片再透 0.06/0.08,维持层次。
 */
export function wallpaperSurfaceVars(
  bgCard: string,
  bgBar: string,
  bgToolbar: string,
  opacity = 78
) {
  const card = clampInt(String(opacity), 78, 0, 100) / 100
  return {
    '--bg-card': hexToRgba(bgCard, card),
    '--bg-bar': hexToRgba(bgBar, Math.max(0, card - 0.06)),
    '--bg-toolbar': hexToRgba(bgToolbar, Math.max(0, card - 0.08))
  }
}
