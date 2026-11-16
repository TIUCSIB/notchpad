import { describe, it, expect } from 'vitest'
import { fontFamilyStack, SYSTEM_FONT_STACK, FALLBACK_FONT_OPTIONS } from '../utils/fonts'

describe('全局默认字体', () => {
  it('空字体名回落到系统默认栈', () => {
    expect(fontFamilyStack('')).toBe(SYSTEM_FONT_STACK)
    expect(fontFamilyStack('   ')).toBe(SYSTEM_FONT_STACK)
  })

  it('带空格的字体名加引号并保留系统 fallback', () => {
    expect(fontFamilyStack('Microsoft YaHei')).toBe(`"Microsoft YaHei", ${SYSTEM_FONT_STACK}`)
    expect(fontFamilyStack('Source Han Serif SC')).toBe(
      `"Source Han Serif SC", ${SYSTEM_FONT_STACK}`
    )
  })

  it('清洗可能破坏 CSS 声明的字符', () => {
    expect(fontFamilyStack('Arial"; color:red')).toBe(`"Arial color:red", ${SYSTEM_FONT_STACK}`)
  })

  it('回落预设包含常用中英文字体', () => {
    expect(FALLBACK_FONT_OPTIONS).toContain('Microsoft YaHei')
    expect(FALLBACK_FONT_OPTIONS).toContain('SimSun')
    expect(FALLBACK_FONT_OPTIONS).toContain('Georgia')
  })
})
