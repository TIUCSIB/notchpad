<script setup lang="ts">
import { ref, watch } from 'vue'
import { Minus, Plus, Trash2, Settings, Star } from 'lucide-vue-next'

interface Page {
  id: number
  title: string
  content: string
  sort_order: number
  pinned: number
  created_at: string
  updated_at: string
}

const props = defineProps<{
  pages: Page[]
  currentIndex: number
  maxPages: number
  isNotched: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'add'): void
  (e: 'delete'): void
  (e: 'clear'): void
  (e: 'settings'): void
  (e: 'reorder', fromIndex: number, toIndex: number): void
  (e: 'togglePin', id: number): void
}>()

// Close menu when notch collapses
watch(
  () => props.isNotched,
  (v) => {
    if (v) closeContextMenu()
  }
)

// --- Drag state ---
const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  const img = document.createElement('div')
  img.style.opacity = '0'
  document.body.appendChild(img)
  e.dataTransfer!.setDragImage(img, 0, 0)
  setTimeout(() => document.body.removeChild(img), 0)
}

function onDragOver(e: DragEvent, index: number) {
  if (dragIndex.value !== null) {
    const srcPinned = props.pages[dragIndex.value]?.pinned
    const dstPinned = props.pages[index]?.pinned
    if (srcPinned !== dstPinned) {
      e.dataTransfer!.dropEffect = 'none'
      return
    }
  }
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDragEnd() {
  if (
    dragIndex.value !== null &&
    dragOverIndex.value !== null &&
    dragIndex.value !== dragOverIndex.value
  ) {
    emit('reorder', dragIndex.value, dragOverIndex.value)
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

function onDrop(e: DragEvent, index: number) {
  e.preventDefault()
  if (dragIndex.value !== null && dragIndex.value !== index) {
    emit('reorder', dragIndex.value, index)
  }
  dragIndex.value = null
  dragOverIndex.value = null
}

// --- Long press ---
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const contextMenuVisible = ref(false)
const contextMenuPageId = ref<number | null>(null)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function onPointerDown(e: PointerEvent, index: number) {
  if (e.button !== 0) return
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    const rect = target.getBoundingClientRect()
    contextMenuX.value = rect.left + rect.width / 2
    contextMenuY.value = rect.top - 16
    contextMenuPageId.value = props.pages[index].id
    contextMenuVisible.value = true
  }, 500)
}

function onPointerUp(_e: PointerEvent, index: number) {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
    emit('select', index)
  }
}

function onPointerCancel() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleTogglePin() {
  if (contextMenuPageId.value !== null) {
    emit('togglePin', contextMenuPageId.value)
  }
  closeContextMenu()
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuPageId.value = null
}

function isPagePinned(pageId: number): boolean {
  const page = props.pages.find((p) => p.id === pageId)
  return page ? !!page.pinned : false
}
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <button class="tool-btn danger" @click="emit('delete')">
        <Minus :size="16" :stroke-width="2.5" />
      </button>
      <div class="page-dots">
        <div v-for="(page, i) in pages" :key="page.id" class="page-dot-wrap" :class="{
          active: i === currentIndex,
          'drag-over-left': dragOverIndex === i && dragIndex !== null && dragIndex > i,
          'drag-over-right': dragOverIndex === i && dragIndex !== null && dragIndex < i
        }" draggable="true" @dragstart="onDragStart($event, i)" @dragover="onDragOver($event, i)"
          @dragend="onDragEnd" @drop="onDrop($event, i)" @pointerdown="onPointerDown($event, i)"
          @pointerup="onPointerUp($event, i)" @pointercancel="onPointerCancel" @pointerleave="onPointerCancel">
          <div class="page-dot" />
          <Star v-if="page.pinned" :size="8" :stroke-width="2" class="pin-star" />
        </div>
      </div>
      <button class="tool-btn" :disabled="pages.length >= maxPages" @click="emit('add')">
        <Plus :size="16" :stroke-width="2.5" />
      </button>
    </div>
    <div class="toolbar-spacer"></div>
    <button class="tool-btn standalone" @click="emit('clear')">
      <Trash2 :size="16" :stroke-width="2.5" />
    </button>
    <button class="tool-btn standalone" @click="emit('settings')">
      <Settings :size="16" :stroke-width="2.5" />
    </button>
  </div>

  <!-- Pin context menu -->
  <Teleport to="body">
    <div v-if="contextMenuVisible" class="pin-menu-overlay" @click="closeContextMenu"
      @contextmenu.prevent="closeContextMenu">
      <div class="pin-menu" :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop="handleTogglePin">
        <Star :size="12" :stroke-width="2.5"
          :class="isPagePinned(contextMenuPageId!) ? 'menu-star-pinned' : 'menu-star-unpinned'" />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 40px;
  padding: 4px 22px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-group {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-toolbar, #151516);
  border-radius: 8px;
  overflow: hidden;
  padding: 1px 6px;
}

.tool-btn {
  -webkit-app-region: no-drag;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  border-radius: 6px;
  color: var(--text-secondary, #888);
  cursor: pointer;
}

.toolbar-group .tool-btn:hover:not(:disabled),
.tool-btn.standalone:hover {
  background: var(--hover-bg, #3a3a3a);
  color: var(--text-primary, #e5e5e5);
}

.toolbar-group .tool-btn.danger:hover {
  background: var(--danger-bg, rgba(220, 38, 38, 0.1));
  color: var(--danger-text, #dc2626);
}

.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-dots {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px;
}

.page-dot-wrap {
  width: 20px;
  height: 8px;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  border: none;
  padding: 0;
  position: relative;
  transition: transform 0.15s ease;
}

.page-dot-wrap:active {
  transform: scale(0.9);
}

.page-dot-wrap.drag-over-left {
  box-shadow: -3px 0 0 0 var(--accent, #4ade80);
}

.page-dot-wrap.drag-over-right {
  box-shadow: 3px 0 0 0 var(--accent, #4ade80);
}

.page-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary, #555);
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  transition:
    width 0.2s ease,
    border-radius 0.2s ease,
    background 0.2s,
    box-shadow 0.2s;
}

.page-dot-wrap.active .page-dot {
  width: 20px;
  border-radius: 4px;
  background: var(--accent, #4ade80);
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.3);
}

.pin-star {
  position: absolute;
  top: -6px;
  right: -2px;
  z-index: 2;
  pointer-events: none;
  color: #fbbf24;
  fill: #fbbf24;
}
</style>

<style>
.pin-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
}

.pin-menu {
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--bg-card, #1a1a1c);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  transform: translate(-50%, -100%);
  transition: background 0.12s;
}

.pin-menu:hover {
  background: var(--hover-bg, #3a3a3a);
}

.menu-star-pinned {
  color: #fbbf24;
  fill: #fbbf24;
}

.menu-star-unpinned {
  color: var(--text-secondary, #888);
  fill: none;
}
</style>
