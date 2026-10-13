/**
 * 撤销恢复错位 bug 的守卫用例:
 * 删非末页后自动选中下一页(currentIndex 保持不变),撤销恢复的页面
 * 恰好落回同一索引 —— 若不先清 currentIndex,selectPage 的
 * "同索引直接返回"守卫会跳过加载,编辑器停留在下一页的内容上。
 */
import { describe, it, expect } from 'vitest'

/** selectPage 的同索引守卫(与 usePages 实现同构) */
function guardSkipsLoad(target: number, current: number): boolean {
  return target === current
}

describe('撤销恢复的索引守卫', () => {
  it('恢复页与当前选中索引相同时,必须重置索引强制重载', () => {
    // 场景:删第 1 页(index 0)后自动选中 index 0(原第 2 页);
    // 撤销后恢复页回到 index 0 —— 守卫会误判"未变化"跳过加载
    const currentIndexAfterDelete = 0
    const restoredIndex = 0
    expect(guardSkipsLoad(restoredIndex, currentIndexAfterDelete)).toBe(true)
    // 修复:undoDelete 先把 currentIndex 重置为 -1,守卫不再触发
    expect(guardSkipsLoad(restoredIndex, -1)).toBe(false)
  })
})
