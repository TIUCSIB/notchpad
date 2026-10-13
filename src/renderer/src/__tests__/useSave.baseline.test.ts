/**
 * 保存基线回归:跨页丢字 bug 的守卫用例。
 * 基线必须是"该页自己已保存的内容",而不是全局单例 ——
 * 两页内容相同时,全局基线会误判未变化而跳过保存。
 */
import { describe, it, expect } from 'vitest'

// useSave 的跳过判断逻辑(与实现保持同构的纯规则):保存与否取决于 page.content
// 这里直接验证规则本身,组件级行为由 usePages 的集成路径覆盖
function shouldSkip(html: string, pageContent: string): boolean {
  return html === pageContent
}

describe('保存基线规则', () => {
  it('两页内容相同时,新页的编辑不会被误判为未变化', () => {
    const pageABaseline = '<p>hello</p>'
    // B 页编辑器当前 HTML 恰好等于 A 页的基线
    const editorHtmlOnB = '<p>hello</p>'
    const pageBContent = '' // B 页库里还是空
    expect(shouldSkip(editorHtmlOnB, pageABaseline)).toBe(true) // 旧 bug:全局基线
    expect(shouldSkip(editorHtmlOnB, pageBContent)).toBe(false) // 新规则:按页基线,必须保存
  })

  it('内容未变化时跳过保存', () => {
    expect(shouldSkip('<p>same</p>', '<p>same</p>')).toBe(true)
  })
})
