<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import LinkExtension from '@tiptap/extension-link'
import TaskItem from '@tiptap/extension-task-item'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { FontFamily } from '@tiptap/extension-font-family'
import { Mark, mergeAttributes, type CommandProps } from '@tiptap/core'
import {
  Minus,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Quote,
  List,
  ListOrdered,
  ListChecks,
  type LucideIcon
} from 'lucide-vue-next'
import TopToolbar from './components/TopToolbar.vue'
import BottomBar from './components/BottomBar.vue'
import LinkDialog from './components/LinkDialog.vue'
import Settings from './components/Settings.vue'
import { Motion, AnimatePresence } from 'motion-v'

interface Page {
  id: number
  title: string
  content: string
  sort_order: number
  pinned: number
  created_at: string
  updated_at: string
}

interface FormatBtn {
  title: string
  icon: LucideIcon
  action: () => void
  isActive?: () => boolean
}

const MAX_PAGES = 10
const fontOptions = ['默认', '宋体', '黑体', '楷体', '微软雅黑', 'Arial', 'Georgia', 'Courier New']
const fontSizeOptions = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']
const colorOptions = [
  '#e5e5e5',
  '#ffffff',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#4ade80',
  '#0284c7',
  '#7c3aed',
  '#db2777'
]
const highlightColors = [
  '#fef08a',
  '#bbf7d0',
  '#bfdbfe',
  '#fecaca',
  '#e9d5ff',
  '#fed7aa',
  '#d1fae5',
  '#ffffff'
]

const isNotched = ref(true)
const isAnimating = ref(false)
let animTimer: ReturnType<typeof setTimeout> | null = null
let collapseColorTimer: ReturnType<typeof setTimeout> | null = null
const pages = ref<Page[]>([])
const currentIndex = ref(-1)
const linkPromptVisible = ref(false)
const settingsVisible = ref(false)
const pillHovered = ref(false)
const linkUrlInput = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let isSwitching = false
const appSettings = ref<Record<string, string>>({})

// Save status: 'idle' | 'saving' | 'saved'
const saveStatus = ref<'idle' | 'saving' | 'saved'>('idle')
let savedStatusTimer: ReturnType<typeof setTimeout> | null = null

const accentColor = computed(() => appSettings.value.accentColor || '#4ade80')
const osThemeDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
const osMedia = window.matchMedia('(prefers-color-scheme: dark)')
const onOsThemeChange = (e: MediaQueryListEvent) => {
  osThemeDark.value = e.matches
}
const isLightTheme = computed(() => {
  const t = appSettings.value.theme
  if (t === 'system') return !osThemeDark.value
  return t === 'light'
})
const appStyle = computed(() => ({
  '--accent': accentColor.value,
  '--accent-dim': accentColor.value + '20',
  '--bg-main': isLightTheme.value ? '#faf6f0' : '#000',
  '--bg-card': isLightTheme.value ? '#f5f0e8' : '#0f1014',
  '--bg-bar': isLightTheme.value ? '#ede8df' : '#1a1a1a',
  '--bg-toolbar': isLightTheme.value ? '#e5dfd4' : '#151516',
  '--text-primary': isLightTheme.value ? '#3d3629' : '#e5e5e5',
  '--text-secondary': isLightTheme.value ? '#666' : '#888',
  '--border': isLightTheme.value ? '#ddd' : '#2a2a2c',
  '--border-strong': isLightTheme.value ? '#ccc' : '#3a3a3c',
  '--hover-bg': isLightTheme.value ? '#d9d3c6' : '#3a3a3a',
  '--hover-bg-strong': isLightTheme.value ? '#ccc5b8' : '#4a4a4a',
  '--input-bg': isLightTheme.value ? '#fff' : '#1e1e1e',
  '--overlay-bg': isLightTheme.value ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.4)',
  '--label-color': isLightTheme.value ? '#888' : '#aaa',
  '--active-bg': isLightTheme.value ? '#d1cbbf' : '#3a3a3c',
  '--divider': isLightTheme.value ? '#ddd' : '#2a2a2c',
  '--danger-text': '#dc2626',
  '--danger-hover': isLightTheme.value ? '#fecaca' : '#3a1a1a',
  '--editor-font-size': appSettings.value.defaultFontSize || '14px'
}))

function applyRootVars(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) {
    document.documentElement.style.setProperty(k, v)
  }
}

watch(appStyle, (val) => applyRootVars(val as Record<string, string>), { immediate: true })

const expandSpring = { type: 'spring' as const, stiffness: 150, damping: 22, mass: 0.8 }
const collapseSpring = { type: 'spring' as const, stiffness: 200, damping: 30, mass: 0.6 }

watch(isNotched, (notched) => {
  if (notched && settingsVisible.value) settingsVisible.value = false
  if (animTimer) {
    clearTimeout(animTimer)
    animTimer = null
  }
  if (collapseColorTimer) {
    clearTimeout(collapseColorTimer)
    collapseColorTimer = null
  }

  if (notched) {
    isAnimating.value = true
    collapseColorTimer = setTimeout(() => {
      isAnimating.value = false
    }, 380)
  } else {
    isAnimating.value = true
    animTimer = setTimeout(() => {
      isAnimating.value = false
    }, 300)
  }
})

const notchColor = computed(() => {
  const n = pages.value.length
  if (n === 0) return 'rgba(93,190,138,1)'
  if (n >= 3) return 'rgba(236,43,36,1)'
  return 'rgba(251,139,5,1)'
})

const panelBgColor = computed(() => {
  const light = isLightTheme.value
  if (!isNotched.value) return light ? '#faf6f0' : '#000'
  if (isAnimating.value) return light ? '#faf6f0' : '#000'
  return notchColor.value
})

const panelAnimate = computed(() => ({
  width: isNotched.value ? (pillHovered.value ? '80px' : '64px') : 'calc(100% - 4px)',
  height: isNotched.value ? (pillHovered.value ? '10px' : '8px') : '100vh',
  top: isNotched.value ? (pillHovered.value ? '3px' : '4px') : '0px',
  borderRadius: isNotched.value ? '4px' : '0 0 12px 12px',
  backgroundColor: panelBgColor.value
}))

const panelTransition = computed(() => (isNotched.value ? collapseSpring : expandSpring))

// --- Custom FontSize mark ---
const FontSize = Mark.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.fontSize?.replace(/["']/g, ''),
        renderHTML: (attrs) => {
          if (!attrs.fontSize) return {}
          return { style: 'font-size: ' + attrs.fontSize }
        }
      }
    }
  },
  parseHTML() {
    return [{ tag: 'span', style: 'font-size' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
          ({ chain }: CommandProps) =>
            chain().setMark(this.name, { fontSize }).run(),
      unsetFontSize:
        () =>
          ({ chain }: CommandProps) =>
            chain().setMark(this.name, { fontSize: null }).removeEmptyTextStyle().run()
    }
  }
})

// --- Editor ---
const editor = useEditor({
  extensions: [
    StarterKit,
    LinkExtension.configure({ openOnClick: false }),
    Placeholder.configure({ placeholder: '写点什么吧....' }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontFamily,
    FontSize
  ],
  content: '',
  editorProps: {
    attributes: { class: 'editor-content' },
    handleDOMEvents: {
      contextmenu: (_view, event) => {
        const target = event.target as HTMLElement
        if (target.tagName === 'A') {
          event.preventDefault()
          const href = (target as HTMLAnchorElement).href
          if (href) window.api.openExternal(href)
          return true
        }
        return false
      }
    },
    handlePaste: (_view, event) => {
      const items = event.clipboardData?.items
      if (!items) return false
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (!file) continue
          const reader = new FileReader()
          reader.onload = () => {
            editor.value
              ?.chain()
              .focus()
              .setImage({ src: reader.result as string })
              .run()
          }
          reader.readAsDataURL(file)
          return true
        }
      }
      return false
    }
  },
  onUpdate: () => {
    if (!isSwitching) scheduleSave()
  }
})

// --- Format buttons ---
function fmtBold() {
  editor.value?.chain().focus().toggleBold().run()
}
function fmtItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}
function fmtStrike() {
  editor.value?.chain().focus().toggleStrike().run()
}
function fmtCode() {
  editor.value?.chain().focus().toggleCode().run()
}
function fmtQuote() {
  editor.value?.chain().focus().toggleBlockquote().run()
}
function fmtBullet() {
  editor.value?.chain().focus().toggleBulletList().run()
}
function fmtOrdered() {
  editor.value?.chain().focus().toggleOrderedList().run()
}
function fmtTask() {
  editor.value?.chain().focus().toggleTaskList().run()
}
function fmtHr() {
  editor.value?.chain().focus().setHorizontalRule().run()
}

const formatBtns: FormatBtn[] = [
  {
    title: '加粗',
    icon: Bold,
    action: fmtBold,
    isActive: () => editor.value?.isActive('bold') ?? false
  },
  {
    title: '斜体',
    icon: Italic,
    action: fmtItalic,
    isActive: () => editor.value?.isActive('italic') ?? false
  },
  {
    title: '删除线',
    icon: Strikethrough,
    action: fmtStrike,
    isActive: () => editor.value?.isActive('strike') ?? false
  },
  {
    title: '代码',
    icon: Code,
    action: fmtCode,
    isActive: () => editor.value?.isActive('code') ?? false
  },
  {
    title: '链接',
    icon: Link,
    action: fmtLink,
    isActive: () => editor.value?.isActive('link') ?? false
  },
  {
    title: '引用',
    icon: Quote,
    action: fmtQuote,
    isActive: () => editor.value?.isActive('blockquote') ?? false
  },
  {
    title: '无序列表',
    icon: List,
    action: fmtBullet,
    isActive: () => editor.value?.isActive('bulletList') ?? false
  },
  {
    title: '有序列表',
    icon: ListOrdered,
    action: fmtOrdered,
    isActive: () => editor.value?.isActive('orderedList') ?? false
  },
  {
    title: '任务列表',
    icon: ListChecks,
    action: fmtTask,
    isActive: () => editor.value?.isActive('taskList') ?? false
  },
  { title: '分割线', icon: Minus, action: fmtHr }
]

// --- Page management ---
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
  nextTick(() => {
    isSwitching = false
  })
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  saveCurrentPage()
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveStatus.value = 'saving'
  saveTimer = setTimeout(saveCurrentPage, 600)
}

async function saveCurrentPage() {
  const idx = currentIndex.value
  const page = idx >= 0 && idx < pages.value.length ? pages.value[idx] : null
  if (!page || !editor.value) return
  const updated = await window.api.updatePage(page.id, '', editor.value.getHTML())
  pages.value[idx] = updated
  saveStatus.value = 'saved'
  if (savedStatusTimer) clearTimeout(savedStatusTimer)
  savedStatusTimer = setTimeout(() => {
    if (saveStatus.value === 'saved') saveStatus.value = 'idle'
  }, 2000)
}

async function addPage() {
  if (pages.value.length >= MAX_PAGES) return
  const page = await window.api.addPage()
  pages.value.push(page)
  selectPage(pages.value.length - 1)
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
  // Update currentIndex to follow the active page
  if (currentIndex.value === fromIndex) {
    currentIndex.value = toIndex
  } else if (fromIndex < currentIndex.value && toIndex >= currentIndex.value) {
    currentIndex.value--
  } else if (fromIndex > currentIndex.value && toIndex <= currentIndex.value) {
    currentIndex.value++
  }
  // Persist new order
  await window.api.reorderPages(arr.map((p) => p.id))
}

async function togglePinPage(id: number) {
  const updatedPages = await window.api.togglePinPage(id)
  pages.value = updatedPages
  const current = currentPage()
  if (current) {
    const newIdx = updatedPages.findIndex((p) => p.id === current.id)
    if (newIdx >= 0) currentIndex.value = newIdx
  } else if (updatedPages.length > 0) {
    currentIndex.value = 0
    selectPage(0)
  } else {
    currentIndex.value = -1
    editor.value?.commands.setContent('')
  }
}

function handlePillClick() {
  if (appSettings.value.wakeMode === 'click') {
    window.api.exitNotch()
  }
}

// --- Font actions ---
function setFontSize(size: string) {
  editor.value?.chain().focus().setFontSize(size).run()
  scheduleSave()
}
function clearFontSize() {
  editor.value?.chain().focus().unsetFontSize().run()
  scheduleSave()
}
function setFontFamily(family: string) {
  if (family === '默认') editor.value?.chain().focus().unsetFontFamily().run()
  else editor.value?.chain().focus().setFontFamily(family).run()
  scheduleSave()
}
function setTextColor(color: string) {
  editor.value?.chain().focus().setColor(color).run()
  scheduleSave()
}
function setHighlight(color: string) {
  editor.value?.chain().focus().toggleHighlight({ color }).run()
  scheduleSave()
}
function clearTextColor() {
  editor.value?.chain().focus().unsetColor().run()
  scheduleSave()
}
function clearHighlightColor() {
  editor.value?.chain().focus().unsetHighlight().run()
  scheduleSave()
}

function currentFontSize(): string {
  return editor.value?.getAttributes('fontSize').fontSize || '14px'
}
function currentFontFamily(): string {
  return editor.value?.getAttributes('textStyle').fontFamily || '默认'
}
function currentTextColor(): string {
  return editor.value?.getAttributes('textStyle').color || '#e5e5e5'
}

function currentHighlightColor(): string {
  return editor.value?.getAttributes('highlight').color || '#fef08a'
}

// --- Link ---
function fmtLink() {
  if (!editor.value) return
  linkUrlInput.value = editor.value.getAttributes('link').href || 'https://'
  linkPromptVisible.value = true
}
function confirmLink(url: string) {
  if (!editor.value) return
  linkPromptVisible.value = false
  if (!url) {
    editor.value.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.value.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

function handleSettingsUpdate(s: Record<string, string>) {
  appSettings.value = s
  if (s._reload) loadPages()
}

// --- Keyboard shortcuts ---
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
  const saved = await window.api.getSettings()
  if (saved && Object.keys(saved).length) appSettings.value = saved
  loadPages()
  window.api.onNotchChange((v: boolean) => {
    isNotched.value = v
  })
  osMedia.addEventListener('change', onOsThemeChange)
  document.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  editor.value?.destroy()
  if (animTimer) clearTimeout(animTimer)
  if (collapseColorTimer) clearTimeout(collapseColorTimer)
  if (savedStatusTimer) clearTimeout(savedStatusTimer)
  osMedia.removeEventListener('change', onOsThemeChange)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app-root" :style="appStyle">
    <Motion :class="[
      'panel-motion',
      {
        notched: isNotched,
        animating: isAnimating,
        'pill-hovered': pillHovered,
        'click-mode': appSettings.wakeMode === 'click'
      }
    ]" :animate="panelAnimate" :transition="panelTransition"
      :style="{ pointerEvents: isNotched && appSettings.wakeMode !== 'click' ? 'none' : 'auto' }"
      @mouseenter="pillHovered = true" @mouseleave="pillHovered = false" @click="handlePillClick">
      <div v-show="!isNotched" class="panel">
        <TopToolbar :pages="pages" :current-index="currentIndex" :max-pages="MAX_PAGES" :is-notched="isNotched" @select="selectPage"
          @add="addPage" @delete="deletePage" @clear="clearCurrentPage" @settings="settingsVisible = true"
          @reorder="reorderPages" @toggle-pin="togglePinPage" />

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
              @set-highlight="setHighlight" @open-link="fmtLink" />
          </div>
          <!-- Save status indicator -->
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

<style scoped>
.app-root {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.panel-motion {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);

  z-index: 2;
  background: var(--bg-main, #000);
  will-change: transform, width, height;
  filter: blur(0px);
  transition: filter 0.25s ease-out;
}

.panel-motion::before {
  content: '';
  position: absolute;
  inset: -4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  z-index: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.panel-motion.notched::before {
  opacity: 1;
}

.panel-motion.notched.pill-hovered::before {
  opacity: 0.6 !important;
}

.panel-motion.notched.pill-hovered {
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.25));
}

.panel-motion.notched:hover {
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.25));
}

.panel-motion.notched:hover::before {
  opacity: 0.6 !important;
}

/* Click mode: jelly + glow on hover */
.panel-motion.notched.click-mode.pill-hovered {
  animation: jelly 0.5s ease;
}

@keyframes jelly {
  0% {
    transform: translateX(-50%) scale(1, 1);
  }

  15% {
    transform: translateX(-50%) scale(1.15, 0.85);
  }

  30% {
    transform: translateX(-50%) scale(0.9, 1.1);
  }

  45% {
    transform: translateX(-50%) scale(1.05, 0.95);
  }

  60% {
    transform: translateX(-50%) scale(0.97, 1.03);
  }

  75% {
    transform: translateX(-50%) scale(1.02, 0.98);
  }

  100% {
    transform: translateX(-50%) scale(1, 1);
  }
}

.panel-motion.animating {
  filter: blur(0.8px);
}

.panel {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  color: var(--text-primary, #e5e5e5);
}

.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 6px 22px 4px 22px;
  overflow: hidden;
}

.editor-area.empty {
  align-items: center;
  justify-content: center;
}

.empty-hint {
  color: var(--text-secondary, #666);
  font-size: 14px;
}

.content-card {
  flex: 1;
  background: var(--bg-card, #0f1014);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.content-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 14px;
  border-radius: 8px 8px 0 0;
}

.save-status {
  height: 12px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-right: 4px;
  flex-shrink: 0;
}

.save-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-secondary, #888);
}

.save-indicator.saving {
  color: var(--text-secondary, #888);
}

.save-indicator.saved {
  color: var(--accent, #4ade80);
}

.save-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
}

.save-dot.saving {
  background: var(--text-secondary, #888);
  animation: pulse 1s ease infinite;
}

.save-dot.saved {
  background: var(--accent, #4ade80);
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.3;
  }
}
</style>
