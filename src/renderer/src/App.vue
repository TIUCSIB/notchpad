<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import type { Editor } from '@tiptap/vue-3'
import TopToolbar from './components/TopToolbar.vue'
import BottomBar from './components/BottomBar.vue'
import LinkDialog from './components/LinkDialog.vue'
import Settings from './components/Settings.vue'
import { Motion } from 'motion-v'
import { useNotch } from './composables/useNotch'
import { useSettings } from './composables/useSettings'
import { useSave } from './composables/useSave'
import { usePages } from './composables/usePages'
import {
  useEditorSetup,
  fontOptions,
  fontSizeOptions,
  colorOptions,
  highlightColors
} from './composables/useEditorSetup'

const {
  appSettings,
  isLightTheme,
  appStyle,
  initSettingsListeners,
  cleanupSettings,
  loadSettings
} = useSettings()

const linkPromptVisible = ref(false)
const linkUrlInput = ref('')
const settingsVisible = ref(false)
// Editor 内部结构复杂,deep ref 会对它做 UnwrapRef 展开,必须用 shallowRef(Tiptap 官方推荐)
const tempEditor = shallowRef<Editor | undefined>(undefined)
// 各页面共用同一个滚动容器(.content-body),按页面 id 记忆/恢复滚动位置
const contentBodyEl = ref<HTMLDivElement | null>(null)

const {
  saveStatus,
  flushSave,
  scheduleSave,
  cleanup: cleanupSave
} = useSave(
  tempEditor,
  // 用 getter 直接读真实状态,不再需要 pagesRef / currentIndexRef 两份镜像
  () => pages.value,
  () => currentIndex.value
)

const {
  pages,
  currentIndex,
  loadPages,
  selectPage,
  addPage,
  deletePage,
  clearCurrentPage,
  reorderPages,
  togglePinPage,
  getIsSwitching
} = usePages(tempEditor, scheduleSave, flushSave, () => contentBodyEl.value)

const {
  isNotched,
  isAnimating,
  pillHovered,
  panelAnimate,
  panelTransition,
  isLightTheme: notchIsLight,
  appReady,
  warmUpFirstExpand,
  cleanup: cleanupNotch
} = useNotch(pages, settingsVisible, linkPromptVisible)
watch(
  isLightTheme,
  (v) => {
    notchIsLight.value = v
  },
  { immediate: true }
)

const {
  editor,
  formatBtns,
  setFontSize,
  clearFontSize,
  setFontFamily,
  setTextColor,
  setHighlight,
  clearTextColor,
  clearHighlightColor,
  currentFontSize,
  currentFontFamily,
  currentTextColor,
  currentHighlightColor,
  confirmLink
} = useEditorSetup(scheduleSave, getIsSwitching, linkPromptVisible, linkUrlInput)
tempEditor.value = editor.value
watch(editor, (v) => {
  tempEditor.value = v
})

const charCount = computed(() => editor.value?.state.doc.textContent.length ?? 0)

// 药丸的命中尺寸直接把 useNotch 的目标尺寸(72/84 × 14/18)上报主进程。
// 不能用 ResizeObserver 实测 —— 面板收起动画的中间帧会被当成药丸尺寸上报,
// 把主进程的命中区域撑成几百像素宽,表现为"鼠标离开很远面板都收不回去"。
// 展开态尺寸无意义,不上报,主进程沿用上一次的药丸尺寸。
watch(
  [isNotched, pillHovered],
  () => {
    if (!isNotched.value) return
    const width = parseInt(panelAnimate.value.width)
    const height = parseInt(panelAnimate.value.height)
    if (width > 0 && height > 0) window.api.updatePillSize(width, height)
  },
  { immediate: true }
)

function handlePillClick() {
  if (appSettings.value.wakeMode === 'click') window.api.exitNotch()
}
function handleSettingsUpdate(s: Record<string, string>) {
  // _reload 是设置面板用来要求重载页面的信号,不该混进应用设置里
  const { _reload, ...rest } = s
  appSettings.value = rest
  if (_reload) loadPages()
}

async function handleUpdateTitle(id: number, title: string) {
  const updated = await window.api.updatePageTitle(id, title)
  if (updated) {
    const idx = pages.value.findIndex((p) => p.id === id)
    if (idx >= 0) pages.value[idx] = updated
  }
}

function handleKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey
  // 带 Alt 的组合留给系统与全局快捷键处理(例如 Ctrl+Alt+Z 呼出窗口),
  // 否则按下呼出键时还会顺带触发一次本地的撤销
  if (!ctrl || e.altKey) return
  const target = e.target as HTMLElement | null
  const inTextField =
    target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || !!target?.isContentEditable
  switch (e.key.toLowerCase()) {
    case 'n':
      e.preventDefault()
      addPage()
      break
    case 's':
      e.preventDefault()
      flushSave()
      break
    case 'z':
      // 编辑器聚焦时 Tiptap 自己的键位会执行 undo,这里再执行一步就退两格;
      // 焦点在输入框里则交给原生 undo,同时避免抢走焦点
      if (!e.shiftKey && !inTextField && !editor.value?.isFocused) {
        e.preventDefault()
        editor.value?.chain().focus().undo().run()
      }
      break
    case 'y':
      if (!inTextField && !editor.value?.isFocused) {
        e.preventDefault()
        editor.value?.chain().focus().redo().run()
      }
      break
    case 'd':
      e.preventDefault()
      deletePage()
      break
    case 'w':
      e.preventDefault()
      window.api.closeWindow()
      break
    case 'm':
      if (e.shiftKey) {
        e.preventDefault()
        window.api.switchDisplay()
      }
      break
    case 'tab':
      e.preventDefault()
      if (pages.value.length > 0) {
        if (e.shiftKey) {
          selectPage((currentIndex.value - 1 + pages.value.length) % pages.value.length)
        } else {
          selectPage((currentIndex.value + 1) % pages.value.length)
        }
      }
      break
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
      e.preventDefault()
      // const pageNum = parseInt(e.key)
      if (parseInt(e.key) <= pages.value.length) selectPage(parseInt(e.key) - 1)
      break
  }
}

onMounted(async () => {
  await loadSettings()
  initSettingsListeners()
  await loadPages()
  appReady.value = true

  window.api.onNotchChange((v: boolean) => {
    isNotched.value = v
  })
  document.addEventListener('keydown', handleKeydown)

  // 趁窗口还是 opacity 0,把首次展开的冷启动开销静默预热掉;全部就绪后才亮窗
  await warmUpFirstExpand()
  window.api.rendererReady()
})

onBeforeUnmount(() => {
  window.api.offNotchChange()
  editor.value?.destroy()
  cleanupSave()
  cleanupNotch()
  cleanupSettings()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app-root" :style="appStyle">
    <Motion
      :initial="{ opacity: 0, scale: 0.3 }"
      :class="[
        'panel-motion',
        {
          notched: isNotched,
          animating: isAnimating,
          'pill-hovered': pillHovered,
          'click-mode': appSettings.wakeMode === 'click'
        }
      ]"
      :animate="panelAnimate"
      :transition="panelTransition"
      :style="{
        pointerEvents: isNotched && appSettings.wakeMode !== 'click' ? 'none' : 'auto'
      }"
      @mouseenter="pillHovered = true"
      @mouseleave="pillHovered = false"
      @click="handlePillClick"
    >
      <div class="panel">
        <TopToolbar
          :pages="pages"
          :current-index="currentIndex"
          :max-pages="10"
          :is-notched="isNotched"
          @select="selectPage"
          @add="addPage"
          @delete="deletePage"
          @clear="clearCurrentPage"
          @settings="settingsVisible = true"
          @reorder="reorderPages"
          @toggle-pin="togglePinPage"
          @update-title="handleUpdateTitle"
        />

        <div v-show="currentIndex >= 0" class="editor-area">
          <div class="content-card">
            <div ref="contentBodyEl" class="content-body">
              <EditorContent :editor="editor" />
            </div>
            <span class="char-count">{{ charCount }} 字</span>
            <BottomBar
              :format-btns="formatBtns"
              :font-size-options="fontSizeOptions"
              :font-options="fontOptions"
              :color-options="colorOptions"
              :highlight-colors="highlightColors"
              :current-font-size="currentFontSize"
              :current-font-family="currentFontFamily"
              :current-text-color="currentTextColor"
              :current-highlight-color="currentHighlightColor"
              :is-notched="isNotched"
              @set-font-size="setFontSize"
              @clear-font-size="clearFontSize"
              @set-font-family="setFontFamily"
              @set-text-color="setTextColor"
              @clear-text-color="clearTextColor"
              @clear-highlight-color="clearHighlightColor"
              @set-highlight="setHighlight"
              @open-link="linkPromptVisible = true"
            />
          </div>
          <div class="save-status">
            <div class="save-indicator" :class="{ saving: saveStatus === 'saving' }">
              <span class="save-dot saving" /> 保存中
            </div>
            <div class="save-indicator" :class="{ saved: saveStatus === 'saved' }">
              <span class="save-dot saved" /> 已保存
            </div>
          </div>
        </div>
        <div v-show="currentIndex < 0" class="editor-area empty">
          <p class="empty-hint">空白白的~</p>
        </div>
      </div>
    </Motion>
  </div>

  <Settings
    :visible="settingsVisible"
    @close="settingsVisible = false"
    @update-settings="handleSettingsUpdate"
  />
  <LinkDialog
    :visible="linkPromptVisible"
    :initial-url="linkUrlInput"
    @confirm="confirmLink"
    @cancel="linkPromptVisible = false"
  />
</template>

<style src="./App.css" />
