import { describe, it, expect } from 'vitest'
import { extractPageTitle, pageDisplayTitle, unnamedTitle } from '../utils/pageTitle'

describe('页面标题推导', () => {
  it('取第一个一级标题作为标题', () => {
    expect(extractPageTitle('<p>开头</p><h1>Notch Note 更新</h1><p>正文</p>')).toBe(
      'Notch Note 更新'
    )
  })

  it('多个一级标题时只取第一个有文字的', () => {
    expect(extractPageTitle('<h1>第一个</h1><h1>第二个</h1>')).toBe('第一个')
    expect(extractPageTitle('<h1>  </h1><h1>真标题</h1>')).toBe('真标题')
  })

  it('去掉标题里的行内标记并解码实体', () => {
    expect(extractPageTitle('<h1><strong>A &amp; B</strong></h1>')).toBe('A & B')
  })

  it('压缩标题内的连续空白', () => {
    expect(extractPageTitle('<h1>  开 发\n  日 记  </h1>')).toBe('开 发 日 记')
  })

  it('只认一级标题,二级/三级标题不算', () => {
    expect(extractPageTitle('<h2>小节</h2><h3>更小</h3>')).toBe('')
  })

  it('没有内容或没有标题时返回空串', () => {
    expect(extractPageTitle('')).toBe('')
    expect(extractPageTitle(null)).toBe('')
    expect(extractPageTitle('<p>只有正文</p>')).toBe('')
  })

  it('无名页按序号命名', () => {
    expect(unnamedTitle(0)).toBe('未命名1')
    expect(unnamedTitle(9)).toBe('未命名10')
  })

  it('pageDisplayTitle 优先正文标题,否则回落到未命名N', () => {
    expect(pageDisplayTitle({ content: '<h1>待办</h1>' }, 2)).toBe('待办')
    expect(pageDisplayTitle({ content: '<p>正文</p>' }, 2)).toBe('未命名3')
    expect(pageDisplayTitle({ content: '' }, 0)).toBe('未命名1')
  })
})
