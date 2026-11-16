import { describe, it, expect } from 'vitest'
import {
  hexToRgba,
  clampInt,
  resolveWallpaperText,
  wallpaperVars,
  wallpaperSurfaceVars
} from '../utils/wallpaper'

describe('壁纸颜色与明暗', () => {
  it('hexToRgba 转换颜色并裁剪 alpha', () => {
    expect(hexToRgba('#c96a5c', 0.3)).toBe('rgba(201, 106, 92, 0.3)')
    expect(hexToRgba('f4f0e4', 2)).toBe('rgba(244, 240, 228, 1)')
    expect(hexToRgba('#000', 0.5)).toBe('#000') // 非 6 位不解析,原样返回
  })

  it('clampInt 处理空值、非法值与越界值', () => {
    expect(clampInt(undefined, 25, 0, 80)).toBe(25)
    expect(clampInt('abc', 25, 0, 80)).toBe(25)
    expect(clampInt('40', 25, 0, 80)).toBe(40)
    expect(clampInt('999', 25, 0, 80)).toBe(80)
    expect(clampInt('-5', 25, 0, 80)).toBe(0)
  })

  it('auto 文字色跟随壁纸明暗,手动可强制覆盖', () => {
    expect(resolveWallpaperText('dark', 'auto')).toBe('light')
    expect(resolveWallpaperText('light', 'auto')).toBe('dark')
    expect(resolveWallpaperText('dark', 'dark')).toBe('dark')
    expect(resolveWallpaperText('light', 'light')).toBe('light')
  })

  it('浅字与深字各覆盖关键变量,且互为反色', () => {
    const light = wallpaperVars('light')
    const dark = wallpaperVars('dark')
    expect(light['--text-primary']).toBe('#f7f4ee')
    expect(dark['--text-primary']).toBe('#1f1d19')
    expect(light['--input-bg']).toContain('rgba(20,20,20')
    expect(dark['--input-bg']).toContain('rgba(255,255,255')
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort())
  })

  it('半透明表面由主题调色板派生,默认不透明度 78', () => {
    expect(wallpaperSurfaceVars('#eee9da', '#eae5d6', '#e3ddcc')).toEqual({
      '--bg-card': 'rgba(238, 233, 218, 0.78)',
      '--bg-bar': 'rgba(234, 229, 214, 0.72)',
      '--bg-toolbar': 'rgba(227, 221, 204, 0.7)'
    })
  })

  it('内容区透明度可调,栏位比卡片再透一档', () => {
    const vars = wallpaperSurfaceVars('#eee9da', '#eae5d6', '#e3ddcc', 50)
    expect(vars['--bg-card']).toBe('rgba(238, 233, 218, 0.5)')
    expect(vars['--bg-bar']).toBe('rgba(234, 229, 214, 0.44)')
    expect(vars['--bg-toolbar']).toBe('rgba(227, 221, 204, 0.42)')
    // 完全不透明时栏位被夹到 0,不会出现负数 alpha
    const solid = wallpaperSurfaceVars('#eee9da', '#eae5d6', '#e3ddcc', 100)
    expect(solid['--bg-card']).toBe('rgba(238, 233, 218, 1)')
  })
})
