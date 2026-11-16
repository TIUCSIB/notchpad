import { describe, expect, it } from 'vitest'
import { getSlashQuery, filterSlashItems, type SlashItem } from '../extensions/slashMenu'

describe('getSlashQuery', () => {
  it('斜杠在文本开头时触发,查询词为空', () => {
    expect(getSlashQuery('/')).toEqual({ query: '', slashOffset: 0 })
    expect(getSlashQuery('/he')).toEqual({ query: 'he', slashOffset: 0 })
  })

  it('斜杠在空白之后时触发', () => {
    expect(getSlashQuery('hello /')).toEqual({ query: '', slashOffset: 6 })
    expect(getSlashQuery('你好 /标题')).toEqual({ query: '标题', slashOffset: 3 })
  })

  it('词中斜杠不触发(如 a/b、http://)', () => {
    expect(getSlashQuery('a/b')).toBeNull()
    expect(getSlashQuery('https://example.com')).toBeNull()
    expect(getSlashQuery('路径/名字')).toBeNull()
  })

  it('查询词中含空格不触发(suggestion 只匹配到词尾)', () => {
    expect(getSlashQuery('/a b')).toBeNull()
  })

  it('slashOffset 指向斜杠本身,便于推导删除范围', () => {
    const { slashOffset } = getSlashQuery('abc /xyz')!
    // 文本[slashOffset] 应该正好是斜杠
    expect('abc /xyz'[slashOffset]).toBe('/')
  })
})

describe('filterSlashItems', () => {
  const items: SlashItem[] = [
    { title: '标题 1', keywords: ['h1', 'heading'], icon: {} as never, command: () => {} },
    {
      title: '无序列表',
      description: '圆点列表',
      keywords: ['ul'],
      icon: {} as never,
      command: () => {}
    },
    { title: '任务列表', keywords: ['todo'], icon: {} as never, command: () => {} }
  ]

  it('空查询返回全部', () => {
    expect(filterSlashItems(items, '')).toHaveLength(3)
    expect(filterSlashItems(items, '  ')).toHaveLength(3)
  })

  it('按标题/描述/关键词匹配,大小写不敏感', () => {
    expect(filterSlashItems(items, 'h1')).toHaveLength(1)
    expect(filterSlashItems(items, 'H1')).toHaveLength(1)
    expect(filterSlashItems(items, '标题')).toHaveLength(1)
    expect(filterSlashItems(items, '圆点')).toHaveLength(1)
    expect(filterSlashItems(items, 'TODO')).toHaveLength(1)
  })

  it('无匹配返回空数组', () => {
    expect(filterSlashItems(items, 'zzz')).toHaveLength(0)
  })
})
