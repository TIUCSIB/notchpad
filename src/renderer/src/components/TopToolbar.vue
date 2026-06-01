<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
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

watch(
  () => props.isNotched,
  (v) => {
    if (v) closeContextMenu()
    if (v) cancelDrag()
  }
)

// ======== Custom pointer drag ========
const isDragging = ref(false)
const dragFromIndex = ref<number | null>(null)
const dragToIndex = ref<number | null>(null)
let dragGhost: HTMLElement | null = null
let startX = 0
let startY = 0
let dragStarted = false
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const DRAG_THRESHOLD = 4

function onDotPointerDown(e: PointerEvent, index: number) {
  if (e.button !== 0) return
  if (contextMenuVisible.value) return

  // Capture DOM ref now 鈥?event object gets recycled by browser after handler returns
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  startX = e.clientX
  startY = e.clientY
  dragStarted = false
  dragFromIndex.value = index

  longPressTimer = setTimeout(() => {
    longPressTimer = null
    contextMenuX.value = rect.left + rect.width / 2
    contextMenuY.value = rect.top - 16
    contextMenuPageId.value = props.pages[index].id
    contextMenuVisible.value = true
    cancelDrag()
  }, 500)

  document.addEventListener('pointermove', onGlobalPointerMove)
  document.addEventListener('pointerup', onGlobalPointerUp)
}

function onGlobalPointerMove(e: PointerEvent) {
  if (dragFromIndex.value === null) return

  const dx = e.clientX - startX
  const dy = e.clientY - startY

  if (!dragStarted) {
    if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    dragStarted = true
    isDragging.value = true
    createGhost(e.clientX, e.clientY)
  }

  if (dragGhost) {
    dragGhost.style.left = e.clientX + 'px'
    dragGhost.style.top = e.clientY + 'px'
  }

  updateDragTarget(e.clientX, e.clientY)
}

function onGlobalPointerUp(_e: PointerEvent) {
  document.removeEventListener('pointermove', onGlobalPointerMove)
  document.removeEventListener('pointerup', onGlobalPointerUp)

  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }

  if (dragStarted && dragFromIndex.value !== null && dragToIndex.value !== null) {
    if (dragFromIndex.value !== dragToIndex.value) {
      emit('reorder', dragFromIndex.value, dragToIndex.value)
    }
  } else if (!dragStarted && dragFromIndex.value !== null) {
    emit('select', dragFromIndex.value)
  }

  cancelDrag()
}

function cancelDrag() {
  isDragging.value = false
  dragFromIndex.value = null
  dragToIndex.value = null
  dragStarted = false
  removeGhost()
}

function createGhost(x: number, y: number) {
  removeGhost()
  dragGhost = document.createElement('div')
  dragGhost.className = 'drag-ghost'
  document.body.appendChild(dragGhost)
  dragGhost.style.left = x + 'px'
  dragGhost.style.top = y + 'px'
}

function removeGhost() {
  if (dragGhost) {
    dragGhost.remove()
    dragGhost = null
  }
}

function updateDragTarget(x: number, y: number) {
  const dotsEl = document.querySelector('.page-dots')
  if (!dotsEl) {
    dragToIndex.value = null
    return
  }

  const wraps = dotsEl.querySelectorAll('.page-dot-wrap')
  let closest: number | null = null
  let closestDist = Infinity

  wraps.forEach((el, i) => {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const dist = Math.abs(x - cx)
    if (dist < closestDist) {
      closestDist = dist
      closest = i
    }
  })

  if (closest === null || closestDist > 40) {
    dragToIndex.value = null
    return
  }

  const fromPinned = props.pages[dragFromIndex.value!]?.pinned
  const toPinned = props.pages[closest!]?.pinned
  if (fromPinned !== toPinned) {
    dragToIndex.value = null
    return
  }

  dragToIndex.value = closest
}

function canDrop(): boolean {
  return dragToIndex.value !== null
}

function isDragTarget(i: number): boolean {
  return isDragging.value && dragToIndex.value === i && dragFromIndex.value !== i
}

function isDragSource(i: number): boolean {
  return isDragging.value && dragFromIndex.value === i
}

// ======== Long press / context menu ========
const contextMenuVisible = ref(false)
const contextMenuPageId = ref<number | null>(null)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function handleTogglePin() {
  if (contextMenuPageId.value !== null) {
    emit('togglePin', contextMenuPageId.value)
  }
  closeContextMenu()
}

function onToolbarClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (
    !target.closest('.page-dot-wrap') &&
    !target.closest('.pin-menu') &&
    contextMenuVisible.value
  ) {
    closeContextMenu()
  }
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuPageId.value = null
}

function isPagePinned(pageId: number): boolean {
  const page = props.pages.find((p) => p.id === pageId)
  return page ? !!page.pinned : false
}

onUnmounted(() => {
  document.removeEventListener('pointermove', onGlobalPointerMove)
  document.removeEventListener('pointerup', onGlobalPointerUp)
  if (longPressTimer) clearTimeout(longPressTimer)
  removeGhost()
})
</script>

<template>
  <div class="toolbar" @click="onToolbarClick">
    <div class="toolbar-group">
      <button v-jelly class="tool-btn danger" @click="emit('delete')">
        <Minus :size="16" :stroke-width="2.5" />
      </button>
      <div class="page-dots" :class="{ 'no-drop': isDragging && !canDrop() }">
        <div v-for="(page, i) in pages" :key="page.id" class="page-dot-wrap" :class="{
          active: i === currentIndex && !isDragging,
          'drag-source': isDragSource(i),
          'drag-target': isDragTarget(i)
        }" @pointerdown="onDotPointerDown($event, i)">
          <div class="page-dot" />
          <Star v-if="page.pinned" :size="8" :stroke-width="2" class="pin-star" />
        </div>
      </div>
      <button v-jelly class="tool-btn" :disabled="pages.length >= maxPages" @click="emit('add')">
        <Plus :size="16" :stroke-width="2.5" />
      </button>
    </div>
    <div class="toolbar-spacer"></div>
    <button v-jelly class="tool-btn standalone" @click="emit('clear')">
      <Trash2 :size="16" :stroke-width="2.5" />
    </button>
    <button v-jelly class="tool-btn standalone" @click="emit('settings')">
      <Settings :size="16" :stroke-width="2.5" />
    </button>
  </div>

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
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-toolbar, #151516);
  border-radius: 8px;
  overflow: hidden;
  padding: 1px 6px;
}

.tool-btn {
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
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 2px;
}

.page-dots.no-drop {
  cursor: not-allowed;
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
  touch-action: none;
  user-select: none;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.page-dot-wrap:active {
  transform: scale(0.85);
}

.page-dot-wrap.drag-source {
  opacity: 0.35;
}

.page-dot-wrap.drag-target .page-dot {
  box-shadow:
    0 0 0 2px var(--accent, #4ade80),
    0 0 8px rgba(74, 222, 128, 0.3);
}

.page-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #aaa;
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
  height: 8px;
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
.drag-ghost {
  position: fixed;
  z-index: 99999;
  width: 20px;
  height: 8px;
  border-radius: 4px;
  background: var(--accent, #4ade80);
  opacity: 0.85;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: translate(-50%, -50%) scale(1.5);
  pointer-events: none;
  transition: none;
}

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
