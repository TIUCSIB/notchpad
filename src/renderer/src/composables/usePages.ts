import { ref, type Ref } from 'vue'
import type { Page } from '../../types'

export const MAX_PAGES = 10

export function usePages(
  editor: Ref<any>,
  scheduleSave: () => void,
  flushSave: () => void
) {
  const pages = ref<Page[]>([]) as Ref<Page[]>
  const currentIndex = ref(-1)
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
    flushSave()
    isSwitching = true
    currentIndex.value = index
    if (editor.value) {
      editor.value.commands.setContent(pages.value[index].content || '')
      editor.value.commands.focus()
    }
    // Use requestAnimationFrame to reset switching flag after DOM update
    if (rafId) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => { isSwitching = false })
  }

  function getIsSwitching() { return isSwitching }

  async function addPage() {
    if (pages.value.length >= MAX_PAGES) return
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
    await window.api.deletePage(page.id)
    pages.value.splice(currentIndex.value, 1)
    if (pages.value.length > 0) {
      selectPage(Math.min(currentIndex.value, pages.value.length - 1))
    } else {
      currentIndex.value = -1
      editor.value?.commands.setContent('')
    }
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
    const updatedPages = await window.api.togglePinPage(id)
    pages.value = updatedPages
    const current = currentPage()
    if (current) {
      const newIdx = updatedPages.findIndex((p: Page) => p.id === current.id)
      if (newIdx >= 0) currentIndex.value = newIdx
    } else if (updatedPages.length > 0) {
      currentIndex.value = 0
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
    loadPages,
    selectPage,
    addPage,
    deletePage,
    clearCurrentPage,
    reorderPages,
    togglePinPage,
    getIsSwitching
  }
}
