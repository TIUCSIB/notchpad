<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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
  TextCursorInput,
  Image as ImageIcon,
  Droplets,
  Waves,
  Contrast,
  Focus
} from 'lucide-vue-next'
import { Motion, AnimatePresence } from 'motion-v'
import { exportAsJson, exportAsMarkdown, importFromJson } from '../utils/dataConverter'
import { SETTINGS_DEFAULTS } from '../composables/useSettings'
import { extractPageTitle } from '../utils/pageTitle'
import { THEME_PRESETS, type ThemeMode, type ThemePreset } from '../themes'
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

const BASE_ACCENTS = ['#4ade80', '#60a5fa', '#f87171', '#fbbf24', '#c084fc', '#fb923c', '#e5e5e5']

/** 强调色 = 基础色板 + 各风格包的推荐色,方便选中风格后仍能一眼看到当前色 */
const accentOptions = Array.from(
  new Set([
    ...BASE_ACCENTS,
    ...THEME_PRESETS.flatMap((t) => [t.defaultAccent.light, t.defaultAccent.dark])
  ])
).map((color) => ({ color }))

const fontSizeOptions = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

// Database path
const dbPath = ref('')
const dbRelocating = ref(false)
const dbRelocateMsg = ref('')

// Attachment cleanup
const cleaningAttachments = ref(false)
const attachStats = ref<{ files: number; bytes: number } | null>(null)

// 面板壁纸:上传后压缩、算平均亮度,再复用附件接口落盘
const wallpaperInput = ref<HTMLInputElement | null>(null)
const uploadingWallpaper = ref(false)
const WALLPAPER_MAX_EDGE = 2560

// 回收站:24 小时内删除的页面,可一键恢复
const trashItems = ref<DeletedPageSummary[]>([])
const restoringId = ref<number | null>(null)
const trashOpen = ref(false)
// 设置面板分区:外观 / 通用 / 数据 / 快捷键 / 彩蛋 / 关于
type SettingsTab = 'appearance' | 'general' | 'data' | 'shortcuts' | 'easter' | 'about'
const tabs: { key: SettingsTab; label: string }[] = [
  { key: 'appearance', label: '外观' },
  { key: 'general', label: '通用' },
  { key: 'data', label: '数据' },
  { key: 'shortcuts', label: '快捷键' },
  { key: 'easter', label: '彩蛋' },
  { key: 'about', label: '关于' }
]
const activeTab = ref<SettingsTab>('general')

// 风格卡预览跟随当前模式;系统模式取 OS 当前明暗
const osMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
const previewMode = computed<ThemeMode>(() => {
  if (settings.value.theme === 'light') return 'light'
  if (settings.value.theme === 'dark') return 'dark'
  return osMediaQuery.matches ? 'dark' : 'light'
})

function previewPalette(theme: ThemePreset) {
  return previewMode.value === 'dark' ? theme.dark : theme.light
}

function themeAccent(theme: ThemePreset) {
  return theme.defaultAccent[previewMode.value]
}

/** 选风格包时把推荐强调色一起带上,之后仍可单独换色 */
async function chooseTheme(theme: ThemePreset) {
  const accent = themeAccent(theme)
  settings.value.themeId = theme.id
  settings.value.accentColor = accent
  emit('updateSettings', { ...settings.value })
  try {
    await window.api.setSetting('themeId', theme.id)
    await window.api.setSetting('accentColor', accent)
  } catch (e) {
    console.error('[Notchpad] setSetting theme failed:', e)
  }
  flashSaved()
}

/** 标题快照:优先正文一级标题,其次导入时留下的旧标题快照,最后退回正文前 8 字 */
function trashTitle(item: DeletedPageSummary): string {
  const heading = extractPageTitle(item.content)
  if (heading) return heading
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

/** 一次写多组设置:壁纸上传要同时落 URL 与亮度,避免多轮 emit */
async function saveMany(pairs: Record<string, string>) {
  Object.assign(settings.value, pairs)
  // 先同步到外层再落库:即使写库失败,界面状态也已更新(重试由用户发起)
  emit('updateSettings', { ...settings.value })
  try {
    for (const [key, value] of Object.entries(pairs)) await window.api.setSetting(key, value)
  } catch (e) {
    console.error('[Notchpad] setSetting failed:', e)
  }
  flashSaved()
}

async function save(key: string, value: string) {
  await saveMany({ [key]: value })
}

/** 滑块拖动时只更新内存/预览,松手(@change)才落库,避免每帧写盘 */
function previewSetting(key: string, value: string) {
  settings.value[key] = value
  emit('updateSettings', { ...settings.value })
}

/**
 * 图片 -> 压缩后的 JPEG dataURL + 8x8 采样得到的明暗。
 * 最长边压到 2560,避免整图壁纸撑爆附件目录。
 */
async function prepareWallpaper(file: File): Promise<{ dataUrl: string; tone: string }> {
  const raw = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error ?? new Error('读取图片失败'))
    fr.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('图片解码失败'))
    el.src = raw
  })

  const scale = Math.min(1, WALLPAPER_MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画布不可用')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)

  // 8x8 缩略图算感知亮度,阈值 128 定明暗,给文字色 auto 用
  const sample = document.createElement('canvas')
  sample.width = 8
  sample.height = 8
  const sctx = sample.getContext('2d')
  if (!sctx) throw new Error('画布不可用')
  sctx.drawImage(img, 0, 0, 8, 8)
  const pixels = sctx.getImageData(0, 0, 8, 8).data
  let sum = 0
  for (let i = 0; i < pixels.length; i += 4) {
    sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), tone: sum / 64 >= 128 ? 'light' : 'dark' }
}

async function handleWallpaperFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // 立刻清空,保证连续选同一个文件也能触发 change
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    flashSaved('请选择图片文件')
    return
  }
  uploadingWallpaper.value = true
  try {
    const { dataUrl, tone } = await prepareWallpaper(file)
    const res = await window.api.saveAttachment(dataUrl)
    if (!res.ok || !res.url) throw new Error(res.error || '保存失败')
    // 换新壁纸时文字色跟随新图重新 auto;旧附件留待启动清理变孤儿
    await saveMany({
      wallpaperUrl: res.url,
      wallpaperTone: tone,
      wallpaperText: 'auto'
    })
    flashSaved(tone === 'dark' ? '壁纸已应用 · 暗色' : '壁纸已应用 · 亮色')
  } catch (err) {
    console.error('[Notchpad] 壁纸上传失败:', err)
    flashSaved('壁纸上传失败:' + (err instanceof Error ? err.message : '未知错误'))
  } finally {
    uploadingWallpaper.value = false
  }
}

async function removeWallpaper() {
  await saveMany({ wallpaperUrl: '' })
  flashSaved('已移除壁纸')
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
                  v-for="t in tabs"
                  :key="t.key"
                  class="settings-tab"
                  :class="{ active: activeTab === t.key }"
                  @click="activeTab = t.key"
                >
                  {{ t.label }}
                </button>
              </div>
              <div v-if="activeTab === 'appearance'" class="settings-tabpane">
                <div class="setting-row">
                  <div class="setting-label">
                    <Monitor :size="15" :stroke-width="2.5" />
                    <span>模式</span>
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

                <div class="theme-section">
                  <div class="theme-section-head">
                    <div class="setting-label">
                      <Palette :size="15" :stroke-width="2.5" />
                      <span>风格</span>
                    </div>
                    <span class="theme-hint">切换时套用推荐强调色</span>
                  </div>
                  <div class="theme-grid">
                    <button
                      v-for="t in THEME_PRESETS"
                      :key="t.id"
                      class="theme-card"
                      :class="{ active: settings.themeId === t.id }"
                      @click="chooseTheme(t)"
                    >
                      <span class="theme-preview" :style="{ background: previewPalette(t).bgMain }">
                        <span
                          class="theme-preview-card"
                          :style="{
                            background: previewPalette(t).bgCard,
                            borderColor: previewPalette(t).border
                          }"
                        >
                          <span
                            class="theme-preview-title"
                            :style="{
                              background: previewPalette(t).textPrimary,
                              fontFamily: t.headingFont
                            }"
                          />
                          <span
                            class="theme-preview-line"
                            :style="{ background: previewPalette(t).textSecondary }"
                          />
                        </span>
                        <span
                          class="theme-preview-accent"
                          :style="{ background: themeAccent(t) }"
                        />
                      </span>
                      <span class="theme-card-name">{{ t.name }}</span>
                      <span class="theme-card-desc">{{ t.description }}</span>
                    </button>
                  </div>
                </div>

                <div class="setting-row">
                  <div class="setting-label">
                    <Palette :size="15" :stroke-width="2.5" />
                    <span>强调色</span>
                  </div>
                  <div class="setting-control color-grid accent-grid">
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

                <div class="setting-divider" />

                <div class="setting-row">
                  <div class="setting-label">
                    <ImageIcon :size="15" :stroke-width="2.5" />
                    <span>面板壁纸</span>
                  </div>
                  <div class="setting-control">
                    <input
                      ref="wallpaperInput"
                      type="file"
                      accept="image/*"
                      class="wallpaper-file-input"
                      @change="handleWallpaperFile"
                    />
                    <button
                      class="action-btn"
                      :disabled="uploadingWallpaper"
                      @click="wallpaperInput?.click()"
                    >
                      {{ uploadingWallpaper ? '处理中…' : settings.wallpaperUrl ? '更换' : '上传' }}
                    </button>
                    <button
                      v-if="settings.wallpaperUrl"
                      class="action-btn"
                      @click="removeWallpaper"
                    >
                      移除
                    </button>
                  </div>
                </div>

                <div v-if="settings.wallpaperUrl" class="wallpaper-preview">
                  <img :src="settings.wallpaperUrl" alt="壁纸预览" />
                  <span class="wallpaper-preview-tip">
                    已应用 · 自动识别为{{ settings.wallpaperTone === 'dark' ? '暗' : '亮' }}色壁纸
                  </span>
                </div>

                <template v-if="settings.wallpaperUrl">
                  <div class="setting-row">
                    <div class="setting-label">
                      <Contrast :size="15" :stroke-width="2.5" />
                      <span>内容区透明度</span>
                    </div>
                    <div class="setting-control">
                      <input
                        type="range"
                        class="setting-range"
                        min="0"
                        max="100"
                        step="1"
                        :value="settings.wallpaperOpacity || '78'"
                        @input="
                          previewSetting(
                            'wallpaperOpacity',
                            ($event.target as HTMLInputElement).value
                          )
                        "
                        @change="
                          save('wallpaperOpacity', ($event.target as HTMLInputElement).value)
                        "
                      />
                      <span class="range-value">{{ settings.wallpaperOpacity || '78' }}%</span>
                    </div>
                  </div>

                  <div class="setting-row">
                    <div class="setting-label">
                      <Focus :size="15" :stroke-width="2.5" />
                      <span>内容区毛玻璃</span>
                    </div>
                    <div class="setting-control">
                      <input
                        type="range"
                        class="setting-range"
                        min="0"
                        max="20"
                        step="1"
                        :value="settings.wallpaperCardBlur ?? '6'"
                        @input="
                          previewSetting(
                            'wallpaperCardBlur',
                            ($event.target as HTMLInputElement).value
                          )
                        "
                        @change="
                          save('wallpaperCardBlur', ($event.target as HTMLInputElement).value)
                        "
                      />
                      <span class="range-value">{{ settings.wallpaperCardBlur ?? '6' }}px</span>
                    </div>
                  </div>

                  <div class="setting-row">
                    <div class="setting-label">
                      <Droplets :size="15" :stroke-width="2.5" />
                      <span>遮罩浓度</span>
                    </div>
                    <div class="setting-control">
                      <input
                        type="range"
                        class="setting-range"
                        min="0"
                        max="80"
                        step="5"
                        :value="settings.wallpaperScrim || '25'"
                        @input="
                          previewSetting(
                            'wallpaperScrim',
                            ($event.target as HTMLInputElement).value
                          )
                        "
                        @change="save('wallpaperScrim', ($event.target as HTMLInputElement).value)"
                      />
                      <span class="range-value">{{ settings.wallpaperScrim || '25' }}%</span>
                    </div>
                  </div>

                  <div class="setting-row">
                    <div class="setting-label">
                      <Waves :size="15" :stroke-width="2.5" />
                      <span>壁纸模糊</span>
                    </div>
                    <div class="setting-control">
                      <input
                        type="range"
                        class="setting-range"
                        min="0"
                        max="12"
                        step="1"
                        :value="settings.wallpaperBlur || '0'"
                        @input="
                          previewSetting('wallpaperBlur', ($event.target as HTMLInputElement).value)
                        "
                        @change="save('wallpaperBlur', ($event.target as HTMLInputElement).value)"
                      />
                      <span class="range-value">{{ settings.wallpaperBlur || '0' }}px</span>
                    </div>
                  </div>

                  <div class="setting-row">
                    <div class="setting-label">
                      <Type :size="15" :stroke-width="2.5" />
                      <span>文字色</span>
                    </div>
                    <div class="setting-control">
                      <button
                        v-for="wt in [
                          { key: 'auto', label: '自动' },
                          { key: 'light', label: '浅' },
                          { key: 'dark', label: '深' }
                        ]"
                        :key="wt.key"
                        class="theme-btn"
                        :class="{ active: (settings.wallpaperText || 'auto') === wt.key }"
                        @click="save('wallpaperText', wt.key)"
                      >
                        {{ wt.label }}
                      </button>
                    </div>
                  </div>
                </template>
              </div>

              <div v-if="activeTab === 'general'" class="settings-tabpane">
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
                      <span class="quote-cat-hint">API Host</span>
                    </div>
                    <div class="setting-control">
                      <input
                        class="pill-custom-input"
                        type="text"
                        :value="settings.weatherApiHost || ''"
                        placeholder="留空走公共域名;新账号填控制台分配的 Host"
                        @change="
                          save('weatherApiHost', ($event.target as HTMLInputElement).value.trim())
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
