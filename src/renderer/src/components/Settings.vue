<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import {
  X,
  Monitor,
  Palette,
  Type,
  Power,
  Download,
  Upload,
  RotateCcw,
  MousePointerClick,
  FolderOpen
} from 'lucide-vue-next'
import { Motion, AnimatePresence } from 'motion-v'
import { exportAsJson, exportAsMarkdown, importFromJson } from '../utils/dataConverter'

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
  { color: '#4ade80' }, { color: '#60a5fa' }, { color: '#f87171' },
  { color: '#fbbf24' }, { color: '#c084fc' }, { color: '#fb923c' }, { color: '#e5e5e5' }
]

const fontSizeOptions = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

// Database path
const dbPath = ref('')
const dbRelocating = ref(false)
const dbRelocateMsg = ref('')

async function loadSettings() {
  const saved = await window.api.getSettings()
  if (saved && Object.keys(saved).length) {
    const filtered = Object.fromEntries(
      Object.entries(saved).filter(([_, v]) => v !== '' && v != null)
    )
    settings.value = { ...settings.value, ...filtered }
  }
}

async function loadDbPath() {
  dbPath.value = await window.api.getDbPath()
}

async function chooseDbDir() {
  const dir = await window.api.chooseDbDir()
  if (!dir) return
  dbRelocating.value = true
  dbRelocateMsg.value = ''
  const result = await window.api.relocateDb(dir)
  dbRelocating.value = false
  if (result.ok) {
    dbPath.value = result.path!
    dbRelocateMsg.value = '迁移成功'
    flashSaved()
  } else {
    dbRelocateMsg.value = '迁移失败: ' + (result.error || '未知错误')
  }
  setTimeout(() => { dbRelocateMsg.value = '' }, 3000)
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

async function handleReset() {
  await window.api.resetSettings()
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
  loadDbPath()
})

onBeforeUnmount(() => { if (savedTimer) clearTimeout(savedTimer) })
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
                  <button v-for="t in [{ key: 'dark', label: '深色' }, { key: 'light', label: '浅色' }, { key: 'system', label: '系统' }]"
                    :key="t.key" class="theme-btn" :class="{ active: settings.theme === t.key }" @click="save('theme', t.key)">
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
                  <button v-for="m in [{ key: 'hover', label: '悬浮' }, { key: 'click', label: '点击' }]"
                    :key="m.key" class="theme-btn" :class="{ active: settings.wakeMode === m.key }" @click="save('wakeMode', m.key)">
                    {{ m.label }}
                  </button>
                </div>
              </div>

              <div class="setting-divider" />

              <div class="setting-row db-path-row">
                <div class="setting-label">
                  <FolderOpen :size="15" :stroke-width="2.5" />
                  <span>存储位置</span>
                </div>
                <div class="setting-control db-path-control">
                  <span class="db-path-text" :title="dbPath">{{ dbPath }}</span>
                  <button class="action-btn" :disabled="dbRelocating" @click="chooseDbDir">
                    {{ dbRelocating ? '迁移中...' : '更改' }}
                  </button>
                </div>
              </div>
              <div v-if="dbRelocateMsg" class="db-relocate-msg">{{ dbRelocateMsg }}</div>

              <div class="setting-divider" />

              <div class="setting-row">
                <div class="setting-label">
                  <Download :size="15" :stroke-width="2.5" />
                  <span>导出数据</span>
                </div>
                <div class="setting-control">
                  <button class="action-btn" @click="exportAsJson">JSON</button>
                  <button class="action-btn" @click="exportAsMarkdown">Markdown</button>
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-label">
                  <Upload :size="15" :stroke-width="2.5" />
                  <span>导入数据</span>
                </div>
                <button class="action-btn" @click="() => importFromJson(() => flashSaved())">导入</button>
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
                <div class="setting-label shortcuts-title"><span>快捷键</span></div>
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

<style src="./Settings.css" />
