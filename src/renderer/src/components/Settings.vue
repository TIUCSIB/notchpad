<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  X,
  Monitor,
  Palette,
  Type,
  Power,
  Download,
  Upload,
  RotateCcw,
  MousePointerClick
} from 'lucide-vue-next'
import { Motion, AnimatePresence } from 'motion-v'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updateSettings', settings: Record<string, string>): void
}>()

const settings = ref<Record<string, string>>({
  theme: 'dark',
  accentColor: '#4ade80',
  defaultFontSize: '14px',
  autoStart: 'false',
  wakeMode: 'hover'
})

const showSaved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null

const accentOptions = [
  { color: '#4ade80' },
  { color: '#60a5fa' },
  { color: '#f87171' },
  { color: '#fbbf24' },
  { color: '#c084fc' },
  { color: '#fb923c' },
  { color: '#e5e5e5' }
]

const fontSizeOptions = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

async function loadSettings() {
  const saved = await window.api.getSettings()
  if (saved && Object.keys(saved).length) {
    settings.value = { ...settings.value, ...saved }
  }
}

async function save(key: string, value: string) {
  settings.value[key] = value
  await window.api.setSetting(key, value)
  emit('updateSettings', { ...settings.value })
  flashSaved()
}

function flashSaved() {
  showSaved.value = true
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    showSaved.value = false
  }, 1200)
}

// --- HTML to Markdown converter ---
function htmlToMarkdown(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(processNode).join('')

    switch (tag) {
      case 'h1':
        return '# ' + children.trim() + '\n\n'
      case 'h2':
        return '## ' + children.trim() + '\n\n'
      case 'h3':
        return '### ' + children.trim() + '\n\n'
      case 'h4':
        return '#### ' + children.trim() + '\n\n'
      case 'h5':
        return '##### ' + children.trim() + '\n\n'
      case 'h6':
        return '###### ' + children.trim() + '\n\n'
      case 'p':
        return children.trim() + '\n\n'
      case 'br':
        return '\n'
      case 'strong':
      case 'b':
        return '**' + children + '**'
      case 'em':
      case 'i':
        return '*' + children + '*'
      case 's':
      case 'del':
        return '~~' + children + '~~'
      case 'code': {
        const parent = el.parentElement
        if (parent && parent.tagName.toLowerCase() === 'pre') return children
        return '`' + children + '`'
      }
      case 'pre':
        return '\n```\n' + children + '\n```\n\n'
      case 'blockquote': {
        const lines = children.trim().split('\n')
        return lines.map((l) => '> ' + l).join('\n') + '\n\n'
      }
      case 'a': {
        const href = el.getAttribute('href') || ''
        return '[' + children + '](' + href + ')'
      }
      case 'img': {
        const src = el.getAttribute('src') || ''
        const alt = el.getAttribute('alt') || ''
        return '![' + alt + '](' + src + ')'
      }
      case 'ul':
        return children + '\n'
      case 'ol':
        return children + '\n'
      case 'li': {
        const parent = el.parentElement?.tagName.toLowerCase()
        if (parent === 'ol') {
          const idx = Array.from(el.parentElement!.children).indexOf(el) + 1
          return idx + '. ' + children.trim() + '\n'
        }
        return '- ' + children.trim() + '\n'
      }
      case 'hr':
        return '\n---\n\n'
      case 'div':
      case 'span':
      case 'mark':
      case 'u':
      case 'sup':
      case 'sub':
        return children
      default:
        return children
    }
  }

  let md = processNode(tmp)
  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, '\n\n')
  return md.trim() + '\n'
}

function handleExportJson() {
  window.api.getPages().then((pages) => {
    const data = JSON.stringify(pages, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download =
      'notchpad-export-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json'
    a.click()
    URL.revokeObjectURL(url)
  })
}

function handleExportMarkdown() {
  window.api.getPages().then((pages) => {
    let md = '# Notchpad\n\n> Exported on ' + new Date().toLocaleDateString() + '\n\n---\n\n'
    pages.forEach((page, i) => {
      const title = 'Page ' + (i + 1)
      if (page.content) {
        md += '## ' + title + '\n\n'
        md += htmlToMarkdown(page.content)
        md += '\n---\n\n'
      }
    })
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download =
      'notchpad-export-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.md'
    a.click()
    URL.revokeObjectURL(url)
  })
}

function handleImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const pages = JSON.parse(text)
      if (Array.isArray(pages)) {
        for (const p of pages) {
          await window.api.addPage()
          const allPages = await window.api.getPages()
          const last = allPages[allPages.length - 1]
          if (last) await window.api.updatePage(last.id, p.title || '', p.content || '')
        }
        emit('updateSettings', { ...settings.value, _reload: '1' })
        flashSaved()
      }
    } catch {
      /* ignore */
    }
  }
  input.click()
}

async function handleReset() {
  const keys = Object.keys(settings.value)
  for (const k of keys) {
    settings.value[k] = ''
    await window.api.setSetting(k, '')
  }
  settings.value = {
    theme: 'dark',
    accentColor: '#4ade80',
    defaultFontSize: '14px',
    autoStart: 'false',
    wakeMode: 'hover'
  }
  emit('updateSettings', { ...settings.value })
  flashSaved()
}

function onClose() {
  emit('close')
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <Motion v-if="visible" class="settings-overlay" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }" :transition="{ duration: 0.25, ease: 'easeInOut' }" @click.self="emit('close')">
        <Motion class="settings-panel" :initial="{ opacity: 0, y: -12, scale: 0.96 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }" :exit="{ opacity: 0, y: -12, scale: 0.96 }"
          :transition="{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }" @click.stop>
          <div class="settings-panel-inner">
            <div class="settings-header">
              <span class="settings-title">设置</span>
              <button type="button" class="settings-close-btn" @click="onClose">
                <X :size="14" :stroke-width="2.5" />
              </button>
            </div>

            <div class="settings-body">
              <div class="setting-row">
                <div class="setting-label">
                  <Monitor :size="15" :stroke-width="2.5" />
                  <span>主题</span>
                </div>
                <div class="setting-control">
                  <button v-for="t in [
                    { key: 'dark', label: '深色' },
                    { key: 'light', label: '浅色' },
                    { key: 'system', label: '系统' }
                  ]" :key="t.key" class="theme-btn" :class="{ active: settings.theme === t.key }"
                    @click="save('theme', t.key)">
                    {{ t.label }}
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <Palette :size="15" :stroke-width="2.5" />
                  <span>强调色</span>
                </div>
                <div class="setting-control color-grid">
                  <button v-for="a in accentOptions" :key="a.color" class="color-dot"
                    :class="{ active: settings.accentColor === a.color }" :style="{ background: a.color }"
                    @click="save('accentColor', a.color)" />
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <Type :size="15" :stroke-width="2.5" />
                  <span>默认字号</span>
                </div>
                <div class="setting-control">
                  <select class="native-select" :value="settings.defaultFontSize"
                    @change="save('defaultFontSize', ($event.target as HTMLSelectElement).value)">
                    <option v-for="s in fontSizeOptions" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <Power :size="15" :stroke-width="2.5" />
                  <span>开机自启</span>
                </div>
                <div class="setting-control">
                  <button class="toggle-btn" :class="{ active: settings.autoStart === 'true' }"
                    @click="save('autoStart', settings.autoStart === 'true' ? 'false' : 'true')">
                    <span class="toggle-knob" />
                  </button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <MousePointerClick :size="15" :stroke-width="2.5" />
                  <span>唤醒方式</span>
                </div>
                <div class="setting-control">
                  <button v-for="m in [
                    { key: 'hover', label: '悬浮' },
                    { key: 'click', label: '点击' }
                  ]" :key="m.key" class="theme-btn" :class="{ active: settings.wakeMode === m.key }"
                    @click="save('wakeMode', m.key)">
                    {{ m.label }}
                  </button>
                </div>
              </div>

              <div class="setting-divider" />

              <div class="setting-row">
                <div class="setting-label">
                  <Download :size="15" :stroke-width="2.5" />
                  <span>导出数据</span>
                </div>
                <div class="setting-control">
                  <button class="action-btn" @click="handleExportJson">JSON</button>
                  <button class="action-btn" @click="handleExportMarkdown">Markdown</button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <Upload :size="15" :stroke-width="2.5" />
                  <span>导入数据</span>
                </div>
                <button class="action-btn" @click="handleImport">导入</button>
              </div>

              <div class="setting-divider" />

              <div class="setting-row">
                <div class="setting-label">
                  <RotateCcw :size="15" :stroke-width="2.5" />
                  <span>恢复默认</span>
                </div>
                <button class="action-btn danger" @click="handleReset">重置</button>
              </div>

              <div class="setting-divider" />

              <div class="shortcuts-section">
                <div class="setting-label shortcuts-title">
                  <span>快捷键</span>
                </div>
                <div class="shortcuts-list">
                  <div class="shortcut-row"><kbd>Ctrl+N</kbd> <span>新建页面</span></div>
                  <div class="shortcut-row"><kbd>Ctrl+S</kbd> <span>保存</span></div>
                  <div class="shortcut-row"><kbd>Ctrl+Z</kbd> <span>撤销</span></div>
                  <div class="shortcut-row"><kbd>Ctrl+Y</kbd> <span>重做</span></div>
                  <div class="shortcut-row"><kbd>Ctrl+W</kbd> <span>最小化</span></div>
                  <div class="shortcut-row"><kbd>Ctrl+Alt+Z</kbd> <span>打开窗口</span></div>
                </div>
              </div>
            </div>

            <Transition name="toast">
              <div v-if="showSaved" class="saved-toast">已保存</div>
            </Transition>
          </div>
        </Motion>
      </Motion>
    </AnimatePresence>
  </Teleport>
</template>

<style>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--overlay-bg, rgba(0, 0, 0, 0.4));
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 20px;
  border-radius: 0 0 12px 12px;
}

.settings-panel {
  width: 320px;
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #1a1a1c);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  position: relative;
  flex-shrink: 0;
}

.settings-panel-inner {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: calc(100vh - 56px);
  border-radius: 12px;
  overflow: visible;
  position: relative;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border, #2a2a2c);
  flex-shrink: 0;
}

.settings-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #e5e5e5);
}

.settings-close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--text-secondary, #888);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s;
  -webkit-app-region: no-drag;
}

.settings-close-btn:hover {
  background: var(--hover-bg, #3a3a3a);
  color: var(--text-primary, #e5e5e5);
}

.settings-close-btn:active {
  background: var(--hover-bg-strong, #4a4a4a);
}

.settings-body {
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--label-color, #aaa);
  font-size: 13px;
  flex-shrink: 0;
}

.setting-label span {
  color: var(--text-primary, #e5e5e5);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.theme-btn {
  padding: 4px 10px;
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 6px;
  color: var(--text-secondary, #888);
  cursor: pointer;
  transition: all 0.2s;
}

.theme-btn:hover:not(.active) {
  background: var(--hover-bg, #3a3a3a);
  color: var(--text-primary, #e5e5e5);
}

.theme-btn.active {
  background: var(--accent, #4ade80);
  color: #1a1a1c;
  border-color: var(--accent, #4ade80);
  font-weight: 600;
}

.color-grid {
  gap: 6px;
}

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    border-color 0.15s,
    transform 0.15s;
}

.color-dot:hover {
  transform: scale(1.15);
}

.color-dot.active {
  border-color: var(--text-primary, #fff);
  transform: scale(1.15);
}

.native-select {
  min-width: 80px;
  height: 30px;
  padding: 0 24px 0 10px;
  background: var(--bg-toolbar, #151516);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 6px;
  color: var(--text-primary, #e5e5e5);
  font-size: 12px;
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  transition: border-color 0.15s;
}

.native-select:hover {
  border-color: var(--border-strong, #3a3a3c);
}

.native-select option {
  background: var(--bg-toolbar, #151516);
  color: var(--text-primary, #e5e5e5);
}

.toggle-btn {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--active-bg, #3a3a3c);
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
}

.toggle-btn.active {
  background: var(--accent, #4ade80);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}

.toggle-btn.active .toggle-knob {
  transform: translateX(16px);
}

.action-btn {
  padding: 4px 12px;
  font-size: 12px;
  background: var(--bg-toolbar, #2a2a2c);
  border: 1px solid var(--border-strong, #3a3a3c);
  border-radius: 6px;
  color: var(--text-primary, #e5e5e5);
  cursor: pointer;
  transition: background 0.15s;
}

.action-btn:hover {
  background: var(--hover-bg, #3a3a3c);
}

.action-btn.danger {
  color: var(--danger-text, #f87171);
  border-color: var(--danger-hover, #5a2a2a);
}

.action-btn.danger:hover {
  background: var(--danger-hover, #3a1a1a);
}

.setting-divider {
  height: 1px;
  background: var(--divider, #2a2a2c);
  margin: 4px 16px;
}

.shortcuts-section {
  padding: 4px 16px 8px;
}

.shortcuts-title {
  margin-bottom: 6px;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.shortcut-row kbd {
  display: inline-block;
  padding: 1px 6px;
  font-size: 10px;
  font-family: monospace;
  background: var(--bg-toolbar, #151516);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 4px;
  color: var(--text-primary, #e5e5e5);
}

.saved-toast {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent, #4ade80);
  color: #1a1a1c;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 12px;
  border-radius: 20px;
  pointer-events: none;
  z-index: 200;
  white-space: nowrap;
}

.toast-enter-active {
  animation: toastIn 0.2s ease;
}

.toast-leave-active {
  animation: toastOut 0.15s ease;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@keyframes toastOut {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  to {
    opacity: 0;
    transform: translateX(-50%) translateY(4px);
  }
}
</style>
