<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Minus, Plus, Trash2, Settings, Star } from 'lucide-vue-next'
import { useDragReorder } from '../composables/useDragReorder'

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
  (e: 'updateTitle', id: number, title: string): void
}>()

// ======== Pin menu ========
const contextMenuVisible = ref(false)
const contextMenuPageId = ref<number | null>(null)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function openPinMenu(index: number, rect: DOMRect) {
  contextMenuX.value = rect.left + rect.width / 2
  contextMenuY.value = rect.top - 16
  contextMenuPageId.value = props.pages[index].id
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
  contextMenuPageId.value = null
}

function handleTogglePin() {
  if (contextMenuPageId.value !== null) emit('togglePin', contextMenuPageId.value)
  closeContextMenu()
}

function isPagePinned(pageId: number): boolean {
  return !!props.pages.find((p) => p.id === pageId)?.pinned
}

// ======== Title editing ========
const TITLE_MAX_LENGTH = 5
const editingPageId = ref<number | null>(null)
const editingTitle = ref('')
const titleInputEl = ref<HTMLInputElement | null>(null)
const composing = ref(false)

function startEditTitle(page: Page) {
  editingPageId.value = page.id
  editingTitle.value = page.title || ''
  nextTick(() => titleInputEl.value?.focus())
}

function commitTitle() {
  if (editingPageId.value === null) return
  const id = editingPageId.value
  const title = editingTitle.value.trim()
  editingPageId.value = null
  emit('updateTitle', id, title)
}

function cancelEditTitle() {
  editingPageId.value = null
}

/** Handle input: block if over limit (except during IME composition). */
function onTitleInput(e: Event) {
  const el = e.target as HTMLInputElement
  const val = el.value
  if (composing) {
    // During IME composition: let it flow, state updates but DOM won't flicker
    // because composition text is transient
    editingTitle.value = val
    return
  }
  if (val.length > TITLE_MAX_LENGTH) {
    // Already over limit — clamp back without updating state
    el.value = val.slice(0, TITLE_MAX_LENGTH)
    return
  }
  editingTitle.value = val
}

/** IME composition end: clamp the final committed value. */
function onCompositionEnd(e: CompositionEvent) {
  composing.value = false
  const el = e.target as HTMLInputElement
  const val = el.value
  if (val.length > TITLE_MAX_LENGTH) {
    el.value = val.slice(0, TITLE_MAX_LENGTH)
  }
  editingTitle.value = el.value
}

/** Extract a short preview from the page for tooltip display. */
function getPageTitle(page: Page, index: number): string {
  if (page.title) return page.title
  if (!page.content) return `第 ${index + 1} 页`
  const text = page.content.replace(/<[^>]+>/g, '').trim()
  return text.length > 0 ? text.slice(0, TITLE_MAX_LENGTH) : `第 ${index + 1} 页`
}

// ======== Drag reorder ========
const {
  isDragging, cancelDrag,
  onPointerDown, canDrop, isDragTarget, isDragSource
} = useDragReorder(
  () => props.pages,
  { select: (i: number) => emit('select', i), reorder: (f: number, t: number) => emit('reorder', f, t) },
  openPinMenu
)

watch(() => props.isNotched, (v) => {
  if (v) closeContextMenu()
  if (v) cancelDrag()
  if (v) cancelEditTitle()
})
</script>

<template>
  <div class="toolbar" @click="(e) => { if (!(e.target as HTMLElement).closest('.page-dot-wrap') && !(e.target as HTMLElement).closest('.pin-menu')) closeContextMenu() }">
    <div class="toolbar-group">
      <button v-jelly class="tool-btn danger" @click="emit('delete')">
        <Minus :size="16" :stroke-width="2.5" />
      </button>
      <div class="page-dots" :class="{ 'no-drop': isDragging && !canDrop() }">
        <div v-for="(page, i) in pages" :key="page.id" class="page-dot-wrap" :data-title="getPageTitle(page, i)" :class="{
          active: i === currentIndex && !isDragging,
          'drag-source': isDragSource(i),
          'drag-target': isDragTarget(i)
        }" @pointerdown="onPointerDown($event, i)" @dblclick.stop="startEditTitle(page)">
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

  <!-- Inline title editor -->
  <Teleport to="body">
    <input
      v-if="editingPageId !== null"
      ref="titleInputEl"
      class="title-edit-input"
      type="text"
      :value="editingTitle"
      placeholder="输入标题..."
      :maxlength="TITLE_MAX_LENGTH"
      @input="onTitleInput"
      @compositionstart="composing = true"
      @compositionend="onCompositionEnd"
      @keydown.enter.prevent="commitTitle"
      @keydown.esc.prevent="cancelEditTitle"
      @blur="commitTitle"
    />
  </Teleport>

  <Teleport to="body">
    <div v-if="contextMenuVisible" class="pin-menu-overlay" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu">
      <div class="pin-menu" :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }" @click.stop="handleTogglePin">
        <Star :size="12" :stroke-width="2.5" :class="isPagePinned(contextMenuPageId!) ? 'menu-star-pinned' : 'menu-star-unpinned'" />
      </div>
    </div>
  </Teleport>
</template>

<style src="./TopToolbar.css" />
