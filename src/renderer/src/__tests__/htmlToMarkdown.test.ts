import { describe, it, expect } from 'vitest'
import { htmlToMarkdown } from '../utils/dataConverter'

describe('htmlToMarkdown', () => {
  it('转换基础文本结构', () => {
    expect(htmlToMarkdown('<h1>标题</h1><p>正文</p>')).toContain('# 标题')
    expect(htmlToMarkdown('<strong>粗</strong><em>斜</em>')).toContain('**粗**')
  })

  it('任务列表按 checkbox 状态输出 - [ ] / - [x]', () => {
    const html =
      '<ul data-type="taskList"><li data-checked="true"><input type="checkbox" checked="checked"><span>已完成</span></li>' +
      '<li><input type="checkbox"><span>未完成</span></li></ul>'
    const md = htmlToMarkdown(html)
    expect(md).toContain('- [x] 已完成')
    expect(md).toContain('- [ ] 未完成')
  })

  it('普通列表保持 - 前缀', () => {
    expect(htmlToMarkdown('<ul><li>项目</li></ul>')).toContain('- 项目')
  })

  it('有序列表带序号', () => {
    const md = htmlToMarkdown('<ol><li>一</li><li>二</li></ol>')
    expect(md).toContain('1. 一')
    expect(md).toContain('2. 二')
  })

  it('图片输出 markdown 图语法', () => {
    expect(htmlToMarkdown('<img src="x.jpg" alt="图">')).toContain('![图](x.jpg)')
  })
})
