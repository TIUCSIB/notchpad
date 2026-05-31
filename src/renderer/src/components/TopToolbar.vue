<script setup lang="ts">
import { ref } from 'vue'
import { Minus, Plus, Trash2, Settings } from 'lucide-vue-next'

interface Page {
  id: number
  title: string
  content: string
  sort_order: number
  created_at: string
  updated_at: string
}

defineProps<{
  pages: Page[]
  currentIndex: number
  maxPages: number
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'add'): void
  (e: 'delete'): void
  (e: 'clear'): void
  (e: 'settings'): void
  (e: 'reorder', fromIndex: number, toIndex: number): void
}>()

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function onDragStart(e: DragEvent, index: number) {
  dragIndex.value = index
  e.dataTransfer!.effectAllowed = 'move'
  // Use a transparent drag image
  const img = document.createElement('div')
  img.style.opacity = '0'
  document.body.appendChild(img)
  e.dataTransfer!.setDragImage(img, 0, 0)
  setTimeout(() => document.body.removeChild(img), 0)
}

function onDragOver(e: DragEvent, index: number) {
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
</script>

<template>
  <div class="toolbar">
    <div class="toolbar-group">
      <button class="tool-btn danger" @click="emit('delete')">
        <Minus :size="16" :stroke-width="2.5" />
      </button>
      <div class="page-dots">
        <div
          v-for="(page, i) in pages"
          :key="page.id"
          class="page-dot-wrap"
          :class="{
            active: i === currentIndex,
            'drag-over-left': dragOverIndex === i && dragIndex !== null && dragIndex > i,
            'drag-over-right': dragOverIndex === i && dragIndex !== null && dragIndex < i
          }"
          draggable="true"
          @dragstart="onDragStart($event, i)"
          @dragover="onDragOver($event, i)"
          @dragend="onDragEnd"
          @drop="onDrop($event, i)"
          @click="emit('select', i)"
        >
          <div class="page-dot" />
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
</style>
