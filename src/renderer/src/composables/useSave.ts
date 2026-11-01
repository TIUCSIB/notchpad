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
  // failed = 落库失败(磁盘满/库损坏),红点提示用户内容尚未写进数据库
  const saveStatus = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let savedStatusTimer: ReturnType<typeof setTimeout> | null = null
  // 保存代际计数:防抖保存与 flush 保存可能并发在途,后完成的旧内容会覆盖
  // 新内容(丢最后一次编辑)。每次发起保存 +1,只接受代际最新的结果落基线
  let saveGeneration = 0

  async function saveCurrentPage(silent = false) {
    const generation = ++saveGeneration
    try {
      const idx = getCurrentIndex()
      const list = getPages()
      const page = idx >= 0 && idx < list.length ? list[idx] : null
      if (!page || !editor.value) return
      const html = editor.value.getHTML()
      // 跳过条件用该页自己已保存的内容(list[idx] 每次保存成功都会被 updated
      // 原位替换)作基线。不能用全局单例:跨页共享时,新页面编辑出的 HTML
      // 恰好等于上一页的基线会误判"未变化"而跳过保存,重启后内容回退
      if (html === page.content) {
        // Clear "saving" indicator without showing "saved"
        if (saveStatus.value === 'saving') saveStatus.value = 'idle'
        return
      }
      const updated = await window.api.updatePage(page.id, html)
      if (generation !== saveGeneration) {
        // 已有更新的保存发起:本次是过期结果,不回写基线也不改状态
        // (数据库里仍是最新一次写入的结果,只是返回顺序颠倒)
        return
      }
      if (updated) {
        // 直接改 ref 里的那个数组,页面列表会同步更新;
        // updated.content 即该页新的已保存基线
        list[idx] = updated
      } else {
        // 后端写库失败(磁盘满/库损坏):显示失败态,红点提示内容未落库;
        // 下次编辑触发新的 scheduleSave 会自然重试
        saveStatus.value = 'failed'
        console.error('[Notchpad] updatePage 返回空,保存失败:', page.id)
        return
      }
      if (!silent) {
        saveStatus.value = 'saved'
      }
      if (savedStatusTimer) clearTimeout(savedStatusTimer)
      savedStatusTimer = setTimeout(() => {
        if (saveStatus.value === 'saved') saveStatus.value = 'idle'
      }, 2000)
    } catch (e) {
      if (generation === saveGeneration) {
        saveStatus.value = 'failed'
      }
      console.error('[Notchpad] saveCurrentPage error:', e)
    }
  }

  // 返回保存 promise:置顶/导出这类会读取数据库内容的操作要先等它落库,
  // 否则防抖窗口内未保存的编辑会被覆盖或漏出
  function flushSave(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    return saveCurrentPage(false)
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
