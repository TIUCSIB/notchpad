<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
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
  cleanup: cleanupNotch
} = useNotch(pages, settingsVisible)
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

function handlePillClick() {
  if (appSettings.value.wakeMode === 'click') window.api.exitNotch()
}
function handleSettingsUpdate(s: Record<string, string>) {
  appSettings.value = s
  if (s._reload) loadPages()
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
    case 'w':
      e.preventDefault()
      window.api.closeWindow()
      break
  }
}

onMounted(async () => {
  await loadSettings()
  initSettingsListeners()
  await loadPages()

  // Pre-warm: force browser to compute full editor layout before first hover
  // This eliminates the lag on first expansion
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))

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
          @settings="settingsVisible = true" @reorder="reorderPages" @toggle-pin="togglePinPage" />

        <div v-show="currentIndex >= 0" class="editor-area">
          <div class="content-card">
            <div class="content-body">
              <EditorContent :editor="editor" />
            </div>
            <BottomBar :format-btns="formatBtns" :font-size-options="fontSizeOptions" :font-options="fontOptions"
              :color-options="colorOptions" :highlight-colors="highlightColors" :current-font-size="currentFontSize"
              :current-font-family="currentFontFamily" :current-text-color="currentTextColor"
              :current-highlight-color="currentHighlightColor" @set-font-size="setFontSize"
              @clear-font-size="clearFontSize" @set-font-family="setFontFamily" @set-text-color="setTextColor"
              @clear-text-color="clearTextColor" @clear-highlight-color="clearHighlightColor"
              @set-highlight="setHighlight" @open-link="linkPromptVisible = true" />
          </div>
          <div class="save-status">
            <AnimatePresence>
              <Motion v-if="saveStatus === 'saving'" :initial="{ opacity: 0, y: 4 }" :animate="{ opacity: 1, y: 0 }"
                :exit="{ opacity: 0, y: 4 }" :transition="{ duration: 0.15 }" class="save-indicator saving">
                <span class="save-dot saving" /> 保存中
              </Motion>
              <Motion v-else-if="saveStatus === 'saved'" :initial="{ opacity: 0, y: 4 }" :animate="{ opacity: 1, y: 0 }"
                :exit="{ opacity: 0, y: 4 }" :transition="{ duration: 0.15 }" class="save-indicator saved">
                <span class="save-dot saved" /> 已保存
              </Motion>
            </AnimatePresence>
          </div>
        </div>
        <div v-show="currentIndex < 0" class="editor-area empty">
          <p class="empty-hint">空白白的~</p>
        </div>
      </div>
    </Motion>
  </div>

  <Settings :visible="settingsVisible" @close="settingsVisible = false" @update-settings="handleSettingsUpdate" />
  <LinkDialog :visible="linkPromptVisible" :initial-url="linkUrlInput" @confirm="confirmLink"
    @cancel="linkPromptVisible = false" />
</template>

<style src="./App.css" />
