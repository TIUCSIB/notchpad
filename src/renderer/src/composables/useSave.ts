import { ref, type Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'
import type { Page } from '../../types'

/**
 * 自动保存。
 *
 * 页面数据用 getter 传入而不是直接传 ref —— useSave 必须先于 usePages 创建
 * (usePages 反过来要依赖这里的 scheduleSave / flushSave),getter 既能打破这个循环,
 * 也省掉了调用方在中间抄一份镜像状态再 watch 同步的做法。
 */
export function useSave(
  editor: Ref<Editor | undefined>,
  getPages: () => Page[],
  getCurrentIndex: () => number
) {
  const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let savedStatusTimer: ReturnType<typeof setTimeout> | null = null
  let lastSavedHtml = ''

  async function saveCurrentPage(silent = false) {
    try {
      const idx = getCurrentIndex()
      const list = getPages()
      const page = idx >= 0 && idx < list.length ? list[idx] : null
      if (!page || !editor.value) return
      const html = editor.value.getHTML()
      // Skip save if content hasn't changed
      if (html === lastSavedHtml) {
        // Clear "saving" indicator without showing "saved"
        if (saveStatus.value === 'saving') saveStatus.value = 'idle'
        return
      }
      const updated = await window.api.updatePage(page.id, html)
      if (updated) {
        // 直接改 ref 里的那个数组,页面列表会同步更新
        list[idx] = updated
        lastSavedHtml = html
      }
      if (!silent) {
        saveStatus.value = 'saved'
      }
      if (savedStatusTimer) clearTimeout(savedStatusTimer)
      savedStatusTimer = setTimeout(() => {
        if (saveStatus.value === 'saved') saveStatus.value = 'idle'
      }, 2000)
    } catch (e) {
      console.error('[Notchpad] saveCurrentPage error:', e)
    }
  }

  function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    saveCurrentPage(false)
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
