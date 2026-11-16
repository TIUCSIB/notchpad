/**
 * 主题风格包。
 *
 * 一层是模式(浅色/深色),另一层是风格(preset):每个 preset 同时提供
 * 浅色与深色调色板,以及可选的标题字体、纸纹、h1 朱砂短线。
 * 强调色不放在 palette 里 —— 用户可以独立选色,preset 只给一个推荐值。
 */

export type ThemeMode = 'light' | 'dark'
export type ThemeId = 'default' | 'eye' | 'warm' | 'ink'

export interface ThemePalette {
  bgMain: string
  bgCard: string
  bgBar: string
  bgToolbar: string
  textPrimary: string
  textSecondary: string
  border: string
  borderStrong: string
  hoverBg: string
  hoverBgStrong: string
  inputBg: string
  overlayBg: string
  labelColor: string
  activeBg: string
  divider: string
}

export interface ThemePreset {
  id: ThemeId
  name: string
  description: string
  /** 选中风格包时推荐的强调色,按模式各给一个 */
  defaultAccent: Record<ThemeMode, string>
  light: ThemePalette
  dark: ThemePalette
  /** 标题字体栈(水墨用宋体) */
  headingFont?: string
  /** 是否在面板与内容卡上铺一层极淡的纸纹 */
  paperGrain?: boolean
  /** 是否给 h1 加一条朱砂短线 */
  h1Rule?: boolean
}

const SERIF_STACK =
  '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", NSimSun, SimSun, serif'

/**
 * 极淡的纸纹。用 SVG 噪点而不是大图,平铺也不占资源;
 * encodeURIComponent 会把 filter 里的 # 正确转义。
 * 浅色纸纹稍明显(宣纸颗粒),深色更克制。
 */
function grainSvg(opacity: number) {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='160' height='160' filter='url(#n)' opacity='${opacity}'/></svg>`
}
const PAPER_GRAIN = {
  light: `url("data:image/svg+xml;utf8,${encodeURIComponent(grainSvg(0.07))}")`,
  dark: `url("data:image/svg+xml;utf8,${encodeURIComponent(grainSvg(0.035))}")`
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: '默认',
    description: '暖白 · 极简',
    defaultAccent: { light: '#4ade80', dark: '#4ade80' },
    light: {
      bgMain: '#faf6f0',
      bgCard: '#f5f0e8',
      bgBar: '#ede8df',
      bgToolbar: '#e5dfd4',
      textPrimary: '#3d3629',
      textSecondary: '#666',
      border: '#ddd',
      borderStrong: '#ccc',
      hoverBg: '#d9d3c6',
      hoverBgStrong: '#ccc5b8',
      inputBg: '#fff',
      overlayBg: 'rgba(0,0,0,0.3)',
      labelColor: '#888',
      activeBg: '#d1cbbf',
      divider: '#ddd'
    },
    dark: {
      bgMain: '#000',
      bgCard: '#0f1014',
      bgBar: '#1a1a1a',
      bgToolbar: '#151516',
      textPrimary: '#e5e5e5',
      textSecondary: '#888',
      border: '#2a2a2c',
      borderStrong: '#3a3a3c',
      hoverBg: '#3a3a3a',
      hoverBgStrong: '#4a4a4a',
      inputBg: '#1e1e1e',
      overlayBg: 'rgba(0,0,0,0.4)',
      labelColor: '#aaa',
      activeBg: '#3a3a3c',
      divider: '#2a2a2c'
    }
  },
  {
    id: 'eye',
    name: '护眼',
    description: '绿豆沙 · 低刺激',
    defaultAccent: { light: '#4a8f6a', dark: '#6fbf8f' },
    light: {
      bgMain: '#f2f7ee',
      bgCard: '#e9f2e5',
      bgBar: '#e3ede0',
      bgToolbar: '#dbe8d8',
      textPrimary: '#2f3b32',
      textSecondary: '#5f6f60',
      border: '#d3e0d0',
      borderStrong: '#bfd1bb',
      hoverBg: '#d5e6d0',
      hoverBgStrong: '#c3d9bd',
      inputBg: '#ffffff',
      overlayBg: 'rgba(20,40,25,0.3)',
      labelColor: '#6e7f6f',
      activeBg: '#cbe0c5',
      divider: '#d3e0d0'
    },
    dark: {
      bgMain: '#101512',
      bgCard: '#171e18',
      bgBar: '#141a15',
      bgToolbar: '#1b231d',
      textPrimary: '#d6e0d4',
      textSecondary: '#8a9a8b',
      border: '#26332a',
      borderStrong: '#35463a',
      hoverBg: '#223026',
      hoverBgStrong: '#2b3c30',
      inputBg: '#1c241e',
      overlayBg: 'rgba(0,0,0,0.45)',
      labelColor: '#9aaa9b',
      activeBg: '#263a2c',
      divider: '#26332a'
    }
  },
  {
    id: 'warm',
    name: '暖纸',
    description: '米黄 · 低蓝光',
    defaultAccent: { light: '#a0522d', dark: '#d08a4a' },
    light: {
      bgMain: '#f6efe1',
      bgCard: '#f0e6d2',
      bgBar: '#ece2cd',
      bgToolbar: '#e5d9c2',
      textPrimary: '#3b3328',
      textSecondary: '#6b5f4e',
      border: '#ddd0b8',
      borderStrong: '#cbbda3',
      hoverBg: '#e3d6bf',
      hoverBgStrong: '#d3c4a9',
      inputBg: '#fffaf0',
      overlayBg: 'rgba(40,30,15,0.3)',
      labelColor: '#8a7a62',
      activeBg: '#dccdb3',
      divider: '#ddd0b8'
    },
    dark: {
      bgMain: '#191512',
      bgCard: '#221c17',
      bgBar: '#1d1813',
      bgToolbar: '#261f19',
      textPrimary: '#e6dccb',
      textSecondary: '#a2937f',
      border: '#352c22',
      borderStrong: '#4a3d2f',
      hoverBg: '#2e261e',
      hoverBgStrong: '#3b3127',
      inputBg: '#251e18',
      overlayBg: 'rgba(0,0,0,0.45)',
      labelColor: '#b3a38d',
      activeBg: '#3a2e22',
      divider: '#352c22'
    }
  },
  {
    id: 'ink',
    name: '水墨',
    description: '宣纸 · 宋体标题',
    defaultAccent: { light: '#9e3d32', dark: '#c96a5c' },
    headingFont: SERIF_STACK,
    paperGrain: true,
    h1Rule: true,
    light: {
      bgMain: '#f4f0e4',
      bgCard: '#eee9da',
      bgBar: '#eae5d6',
      bgToolbar: '#e3ddcc',
      textPrimary: '#23211d',
      textSecondary: '#6a665e',
      border: '#d3ccbb',
      borderStrong: '#bdb5a2',
      hoverBg: '#e6dfce',
      hoverBgStrong: '#d6cdb8',
      inputBg: '#faf7ec',
      overlayBg: 'rgba(0,0,0,0.28)',
      labelColor: '#827c70',
      activeBg: '#ded6c2',
      divider: '#d3ccbb'
    },
    dark: {
      bgMain: '#121212',
      bgCard: '#1a1a18',
      bgBar: '#171715',
      bgToolbar: '#20201d',
      textPrimary: '#d9d5ca',
      textSecondary: '#8e8a80',
      border: '#2c2b27',
      borderStrong: '#3d3c36',
      hoverBg: '#252420',
      hoverBgStrong: '#302f2a',
      inputBg: '#1f1f1c',
      overlayBg: 'rgba(0,0,0,0.5)',
      labelColor: '#9c978c',
      activeBg: '#2e2d28',
      divider: '#2c2b27'
    }
  }
]

export function getTheme(id: string | undefined): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0]
}

/** 把一个风格包 + 模式 + 强调色展开成 CSS 变量 */
export function themeVars(
  theme: ThemePreset,
  mode: ThemeMode,
  accent: string
): Record<string, string> {
  const p = theme[mode]
  return {
    '--accent': accent,
    '--accent-dim': accent + '20',
    // 浅色模式不需要描边,胶囊底色已经够清楚
    '--accent-border': mode === 'dark' ? accent + '66' : 'transparent',
    '--bg-main': p.bgMain,
    '--bg-card': p.bgCard,
    '--bg-bar': p.bgBar,
    '--bg-toolbar': p.bgToolbar,
    '--text-primary': p.textPrimary,
    '--text-secondary': p.textSecondary,
    '--border': p.border,
    '--border-strong': p.borderStrong,
    '--hover-bg': p.hoverBg,
    '--hover-bg-strong': p.hoverBgStrong,
    '--input-bg': p.inputBg,
    '--overlay-bg': p.overlayBg,
    '--label-color': p.labelColor,
    '--active-bg': p.activeBg,
    '--divider': p.divider,
    '--danger-text': '#dc2626',
    '--danger-hover': mode === 'light' ? '#fecaca' : '#3a1a1a',
    '--editor-heading-font': theme.headingFont ?? 'inherit',
    '--editor-heading-color': p.textPrimary,
    // 行内代码:浅色主题用较深的琥珀保证可读,深色用亮琥珀
    '--editor-code-color': mode === 'light' ? '#a04a12' : '#f0a13a',
    '--paper-grain': theme.paperGrain ? PAPER_GRAIN[mode] : 'none'
  }
}
