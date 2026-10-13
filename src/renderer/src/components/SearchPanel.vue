<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { Search, X, CornerDownLeft } from 'lucide-vue-next'
import type { Page } from '../../types'

const props = defineProps<{ pages: Page[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'goto', index: number): void }>()

const keyword = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const selected = ref(0)

/** 纯文本预览:剥掉 HTML 标签与图片 */
function plainText(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const results = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return []
  const out: { index: number; title: string; excerpt: string }[] = []
  props.pages.forEach((page, index) => {
    const text = plainText(page.content || '')
    const haystack = ((page.title ? page.title + ' ' : '') + text).toLowerCase()
    const pos = haystack.indexOf(kw)
    if (pos < 0) return
    // 摘录:命中位置前后各留 30 字符
    const start = Math.max(0, pos - 30)
    const raw = text.length ? text : page.title || ''
    const rel = raw.toLowerCase().indexOf(kw)
    const excerpt =
      rel >= 0
        ? (start > 0 ? '…' : '') + raw.slice(Math.max(0, rel - 30), rel + kw.length + 30) + '…'
        : raw.slice(0, 60)
    out.push({ index, title: page.title || `第 ${index + 1} 页`, excerpt })
  })
  return out
})

function open() {
  keyword.value = ''
  selected.value = 0
  nextTick(() => inputEl.value?.focus())
}

function move(delta: number) {
  if (!results.value.length) return
  selected.value = (selected.value + delta + results.value.length) % results.value.length
}

function confirm() {
  const hit = results.value[selected.value]
  if (hit) {
    emit('goto', hit.index)
    emit('close')
  }
}

function onKeydown(e: KeyboardEvent) {
  // 中文输入法组合期间(选字/确认拼音)的 Enter、方向键不该被搜索面板消费
  if (e.isComposing) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    confirm()
  } else if (e.key === 'Escape') {
    emit('close')
  }
}

defineExpose({ open })

onMounted(() => {
  ;(document.activeElement as HTMLElement | null)?.blur()
})
</script>

<template>
  <Teleport to="body">
    <div class="search-overlay" @click.self="emit('close')">
      <div class="search-panel" @keydown="onKeydown">
        <div class="search-input-row">
          <Search :size="14" :stroke-width="2.5" class="search-icon" />
          <input
            ref="inputEl"
            v-model="keyword"
            class="search-input"
            type="text"
            placeholder="在所有页面中搜索…"
            autofocus
          />
          <button class="search-close" title="关闭" @click="emit('close')">
            <X :size="13" :stroke-width="2.5" />
          </button>
        </div>
        <div v-if="keyword && !results.length" class="search-empty">没有匹配的结果</div>
        <div v-else-if="results.length" class="search-results">
          <button
            v-for="(hit, i) in results"
            :key="hit.index"
            class="search-hit"
            :class="{ active: i === selected }"
            @mouseenter="selected = i"
            @click="confirm"
          >
            <span class="search-hit-title">{{ hit.title }}</span>
            <span class="search-hit-excerpt">{{ hit.excerpt }}</span>
          </button>
          <div class="search-hint">
            <CornerDownLeft :size="11" :stroke-width="2.5" /> 打开 · ↑↓ 切换 · Esc 关闭
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.search-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg, rgba(0, 0, 0, 0.4));
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 46px;
  z-index: 80;
  border-radius: 0 0 20px 20px;
}

.search-panel {
  width: min(420px, calc(100% - 32px));
  background: var(--bg-card, #0f1014);
  border: 1px solid var(--border-strong, #3a3a3c);
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.search-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #2a2a2c);
}

.search-icon {
  color: var(--text-secondary, #888);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary, #e5e5e5);
  font-size: 13px;
}

.search-close {
  border: none;
  background: none;
  color: var(--text-secondary, #888);
  cursor: pointer;
  padding: 2px;
  display: flex;
}

.search-close:hover {
  color: var(--text-primary, #e5e5e5);
}

.search-empty {
  padding: 18px 12px;
  text-align: center;
  color: var(--text-secondary, #888);
  font-size: 12px;
}

.search-results {
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
}

.search-hit {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
}

.search-hit.active {
  background: var(--active-bg, #3a3a3c);
}

.search-hit-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #e5e5e5);
}

.search-hit-excerpt {
  font-size: 11px;
  color: var(--text-secondary, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  font-size: 10px;
  color: var(--label-color, #aaa);
  border-top: 1px solid var(--divider, #2a2a2c);
}
</style>
