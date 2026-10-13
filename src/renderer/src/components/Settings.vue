<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import {
  Monitor,
  Palette,
  Type,
  Power,
  Download,
  Upload,
  RotateCcw,
  MousePointerClick,
  FolderOpen,
  Eraser,
  Files,
  RefreshCw,
  Info,
  Trash2,
  Clock,
  TextCursorInput
} from 'lucide-vue-next'
import { Motion, AnimatePresence } from 'motion-v'
import { exportAsJson, exportAsMarkdown, importFromJson } from '../utils/dataConverter'
import { SETTINGS_DEFAULTS } from '../composables/useSettings'
import { check } from '@tauri-apps/plugin-updater'
import { getVersion } from '@tauri-apps/api/app'
import { relaunch } from '@tauri-apps/plugin-process'
import type { DeletedPageSummary } from '../api/bridge'

const props = defineProps<{ visible: boolean; flushSave: () => Promise<void> }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'updateSettings', settings: Record<string, string>): void
}>()

const settings = ref<Record<string, string>>({ ...SETTINGS_DEFAULTS })

const showSaved = ref(false)
const savedText = ref('已保存')
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

// Database path
const dbPath = ref('')
const dbRelocating = ref(false)
const dbRelocateMsg = ref('')

// Attachment cleanup
const cleaningAttachments = ref(false)
const attachStats = ref<{ files: number; bytes: number } | null>(null)

// 回收站:24 小时内删除的页面,可一键恢复
const trashItems = ref<DeletedPageSummary[]>([])
const restoringId = ref<number | null>(null)
const trashOpen = ref(false)
// 设置面板分区:通用 / 数据 / 关于
const activeTab = ref<'general' | 'data' | 'shortcuts' | 'easter' | 'about'>('general')

/** 标题快照:与 usePages.getPageTitle 同规则(标题/正文前 8 字/空白页) */
function trashTitle(item: DeletedPageSummary): string {
  if (item.title) return item.title
  const text = (item.content || '')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()
  return text ? `「${text.slice(0, 8)}」` : '空白页'
}

function trashExcerpt(item: DeletedPageSummary): string {
  const text = (item.content || '')
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, 40) : '(空页面)'
}

async function refreshTrash() {
  trashItems.value = await window.api.listDeletedPages()
}

async function restoreFromTrash(id: number) {
  restoringId.value = id
  try {
    const ok = await window.api.restoreDeletedPage(id)
    flashSaved(ok ? '已恢复,页面列表已刷新' : '恢复失败')
    await refreshTrash()
    if (ok) emit('updateSettings', { ...settings.value, _reload: '1' })
  } finally {
    restoringId.value = null
  }
}

function toggleTrash() {
  trashOpen.value = !trashOpen.value
  if (trashOpen.value) refreshTrash()
}

// Update check
const currentVersion = ref('')
const checkingUpdate = ref(false)
const updateReady = ref(false)
const updateVersion = ref('')
let updatePending = false

/** 检查更新:有新版就下载,完成后提示重启应用 */
async function checkForUpdate() {
  if (checkingUpdate.value) return
  checkingUpdate.value = true
  try {
    const update = await check()
    if (!update) {
      flashSaved('当前已是最新版本')
      return
    }
    updateVersion.value = update.version
    flashSaved(`发现新版本 v${update.version},正在下载…`)
    await update.downloadAndInstall()
    updatePending = true
    updateReady.value = true
    flashSaved(`v${update.version} 就绪,点“重启更新”生效`)
  } catch (e) {
    console.error('[Notchpad] 检查更新失败:', e)
    flashSaved('检查更新失败,请检查网络')
  } finally {
    checkingUpdate.value = false
  }
}

async function applyUpdate() {
  if (!updatePending) return
  await relaunch()
}

function formatFreed(bytes?: number): string {
  if (!bytes) return ''
  return bytes >= 1024 * 1024
    ? `(释放 ${(bytes / 1024 / 1024).toFixed(1)} MB)`
    : `(释放 ${Math.max(1, Math.round(bytes / 1024))} KB)`
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

async function refreshAttachStats() {
  const res = await window.api.attachmentStats()
  if (res?.ok) attachStats.value = { files: res.files ?? 0, bytes: res.bytes ?? 0 }
}

/** 清理未被任何页面引用的附件文件(孤儿文件)。先 flush 保证引用最新 */
async function cleanOrphanAttachments() {
  cleaningAttachments.value = true
  try {
    await props.flushSave()
    const res = await window.api.cleanAttachments()
    if (res?.ok) {
      flashSaved(
        res.deleted
          ? `已清理 ${res.deleted} 个未引用附件${formatFreed(res.freed)}`
          : '没有需要清理的附件'
      )
      await refreshAttachStats()
    } else {
      flashSaved('清理失败: ' + (res?.error || '未知错误'))
    }
  } finally {
    cleaningAttachments.value = false
  }
}

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
  setTimeout(() => {
    dbRelocateMsg.value = ''
  }, 3000)
}

async function save(key: string, value: string) {
  settings.value[key] = value
  // 先同步到外层再落库:即使写库失败,界面状态也已更新(重试由用户发起)
  emit('updateSettings', { ...settings.value })
  try {
    await window.api.setSetting(key, value)
  } catch (e) {
    console.error('[Notchpad] setSetting failed:', key, e)
  }
  flashSaved()
}

/** 药丸显示来源开关(多选,存逗号分隔;全关 = off) */
function togglePillSource(key: 'clock' | 'quote' | 'weather' | 'custom') {
  const cur = new Set((settings.value.pillSources ?? 'off').split(',').map((x) => x.trim()))
  cur.delete('off')
  if (cur.has(key)) cur.delete(key)
  else cur.add(key)
  save('pillSources', cur.size ? Array.from(cur).join(',') : 'off')
}

function pillSourceActive(key: 'clock' | 'quote' | 'weather' | 'custom') {
  return (settings.value.pillSources ?? '').includes(key)
}

function flashSaved(text = '已保存') {
  savedText.value = text
  showSaved.value = true
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => {
    showSaved.value = false
  }, 1200)
}

/** 导入 JSON 备份,完成后通知外层重载页面列表 */
function handleImport() {
  importFromJson((imported, skipped) => {
    const parts = [imported > 0 ? `已导入 ${imported} 页` : '没有可导入的内容']
    if (skipped > 0) parts.push(`另有 ${skipped} 页超出 10 页上限被跳过`)
    flashSaved(parts.join(','))
    emit('updateSettings', { ...settings.value, _reload: '1' })
  })
}

async function handleReset() {
  await window.api.resetSettings()
  settings.value = { ...SETTINGS_DEFAULTS }
  emit('updateSettings', { ...settings.value })
  flashSaved()
}

watch(
  () => props.visible,
  (v) => {
    if (v) refreshTrash()
  }
)

onMounted(() => {
  loadSettings()
  loadDbPath()
  refreshAttachStats()
  refreshTrash()
  getVersion()
    .then((v) => (currentVersion.value = v))
    .catch(() => {})
})

onBeforeUnmount(() => {
  if (savedTimer) clearTimeout(savedTimer)
})
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <Motion
        v-if="visible"
        class="settings-overlay"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.25, ease: 'easeInOut' }"
        @click.self="emit('close')"
      >
        <Motion
          class="settings-panel"
          :initial="{ opacity: 0, y: -12, scale: 0.96 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :exit="{ opacity: 0, y: -12, scale: 0.96 }"
          :transition="{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }"
          @click.stop
        >
          <div class="settings-panel-inner">
            <div class="settings-body">
              <div class="settings-tabs">
                <button
                  v-for="t in [
                    { key: 'general', label: '通用' },
                    { key: 'data', label: '数据' },
                    { key: 'shortcuts', label: '快捷键' },
                    { key: 'easter', label: '彩蛋' },
                    { key: 'about', label: '关于' }
                  ]"
                  :key="t.key"
                  class="settings-tab"
                  :class="{ active: activeTab === t.key }"
                  @click="activeTab = t.key as 'general' | 'data' | 'shortcuts' | 'about'"
                >
                  {{ t.label }}
                </button>
              </div>
              <div v-if="activeTab === 'general'" class="settings-tabpane">
                <div class="setting-row">
                  <div class="setting-label">
                    <Monitor :size="15" :stroke-width="2.5" />
                    <span>主题</span>
                  </div>
                  <div class="setting-control">
                    <button
                      v-for="t in [
                        { key: 'dark', label: '深色' },
                        { key: 'light', label: '浅色' },
                        { key: 'system', label: '系统' }
                      ]"
                      :key="t.key"
                      class="theme-btn"
                      :class="{ active: settings.theme === t.key }"
                      @click="save('theme', t.key)"
                    >
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
                    <button
                      v-for="a in accentOptions"
                      :key="a.color"
                      class="color-dot"
                      :class="{ active: settings.accentColor === a.color }"
                      :style="{ background: a.color }"
                      @click="save('accentColor', a.color)"
                    />
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-label">
                    <Type :size="15" :stroke-width="2.5" />
                    <span>默认字号</span>
                  </div>
                  <div class="setting-control">
                    <select
                      class="native-select"
                      :value="settings.defaultFontSize"
                      @change="save('defaultFontSize', ($event.target as HTMLSelectElement).value)"
                    >
                      <option v-for="s in fontSizeOptions" :key="s" :value="s">{{ s }}</option>
                    </select>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-label">
                    <Files :size="15" :stroke-width="2.5" />
                    <span>页面数量上限</span>
                  </div>
                  <div class="setting-control">
                    <select
                      class="native-select"
                      :value="settings.maxPages"
                      @change="save('maxPages', ($event.target as HTMLSelectElement).value)"
                    >
                      <option v-for="n in [3, 5, 10, 15, 20, 30]" :key="n" :value="String(n)">
                        {{ n }} 页
                      </option>
                    </select>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-label">
                    <Power :size="15" :stroke-width="2.5" />
                    <span>开机自启</span>
                  </div>
                  <div class="setting-control">
                    <button
                      class="toggle-btn"
                      :class="{ active: settings.autoStart === 'true' }"
                      @click="save('autoStart', settings.autoStart === 'true' ? 'false' : 'true')"
                    >
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
                    <button
                      v-for="m in [
                        { key: 'hover', label: '悬浮' },
                        { key: 'click', label: '点击' }
                      ]"
                      :key="m.key"
                      class="theme-btn"
                      :class="{ active: settings.wakeMode === m.key }"
                      @click="save('wakeMode', m.key)"
                    >
                      {{ m.label }}
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="activeTab === 'easter'" class="settings-tabpane">
                <div class="setting-row">
                  <div class="setting-label">
                    <Clock :size="15" :stroke-width="2.5" />
                    <span>药丸显示</span>
                  </div>
                  <div class="setting-control">
                    <button
                      v-for="src in [
                        { key: 'clock', label: '时钟' },
                        { key: 'quote', label: '一言' },
                        { key: 'weather', label: '天气' },
                        { key: 'custom', label: '自定义' }
                      ]"
                      :key="src.key"
                      class="theme-btn"
                      :class="{ active: pillSourceActive(src.key) }"
                      @click="togglePillSource(src.key)"
                    >
                      {{ src.label }}
                    </button>
                  </div>
                </div>

                <div v-if="pillSourceActive('custom')" class="setting-row">
                  <div class="setting-label">
                    <TextCursorInput :size="15" :stroke-width="2.5" />
                    <span>自定义文字</span>
                  </div>
                  <div class="setting-control">
                    <input
                      class="pill-custom-input"
                      type="text"
                      :value="settings.pillCustomText || ''"
                      placeholder="显示在药丸上的文字…"
                      maxlength="30"
                      @change="
                        save('pillCustomText', ($event.target as HTMLInputElement).value.trim())
                      "
                    />
                  </div>
                </div>

                <div v-if="pillSourceActive('quote')" class="setting-row">
                  <div class="setting-label">
                    <span class="quote-cat-hint">一言来源</span>
                  </div>
                  <div class="setting-control">
                    <button
                      v-for="qs in [
                        { key: 'online', label: '在线' },
                        { key: 'local', label: '本地' }
                      ]"
                      :key="qs.key"
                      class="theme-btn"
                      :class="{ active: (settings.quoteSource || 'online') === qs.key }"
                      @click="save('quoteSource', qs.key)"
                    >
                      {{ qs.label }}
                    </button>
                  </div>
                </div>

                <template v-if="pillSourceActive('quote') && settings.quoteSource === 'online'">
                  <div class="setting-row">
                    <div class="setting-label">
                      <RefreshCw :size="15" :stroke-width="2.5" />
                      <span>一言更新</span>
                    </div>
                    <div class="setting-control">
                      <select
                        class="native-select"
                        :value="settings.quoteInterval"
                        @change="save('quoteInterval', ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="5min">每 5 分钟</option>
                        <option value="30min">每 30 分钟</option>
                        <option value="3hour">每 3 小时</option>
                        <option value="day">每天</option>
                        <option value="collapse">每次收起</option>
                        <option value="never">仅启用时</option>
                      </select>
                    </div>
                  </div>
                  <div class="setting-row">
                    <div class="setting-label">
                      <span class="quote-cat-hint">分类</span>
                    </div>
                    <div class="setting-control">
                      <select
                        class="native-select"
                        :value="settings.quoteCategories || ''"
                        @change="
                          save('quoteCategories', ($event.target as HTMLSelectElement).value)
                        "
                      >
                        <option value="">默认(全部)</option>
                        <option value="a">动画</option>
                        <option value="b">漫画</option>
                        <option value="c">游戏</option>
                        <option value="d">文学</option>
                        <option value="e">原创</option>
                        <option value="i">诗词</option>
                        <option value="k">哲学</option>
                      </select>
                    </div>
                  </div>
                </template>

                <template v-if="pillSourceActive('weather')">
                  <div class="setting-row">
                    <div class="setting-label">
                      <span class="quote-cat-hint">和风 Key</span>
                    </div>
                    <div class="setting-control">
                      <input
                        class="pill-custom-input"
                        type="text"
                        :value="settings.weatherApiKey || ''"
                        placeholder="和风天气开发者 Key…"
                        @change="
                          save('weatherApiKey', ($event.target as HTMLInputElement).value.trim())
                        "
                      />
                    </div>
                  </div>
                  <div class="setting-row">
                    <div class="setting-label">
                      <span class="quote-cat-hint">城市</span>
                    </div>
                    <div class="setting-control">
                      <input
                        class="pill-custom-input"
                        type="text"
                        :value="settings.weatherCity || ''"
                        placeholder="如:北京"
                        @change="
                          save('weatherCity', ($event.target as HTMLInputElement).value.trim())
                        "
                      />
                    </div>
                  </div>
                  <div class="setting-row">
                    <div class="setting-label">
                      <span class="quote-cat-hint">天气更新</span>
                    </div>
                    <div class="setting-control">
                      <select
                        class="native-select"
                        :value="settings.weatherInterval"
                        @change="
                          save('weatherInterval', ($event.target as HTMLSelectElement).value)
                        "
                      >
                        <option value="30min">每 30 分钟</option>
                        <option value="hour">每小时</option>
                        <option value="3hour">每 3 小时</option>
                        <option value="day">每天</option>
                        <option value="never">仅启用时</option>
                      </select>
                    </div>
                  </div>
                </template>
              </div>

              <div v-if="activeTab === 'data'" class="settings-tabpane">
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
                    <button class="action-btn" @click="exportAsJson(flushSave)">JSON</button>
                    <button class="action-btn" @click="exportAsMarkdown(flushSave)">
                      Markdown
                    </button>
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
                    <Eraser :size="15" :stroke-width="2.5" />
                    <span>附件清理</span>
                  </div>
                  <div class="setting-control db-path-control">
                    <span class="db-path-text">
                      {{
                        attachStats
                          ? `${attachStats.files} 个文件 / ${formatBytes(attachStats.bytes)}`
                          : ' '
                      }}
                    </span>
                    <button
                      class="action-btn"
                      :disabled="cleaningAttachments"
                      @click="cleanOrphanAttachments"
                    >
                      {{ cleaningAttachments ? '清理中...' : '清理未引用附件' }}
                    </button>
                  </div>
                </div>

                <div class="setting-divider" />

                <div class="setting-row">
                  <div class="setting-label">
                    <Trash2 :size="15" :stroke-width="2.5" />
                    <span>回收站</span>
                  </div>
                  <button class="action-btn" @click="toggleTrash">
                    {{ trashOpen ? '收起' : `最近 24 小时 (${trashItems.length})` }}
                  </button>
                </div>
                <div v-if="trashOpen" class="trash-list">
                  <div v-if="!trashItems.length" class="trash-empty">暂无可恢复的页面</div>
                  <div v-for="item in trashItems" :key="item.id" class="trash-item">
                    <div class="trash-item-text">
                      <span class="trash-item-title">{{ trashTitle(item) }}</span>
                      <span class="trash-item-meta"
                        >{{ item.deleted_at }} · {{ trashExcerpt(item) }}</span
                      >
                    </div>
                    <button
                      class="action-btn"
                      :disabled="restoringId === item.id"
                      @click="restoreFromTrash(item.id)"
                    >
                      {{ restoringId === item.id ? '恢复中…' : '恢复' }}
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="activeTab === 'about'" class="settings-tabpane">
                <div class="setting-row">
                  <div class="setting-label">
                    <Info :size="15" :stroke-width="2.5" />
                    <span>当前版本</span>
                  </div>
                  <div class="setting-control">
                    <span class="version-text">v{{ currentVersion }}</span>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-label">
                    <RefreshCw :size="15" :stroke-width="2.5" />
                    <span>{{ updateReady ? `v${updateVersion} 已就绪` : '检查更新' }}</span>
                  </div>
                  <button
                    class="action-btn"
                    :disabled="checkingUpdate"
                    @click="updateReady ? applyUpdate() : checkForUpdate()"
                  >
                    {{ checkingUpdate ? '检查中…' : updateReady ? '重启更新' : '检查' }}
                  </button>
                </div>

                <div class="setting-divider" />

                <div class="setting-row">
                  <div class="setting-label">
                    <RotateCcw :size="15" :stroke-width="2.5" />
                    <span>恢复默认</span>
                  </div>
                  <button class="action-btn danger" @click="handleReset">重置</button>
                </div>
              </div>

              <div v-if="activeTab === 'shortcuts'" class="settings-tabpane">
                <div class="shortcuts-section">
                  <div class="setting-label shortcuts-title"><span>快捷键</span></div>
                  <div class="shortcuts-list">
                    <div class="shortcut-row"><kbd>Ctrl+N</kbd> <span>新建页面</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+D</kbd> <span>删除页面</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+F</kbd> <span>跨页搜索</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+S</kbd> <span>保存</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+Z</kbd> <span>撤销</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+Y</kbd> <span>重做</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+W</kbd> <span>最小化</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+Alt+Z</kbd> <span>打开窗口</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+Shift+M</kbd> <span>切换显示器</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+Tab</kbd> <span>下一页</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+Shift+Tab</kbd> <span>上一页</span></div>
                    <div class="shortcut-row"><kbd>Ctrl+1~9</kbd> <span>跳转对应页</span></div>
                  </div>
                </div>
              </div>
            </div>

            <Transition name="toast">
              <div v-if="showSaved" class="saved-toast">{{ savedText }}</div>
            </Transition>
          </div>
        </Motion>
      </Motion>
    </AnimatePresence>
  </Teleport>
</template>

<style src="./Settings.css" />
