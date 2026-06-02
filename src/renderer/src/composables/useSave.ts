import { ref, type Ref } from 'vue'
import type { Page } from '../../types'

export function useSave(
  editor: Ref<any>,
  pages: Ref<Page[]>,
  currentIndex: Ref<number>
) {
  const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let savedStatusTimer: ReturnType<typeof setTimeout> | null = null

  async function saveCurrentPage(silent = false) {
    try {
      const idx = currentIndex.value
      const page = idx >= 0 && idx < pages.value.length ? pages.value[idx] : null
      if (!page || !editor.value) return
      const updated = await window.api.updatePage(page.id, '', editor.value.getHTML())
      if (updated) pages.value[idx] = updated
      if (!silent) { saveStatus.value = 'saved' }
      if (savedStatusTimer) clearTimeout(savedStatusTimer)
      savedStatusTimer = setTimeout(() => {
        if (saveStatus.value === 'saved') saveStatus.value = 'idle'
      }, 2000)
    } catch (e) {
      console.error('[Notchpad] saveCurrentPage error:', e)
    }
  }

  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    saveCurrentPage(true)
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveStatus.value = 'saving'
    saveTimer = setTimeout(saveCurrentPage, 600)
  }

  function cleanup() {
    if (saveTimer) clearTimeout(saveTimer)
    if (savedStatusTimer) clearTimeout(savedStatusTimer)
  }

  return { saveStatus, saveCurrentPage, flushSave, scheduleSave, cleanup }
}
