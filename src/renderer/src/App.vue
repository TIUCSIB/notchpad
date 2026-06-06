<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorContent } from '@tiptap/vue-3'
import TopToolbar from './components/TopToolbar.vue'
import BottomBar from './components/BottomBar.vue'
import LinkDialog from './components/LinkDialog.vue'
import Settings from './components/Settings.vue'
import { Motion, AnimatePresence } from 'motion-v'
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
const tempEditor = ref<any>(null)
const pagesRef = ref<any[]>([])
const currentIndexRef = ref(-1)

const {
  saveStatus,
  flushSave,
  scheduleSave,
  cleanup: cleanupSave
} = useSave(tempEditor, pagesRef, currentIndexRef)

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
} = usePages(tempEditor, scheduleSave, flushSave)

watch(pages, (v) => {
  pagesRef.value = v
})
watch(currentIndex, (v) => {
  currentIndexRef.value = v
})

const {
  isNotched,
  isAnimating,
  pillHovered,
  panelAnimate,
  panelTransition,
  isLightTheme: notchIsLight,
  appReady,
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

function handlePillClick() {
  if (appSettings.value.wakeMode === 'click') window.api.exitNotch()
}
function handleSettingsUpdate(s: Record<string, string>) {
  appSettings.value = s
  if (s._reload) loadPages()
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
  if (!ctrl) return
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
      if (!e.shiftKey) {
        e.preventDefault()
        editor.value?.chain().focus().undo().run()
      }
      break
    case 'y':
      e.preventDefault()
      editor.value?.chain().focus().redo().run()
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

  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

  window.api.onNotchChange((v: boolean) => {
    isNotched.value = v
  })
  document.addEventListener('keydown', handleKeydown)
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
    <Motion :initial="{ opacity: 0, scale: 0.3 }" :class="[
      'panel-motion',
      {
        notched: isNotched,
        animating: isAnimating,
        'pill-hovered': pillHovered,
        'click-mode': appSettings.wakeMode === 'click'
      }
    ]" :animate="panelAnimate" :transition="panelTransition" :style="{
        pointerEvents: isNotched && appSettings.wakeMode !== 'click' ? 'none' : 'auto'
      }" @mouseenter="pillHovered = true" @mouseleave="pillHovered = false" @click="handlePillClick">
      <div class="panel">
        <TopToolbar :pages="pages" :current-index="currentIndex" :max-pages="10" :is-notched="isNotched"
          @select="selectPage" @add="addPage" @delete="deletePage" @clear="clearCurrentPage"
          @settings="settingsVisible = true" @reorder="reorderPages" @toggle-pin="togglePinPage"
          @update-title="handleUpdateTitle" />

        <div v-show="currentIndex >= 0" class="editor-area">
          <div class="content-card">
            <div class="content-body">
              <EditorContent :editor="editor" />
            </div>
            <span class="char-count">{{ charCount }} 字</span>
            <BottomBar :format-btns="formatBtns" :font-size-options="fontSizeOptions" :font-options="fontOptions"
              :color-options="colorOptions" :highlight-colors="highlightColors" :current-font-size="currentFontSize"
              :current-font-family="currentFontFamily" :current-text-color="currentTextColor"
              :current-highlight-color="currentHighlightColor" :is-notched="isNotched" @set-font-size="setFontSize"
              @clear-font-size="clearFontSize" @set-font-family="setFontFamily" @set-text-color="setTextColor"
              @clear-text-color="clearTextColor" @clear-highlight-color="clearHighlightColor"
              @set-highlight="setHighlight" @open-link="linkPromptVisible = true" />
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
      </div>
      <div v-show="currentIndex < 0" class="editor-area empty">
        <p class="empty-hint">空白白的~</p>
      </div>
    </Motion>
  </div>

  <Settings :visible="settingsVisible" @close="settingsVisible = false" @update-settings="handleSettingsUpdate" />
  <LinkDialog :visible="linkPromptVisible" :initial-url="linkUrlInput" @confirm="confirmLink"
    @cancel="linkPromptVisible = false" />
</template>

<style src="./App.css" />
