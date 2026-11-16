<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Plus, Star, X } from 'lucide-vue-next'
import { useDragReorder } from '../composables/useDragReorder'
import type { Page } from '../../types'

const props = defineProps<{
  pages: Page[]
  /** 每个标签显示的名字,与 pages 一一对应(App 里按正文一级标题推导) */
  titles: string[]
  currentIndex: number
  maxPages: number
  isNotched: boolean
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'add'): void
  (e: 'delete'): void
  (e: 'reorder', fromIndex: number, toIndex: number): void
  (e: 'togglePin', id: number): void
}>()

// ======== Pin menu ========
const contextMenuVisible = ref(false)
const contextMenuPageId = ref<number | null>(null)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function openPinMenu(index: number, rect: DOMRect) {
  // 标签紧贴窗口顶部,菜单向下展开;左右钳制半个菜单宽度,避免贴边被裁
  const half = 14
  contextMenuX.value = Math.min(
    Math.max(rect.left + rect.width / 2, half + 6),
    window.innerWidth - half - 6
  )
  contextMenuY.value = rect.bottom + 6
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

// 页数到上限时不显示为原生 disabled —— 那样浏览器的 not-allowed 光标还在,
// 但 title 提示会被禁用元素吞掉;这里自己拦点击,让提示能解释原因
function handleAdd() {
  if (props.pages.length >= props.maxPages) return
  emit('add')
}

// 关闭按钮常驻 DOM 只做宽度动画,这里再守一道,避免隐藏态误删非当前页
function handleClose(index: number) {
  if (index === props.currentIndex) emit('delete')
}

// ======== Tab strip: keep active tab in view / wheel scroll ========
const tabsEl = ref<HTMLElement | null>(null)
// 标签放不下时右侧渐隐,提示还有没露出来的页面
const tabsOverflow = ref(false)
const tabsAtEnd = ref(false)
let overflowTimer: ReturnType<typeof setTimeout> | null = null
let tabsObserver: ResizeObserver | null = null

function updateTabsOverflow() {
  const el = tabsEl.value
  if (!el) {
    tabsOverflow.value = false
    tabsAtEnd.value = false
    return
  }
  tabsOverflow.value = el.scrollWidth > el.clientWidth + 1
  tabsAtEnd.value = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
}

function scheduleOverflowCheck() {
  if (overflowTimer) clearTimeout(overflowTimer)
  overflowTimer = setTimeout(updateTabsOverflow, 120)
}

onMounted(() => {
  updateTabsOverflow()
  tabsObserver = new ResizeObserver(updateTabsOverflow)
  if (tabsEl.value) tabsObserver.observe(tabsEl.value)
})

onBeforeUnmount(() => {
  tabsObserver?.disconnect()
  tabsObserver = null
  if (overflowTimer) clearTimeout(overflowTimer)
  stopTabsScroll()
})

// 滚轮滚动用 rAF 缓动,避免一格一格地硬跳;目标位置持续累积,连续滚动不被打断
let scrollRaf: number | null = null
let scrollTarget = 0

function stopTabsScroll() {
  if (scrollRaf !== null) {
    cancelAnimationFrame(scrollRaf)
    scrollRaf = null
  }
}

function stepTabsScroll() {
  const el = tabsEl.value
  if (!el) {
    scrollRaf = null
    return
  }
  const diff = scrollTarget - el.scrollLeft
  if (Math.abs(diff) < 0.5) {
    el.scrollLeft = scrollTarget
    scrollRaf = null
    return
  }
  el.scrollLeft += diff * 0.28
  scrollRaf = requestAnimationFrame(stepTabsScroll)
}

function onTabsWheel(e: WheelEvent) {
  const el = tabsEl.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  e.preventDefault()
  if (scrollRaf === null) scrollTarget = el.scrollLeft
  scrollTarget = Math.max(
    0,
    Math.min(el.scrollWidth - el.clientWidth, scrollTarget + e.deltaX + e.deltaY)
  )
  if (scrollRaf === null) scrollRaf = requestAnimationFrame(stepTabsScroll)
}

watch(
  () => props.currentIndex,
  async () => {
    await nextTick()
    stopTabsScroll()
    tabsEl.value
      ?.querySelector<HTMLElement>('.page-tab.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    scheduleOverflowCheck()
  }
)

watch([() => props.pages.length, () => props.titles], scheduleOverflowCheck)

// ======== Drag reorder ========
const {
  isDragging,
  dragFromIndex,
  dragToIndex,
  dragStep,
  cancelDrag,
  onPointerDown,
  canDrop,
  isDragTarget,
  isDragSource
} = useDragReorder(
  () => props.pages,
  {
    select: (i: number) => emit('select', i),
    reorder: (f: number, t: number) => emit('reorder', f, t)
  },
  openPinMenu
)

// 拖拽排序的让位预览:from 与 to 之间的标签平移一个身位,松手后原地就位
function tabShiftStyle(i: number): Record<string, string> | undefined {
  const from = dragFromIndex.value
  const to = dragToIndex.value
  if (!isDragging.value || from === null || to === null || from === to || i === from) {
    return undefined
  }
  if (from < to && i > from && i <= to) {
    return { transform: `translateX(-${dragStep.value}px)` }
  }
  if (from > to && i >= to && i < from) {
    return { transform: `translateX(${dragStep.value}px)` }
  }
  return undefined
}

watch(
  () => props.isNotched,
  (v) => {
    if (v) closeContextMenu()
    if (v) cancelDrag()
  }
)
</script>

<template>
  <div
    class="toolbar"
    @click="
      (e) => {
        const target = e.target as HTMLElement
        if (!target.closest('.page-tab') && !target.closest('.pin-menu')) closeContextMenu()
      }
    "
  >
    <div
      ref="tabsEl"
      class="page-tabs"
      :class="{
        'no-drop': isDragging && !canDrop(),
        dragging: isDragging,
        overflowing: tabsOverflow && !tabsAtEnd
      }"
      @wheel="onTabsWheel"
      @scroll.passive="updateTabsOverflow"
    >
      <div
        v-for="(page, i) in pages"
        :key="page.id"
        class="page-tab"
        role="tab"
        :aria-selected="i === currentIndex"
        :title="titles[i]"
        :class="{
          active: i === currentIndex && !isDragging,
          'drag-source': isDragSource(i),
          'drag-target': isDragTarget(i)
        }"
        :style="tabShiftStyle(i)"
        @pointerdown="onPointerDown($event, i)"
      >
        <Star v-if="page.pinned" :size="9" :stroke-width="2" class="pin-star" />
        <span class="page-tab-label">{{ titles[i] }}</span>
        <button
          v-jelly
          class="page-tab-close"
          :class="{ show: i === currentIndex }"
          :tabindex="i === currentIndex ? 0 : -1"
          :aria-hidden="i !== currentIndex"
          title="删除此页"
          @pointerdown.stop
          @click.stop="handleClose(i)"
        >
          <X :size="11" :stroke-width="2.5" />
        </button>
      </div>
    </div>
    <button
      v-jelly
      class="tool-btn add-btn"
      :class="{ 'is-disabled': pages.length >= maxPages }"
      :aria-disabled="pages.length >= maxPages"
      :title="pages.length >= maxPages ? '已达页面上限,可在设置里调整' : '新建页面'"
      @click="handleAdd"
    >
      <Plus :size="16" :stroke-width="2.5" />
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="contextMenuVisible"
      class="pin-menu-overlay"
      @click="closeContextMenu"
      @contextmenu.prevent="closeContextMenu"
    >
      <div
        class="pin-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop="handleTogglePin"
      >
        <Star
          :size="12"
          :stroke-width="2.5"
          :class="isPagePinned(contextMenuPageId!) ? 'menu-star-pinned' : 'menu-star-unpinned'"
        />
      </div>
    </div>
  </Teleport>
</template>

<style src="./TopToolbar.css" />
