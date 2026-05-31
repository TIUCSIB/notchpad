const fs = require('fs')
const p = 'src/renderer/src/components/Settings.vue'

const content = `<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  X, Monitor, Palette, Type, Power, Download, Upload, RotateCcw, MousePointerClick
} from 'lucide-vue-next'
import { Motion, AnimatePresence } from 'motion-v'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updateSettings', settings: Record<string, string>): void
}>()

const settings = ref<Record<string, string>>({
  theme: 'dark', accentColor: '#4ade80', defaultFontSize: '14px',
  autoStart: 'false', wakeMode: 'hover'
})

const showSaved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null
const fontSizeDropdown = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const fontSelectRef = ref<HTMLElement | null>(null)
const settingsBodyRef = ref<HTMLElement | null>(null)
const dropdownPos = ref<{ top: string; left: string }>({ top: '0px', left: '0px' })

const accentOptions = [
  { color: '#4ade80', label: '绿' },
  { color: '#60a5fa', label: '蓝' },
  { color: '#f87171', label: '红' },
  { color: '#fbbf24', label: '黄' },
  { color: '#c084fc', label: '紫' },
  { color: '#fb923c', label: '橙' },
  { color: '#e5e5e5', label: '白' }
]

const fontSizeOptions = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

function onDocClick(e: PointerEvent) {
  const t = e.target as HTMLElement
  if (!t.closest('.font-select') && !t.closest('.font-select-dropdown')) {
    fontSizeDropdown.value = false
  }
}

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
  savedTimer = setTimeout(() => { showSaved.value = false }, 1200)
}

function updateDropdownPos() {
  if (!fontSelectRef.value || !panelRef.value) return
  const panelRect = panelRef.value.getBoundingClientRect()
  const triggerRect = fontSelectRef.value.getBoundingClientRect()
  const ddHeight = 200
  const topInPanel = triggerRect.bottom - panelRect.top + 4
  const left = triggerRect.left - panelRect.left
  const spaceBelow = panelRect.height - (triggerRect.bottom - panelRect.top) - 12
  if (spaceBelow < ddHeight) {
    dropdownPos.value = { top: (triggerRect.top - panelRect.top - ddHeight - 4) + 'px', left: left + 'px' }
  } else {
    dropdownPos.value = { top: topInPanel + 'px', left: left + 'px' }
  }
}

function toggleFontSizeDropdown() {
  if (fontSizeDropdown.value) {
    fontSizeDropdown.value = false
  } else {
    fontSizeDropdown.value = true
    nextTick(updateDropdownPos)
  }
}

function onSettingsScroll() {
  if (fontSizeDropdown.value) updateDropdownPos()
}

function handleExport() {
  window.api.getPages().then((pages) => {
    const data = JSON.stringify(pages, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'memo-export-' + new Date().toISOString().slice(0, 10) + '.json'
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
    } catch { /* ignore */ }
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
    theme: 'dark', accentColor: '#4ade80', defaultFontSize: '14px',
    autoStart: 'false', wakeMode: 'hover'
  }
  emit('updateSettings', { ...settings.value })
  flashSaved()
}

function onClose() { emit('close') }

onMounted(() => {
  loadSettings()
  document.addEventListener('pointerdown', onDocClick, true)
  settingsBodyRef.value?.addEventListener('scroll', onSettingsScroll)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocClick, true)
  settingsBodyRef.value?.removeEventListener('scroll', onSettingsScroll)
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
          <div ref="panelRef" class="settings-panel-inner">
            <div class="settings-header">
              <span class="settings-title">设置</span>
              <button type="button" class="settings-close-btn" @click="onClose">
                <X :size="14" :stroke-width="2.5" />
              </button>
            </div>

            <div ref="settingsBodyRef" class="settings-body">
              <!-- 主题 -->
              <div class="setting-row">
                <div class="setting-label">
                  <Monitor :size="15" :stroke-width="2.5" />
                  <span>主题</span>
                </div>
                <div class="setting-control">
                  <button v-for="t in [{ key: 'dark', label: '深色' }, { key: 'light', label: '浅色' }]"
                    :key="t.key" class="theme-btn" :class="{ active: settings.theme === t.key }"
                    @click="save('theme', t.key)">{{ t.label }}</button>
                </div>
              </div>

              <!-- 强调色 -->
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

              <!-- 默认字号 -->
              <div class="setting-row">
                <div class="setting-label">
                  <Type :size="15" :stroke-width="2.5" />
                  <span>默认字号</span>
                </div>
                <div class="setting-control">
                  <div ref="fontSelectRef" class="font-select" @click.stop="toggleFontSizeDropdown">
                    <span class="font-select-value">{{ settings.defaultFontSize }}</span>
                    <svg class="font-select-arrow" :class="{ open: fontSizeDropdown }" width="10" height="6" viewBox="0 0 10 6" fill="none">
                      <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              <!-- 开机自启 -->
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

              <!-- 唤醒方式 -->
              <div class="setting-row">
                <div class="setting-label">
                  <MousePointerClick :size="15" :stroke-width="2.5" />
                  <span>唤醒方式</span>
                </div>
                <div class="setting-control">
                  <button v-for="m in [{ key: 'hover', label: '悬浮' }, { key: 'click', label: '点击' }]"
                    :key="m.key" class="theme-btn" :class="{ active: settings.wakeMode === m.key }"
                    @click="save('wakeMode', m.key)">{{ m.label }}</button>
                </div>
              </div>

              <div class="setting-divider" />

              <!-- 导出 -->
              <div class="setting-row">
                <div class="setting-label">
                  <Download :size="15" :stroke-width="2.5" />
                  <span>导出数据</span>
                </div>
                <button class="action-btn" @click="handleExport">导出</button>
              </div>

              <!-- 导入 -->
              <div class="setting-row">
                <div class="setting-label">
                  <Upload :size="15" :stroke-width="2.5" />
                  <span>导入数据</span>
                </div>
                <button class="action-btn" @click="handleImport">导入</button>
              </div>

              <div class="setting-divider" />

              <!-- 重置 -->
              <div class="setting-row">
                <div class="setting-label">
                  <RotateCcw :size="15" :stroke-width="2.5" />
                  <span>恢复默认</span>
                </div>
                <button class="action-btn danger" @click="handleReset">重置</button>
              </div>
            </div>

            <!-- 字号下拉 - 在 panel-inner 内，settings-body 外，不受 overflow 裁切 -->
            <AnimatePresence>
              <Motion v-if="visible && fontSizeDropdown" class="font-select-dropdown"
                :initial="{ opacity: 0, y: -4, scale: 0.96 }"
                :animate="{ opacity: 1, y: 0, scale: 1 }"
                :exit="{ opacity: 0, y: -4, scale: 0.96 }"
                :transition="{ type: 'spring', stiffness: 400, damping: 28, mass: 0.5 }"
                :style="dropdownPos"
                @click.stop>
                <div class="font-select-list">
                  <div v-for="s in fontSizeOptions" :key="s" class="font-select-item"
                    :class="{ active: settings.defaultFontSize === s }"
                    @click.stop="save('defaultFontSize', s); fontSizeDropdown = false">
                    {{ s }}
                  </div>
                </div>
              </Motion>
            </AnimatePresence>

            <!-- 保存成功提示 -->
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
  transition: background 0.15s, color 0.15s;
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

.color-grid { gap: 6px; }

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}
.color-dot:hover { transform: scale(1.15); }
.color-dot.active { border-color: var(--text-primary, #fff); transform: scale(1.15); }

.font-select {
  position: relative;
  min-width: 80px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 0 10px;
  background: var(--bg-toolbar, #151516);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 6px;
  color: var(--text-primary, #e5e5e5);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s;
  user-select: none;
}
.font-select:hover { border-color: var(--border-strong, #3a3a3c); }
.font-select-value { white-space: nowrap; font-weight: 500; }
.font-select-arrow { flex-shrink: 0; color: var(--text-secondary, #888); transition: transform 0.2s; }
.font-select-arrow.open { transform: rotate(180deg); }

/* 下拉列表：position:absolute 相对 panel-inner，不被 settings-body overflow 裁切 */
.font-select-dropdown {
  position: absolute;
  z-index: 10;
  background: var(--bg-toolbar, #151516);
  border: 1px solid var(--border-strong, #3a3a3c);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  min-width: 80px;
  overflow: visible;
}

.font-select-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
}

.font-select-item {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary, #888);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s;
  text-align: center;
}
.font-select-item:hover { background: var(--hover-bg, #3a3a3a); color: var(--text-primary, #e5e5e5); }
.font-select-item.active { background: var(--accent-dim, rgba(74, 222, 128, 0.12)); color: var(--accent, #4ade80); font-weight: 600; }

.toggle-btn {
  width: 36px; height: 20px; border-radius: 10px;
  background: var(--active-bg, #3a3a3c); border: none; cursor: pointer;
  position: relative; transition: background 0.2s; padding: 0;
}
.toggle-btn.active { background: var(--accent, #4ade80); }
.toggle-knob {
  position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
  border-radius: 50%; background: #fff; transition: transform 0.2s;
}
.toggle-btn.active .toggle-knob { transform: translateX(16px); }

.action-btn {
  padding: 4px 12px; font-size: 12px;
  background: var(--bg-toolbar, #2a2a2c); border: 1px solid var(--border-strong, #3a3a3c);
  border-radius: 6px; color: var(--text-primary, #e5e5e5); cursor: pointer; transition: background 0.15s;
}
.action-btn:hover { background: var(--hover-bg, #3a3a3c); }
.action-btn.danger { color: var(--danger-text, #f87171); border-color: var(--danger-hover, #5a2a2a); }
.action-btn.danger:hover { background: var(--danger-hover, #3a1a1a); }

.setting-divider { height: 1px; background: var(--divider, #2a2a2c); margin: 4px 16px; }

.saved-toast {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  background: var(--accent, #4ade80); color: #1a1a1c; font-size: 11px; font-weight: 600;
  padding: 3px 12px; border-radius: 20px; pointer-events: none; z-index: 200; white-space: nowrap;
}
.toast-enter-active { animation: toastIn 0.2s ease; }
.toast-leave-active { animation: toastOut 0.15s ease; }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
@keyframes toastOut { from { opacity: 1; transform: translateX(-50%) translateY(0); } to { opacity: 0; transform: translateX(-50%) translateY(4px); } }
</style>
`

fs.writeFileSync(p, content, 'utf8')
console.log('Written', content.length, 'chars')
console.log('Has style:', content.includes('<style>'))
console.log('Has panelRef:', content.includes('panelRef'))
console.log('Has dropdown in panel-inner:', content.includes('settings-panel-inner'))
console.log(
  'No overflow in settings-body:',
  content.includes('.settings-body {') &&
    !content.match(/\.settings-body\s*\{[^}]*overflow:\s*visible/)
)
