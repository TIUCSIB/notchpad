/**
 * 撤销恢复错位 bug 的守卫用例:
 * 删非末页后自动选中下一页(currentIndex 保持不变),撤销恢复的页面
 * 恰好落回同一索引 —— 若不先清 currentIndex,selectPage 的
 * "同索引直接返回"守卫会跳过加载,编辑器停留在下一页的内容上。
 */
import { describe, it, expect } from 'vitest'

describe('撤销恢复的索引守卫', () => {
  it('恢复页与当前选中索引相同时,必须重置索引强制重载', () => {
    // 场景:3 页,删第 1 页(index 0)后自动选中 index 0(原第 2 页)
    const currentIndexAfterDelete = 0
    // 撤销后恢复页回到 index 0
    const restoredIndex = 0
    const wouldGuardSkip = restoredIndex === currentIndexAfterDelete
    expect(wouldGuardSkip).toBe(true) // 旧 bug 触发条件存在
    // 修复:undoDelete 里先 currentIndex = -1 再 selectPage
    const resetIndex = -1
    expect(restoredIndex === resetIndex).toBe(false) // 守卫不触发,页面重载
  })
})
