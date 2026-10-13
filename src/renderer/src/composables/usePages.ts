import { ref, shallowRef, type Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import { history } from '@tiptap/pm/history'
import type { Page } from '../../types'

/** 页数上限默认值;实际值由设置 maxPages 驱动(3~30),导入备份也按它截断 */
export const MAX_PAGES = 10

// 清空撤销栈用:prosemirror-history 的 apply 约定,事务 meta 携带
// { historyState } 时会用它整体替换插件状态 —— 这是它给外部留的重置口子。
// 这里借 history() 插件的 init 取一份全新的空状态(Branch 不可变,可安全复用)。
const emptyHistoryPlugin = history({ depth: 100, newGroupDelay: 500 })
// Plugin 的 .key(即 "history$")是 meta 的查找键;类型上未声明,运行时读取
const HISTORY_META_KEY = (emptyHistoryPlugin as unknown as { key: string }).key
const emptyHistoryInit = emptyHistoryPlugin.spec.state?.init as (() => unknown) | undefined
const EMPTY_HISTORY_STATE = emptyHistoryInit?.()

/**
 * 切页用 setContent 换整篇内容,这个事务会被记进撤销栈 ——
 * 不清掉的话,在新页面按 Ctrl+Z 会把上一个页面的内容"撤销"出来,
 * 自动保存随后把它写进当前页面,造成跨页数据错乱。
 */
function resetEditorHistory(editor: Editor): void {
  if (EMPTY_HISTORY_STATE === undefined) return
  editor.view.dispatch(
    editor.state.tr.setMeta(HISTORY_META_KEY, { historyState: EMPTY_HISTORY_STATE })
  )
}

export function usePages(
  editor: Ref<Editor | undefined>,
  scheduleSave: () => void,
  flushSave: () => void | Promise<void>,
  getScrollEl: () => HTMLElement | null,
  getMaxPages: () => number = () => MAX_PAGES
) {
  const pages = ref<Page[]>([]) as Ref<Page[]>
  const currentIndex = ref(-1)
  // 每页记住自己上次的滚动位置:离开时存,切回来恢复;没访问过的页从顶部开始
  const scrollPositions = new Map<number, number>()
  // 最近一次删除的页(id + 标题快照),供撤销 toast 显示;10 分钟后端会清暂存
  const lastDeleted = shallowRef<{ id: number; title: string } | null>(null)
  let isSwitching = false
  let rafId = 0

  function currentPage(): Page | null {
    if (currentIndex.value < 0 || currentIndex.value >= pages.value.length) return null
    return pages.value[currentIndex.value]
  }

  async function loadPages() {
    pages.value = await window.api.getPages()
    if (pages.value.length > 0) {
      selectPage(Math.min(currentIndex.value >= 0 ? currentIndex.value : 0, pages.value.length - 1))
    }
  }

  function selectPage(index: number) {
    if (index < 0 || index >= pages.value.length) return
    if (index === currentIndex.value) return
    // 离开前把滚动位置记到即将离开的页面上
    const leaving = currentPage()
    const scrollEl = getScrollEl()
    if (scrollEl && leaving) scrollPositions.set(leaving.id, scrollEl.scrollTop)
    flushSave()
    isSwitching = true
    currentIndex.value = index
    if (editor.value) {
      editor.value.commands.setContent(pages.value[index].content || '')
      resetEditorHistory(editor.value)
      // focus() 不带参数会把光标放到文档末尾,ProseMirror 随之滚动到最后一行 ——
      // 先统一落到开头,随后再恢复目标页记忆的滚动位置
      editor.value.commands.focus('start')
    }
    // 恢复目标页的滚动位置;没记录过(首次切到)就在顶部
    const target = pages.value[index]
    // Use requestAnimationFrame to reset switching flag after DOM update
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      isSwitching = false
      const el = getScrollEl()
      if (el) el.scrollTop = scrollPositions.get(target.id) ?? 0
    })
  }

  function getIsSwitching() {
    return isSwitching
  }

  async function addPage() {
    if (pages.value.length >= getMaxPages()) return
    try {
      const result = await window.api.addPage()
      if (!result || !Array.isArray(result)) return
      pages.value = result
      selectPage(pages.value.length - 1)
    } catch (e) {
      console.error('[Notchpad] addPage error:', e)
    }
  }

  async function deletePage() {
    if (currentIndex.value < 0) return
    const page = currentPage()
    if (!page) return
    // 先落库防抖窗口内的编辑,软删除快照才是最新内容
    await flushSave()
    // 返回 false(删除失败)时本地列表不动
    const deleted = await window.api.deletePage(page.id)
    if (!deleted) return
    lastDeleted.value = { id: page.id, title: getPageTitle(page) }
    scrollPositions.delete(page.id)
    pages.value.splice(currentIndex.value, 1)
    if (pages.value.length > 0) {
      const next = Math.min(currentIndex.value, pages.value.length - 1)
      currentIndex.value = -1
      selectPage(next)
    } else {
      currentIndex.value = -1
      editor.value?.commands.setContent('')
    }
  }

  /** 撤销最近一次删除:后端把暂存页移回,本地重建视图 */
  async function undoDelete() {
    const deleted = lastDeleted.value
    if (!deleted) return
    lastDeleted.value = null
    const restored = await window.api.restoreDeletedPage(deleted.id)
    if (!restored) return
    pages.value = await window.api.getPages()
    const idx = pages.value.findIndex((p: Page) => p.id === restored.id)
    if (idx >= 0) {
      // 清掉当前索引:恢复页常与自动选中的下一页同索引,
      // 不重置的话 selectPage 的同索引守卫会跳过加载,
      // 编辑器停留在下一页内容上,后续自动保存还会把它写进恢复页的行
      currentIndex.value = -1
      selectPage(idx)
    }
  }

  function getPageTitle(page: Page): string {
    if (page.title) return page.title
    const text = (page.content || '').replace(/<[^>]+>/g, '').trim()
    return text ? `「${text.slice(0, 8)}」` : '空白页'
  }

  async function clearCurrentPage() {
    if (!editor.value) return
    editor.value.commands.setContent('')
    scheduleSave()
  }

  async function reorderPages(fromIndex: number, toIndex: number) {
    const arr = [...pages.value]
    const [moved] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, moved)
    pages.value = arr
    if (currentIndex.value === fromIndex) {
      currentIndex.value = toIndex
    } else if (fromIndex < currentIndex.value && toIndex >= currentIndex.value) {
      currentIndex.value--
    } else if (fromIndex > currentIndex.value && toIndex <= currentIndex.value) {
      currentIndex.value++
    }
    await window.api.reorderPages(arr.map((p) => p.id))
  }

  async function togglePinPage(id: number) {
    // 置顶会按数据库内容重置编辑器,先把防抖窗口内未落库的编辑写掉
    await flushSave()
    const oldPageId = currentPage()?.id
    const updatedPages = await window.api.togglePinPage(id)
    pages.value = updatedPages
    if (oldPageId != null) {
      const newIdx = updatedPages.findIndex((p: Page) => p.id === oldPageId)
      if (newIdx >= 0) {
        currentIndex.value = newIdx
        editor.value?.commands.setContent(updatedPages[newIdx].content || '', { emitUpdate: false })
      }
    } else if (updatedPages.length > 0) {
      selectPage(0)
    } else {
      currentIndex.value = -1
      editor.value?.commands.setContent('')
    }
  }

  return {
    pages,
    currentIndex,
    currentPage,
    lastDeleted,
    loadPages,
    selectPage,
    addPage,
    deletePage,
    undoDelete,
    clearCurrentPage,
    reorderPages,
    togglePinPage,
    getIsSwitching
  }
}
