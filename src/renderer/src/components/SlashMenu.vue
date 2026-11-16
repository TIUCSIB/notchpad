<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { AnimatePresence, Motion } from 'motion-v'
import {
  slashMenuStore,
  getFilteredSlashItems,
  runSlashItemAt,
  refreshSlashMenuPosition
} from '../extensions/slashMenu'

const listEl = ref<HTMLDivElement | null>(null)

const filtered = computed(() => (slashMenuStore.open ? getFilteredSlashItems() : []))

// 选中项滚进可视区;光标每敲一个字都会重新计算,只在索引变化时滚动
watch(
  () => slashMenuStore.selectedIndex,
  () => {
    nextTick(() => {
      const item = listEl.value?.querySelector('.slash-item.active') as HTMLElement | null
      item?.scrollIntoView({ block: 'nearest' })
    })
  }
)

function onItemEnter(_item: unknown, index: number) {
  slashMenuStore.selectedIndex = index
}

// 面板整体嵌在固定小窗里,滚动只发生在 content-body 内部;
// 监听捕获阶段即可拿到任意祖先滚动,菜单始终贴着光标
let rafId = 0
function onAnyScroll() {
  if (!slashMenuStore.open || rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    refreshSlashMenuPosition()
  })
}
onMounted(() => window.addEventListener('scroll', onAnyScroll, true))
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onAnyScroll, true)
  if (rafId) cancelAnimationFrame(rafId)
})

// placeAbove 时用 bottom 锚定:菜单从光标行向上展开,高度变化不影响贴边
const menuStyle = computed(() => {
  const base: Record<string, string> = {
    left: slashMenuStore.x + 'px',
    maxHeight: slashMenuStore.maxHeight + 'px',
    transformOrigin: slashMenuStore.placeAbove ? 'bottom left' : 'top left'
  }
  if (slashMenuStore.placeAbove) {
    base.bottom = window.innerHeight - slashMenuStore.y + 'px'
  } else {
    base.top = slashMenuStore.y + 'px'
  }
  return base
})
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <Motion
        v-if="slashMenuStore.open"
        class="slash-menu"
        :initial="{ opacity: 0, y: slashMenuStore.placeAbove ? -4 : 4, scale: 0.98 }"
        :animate="{ opacity: 1, y: 0, scale: 1 }"
        :exit="{ opacity: 0, scale: 0.98 }"
        :transition="{ duration: 0.12, ease: 'easeOut' }"
        :style="menuStyle"
        @mousedown.prevent
        @click.stop
      >
        <div ref="listEl" class="slash-list">
          <button
            v-for="(item, i) in filtered"
            :key="item.title"
            class="slash-item"
            :class="{ active: i === slashMenuStore.selectedIndex }"
            @mouseenter="onItemEnter(item, i)"
            @click="runSlashItemAt(i)"
          >
            <span class="slash-item-icon">
              <component :is="item.icon" :size="14" :stroke-width="2.2" />
            </span>
            <span class="slash-item-text">
              <span class="slash-item-title">{{ item.title }}</span>
              <span v-if="item.description" class="slash-item-desc">{{ item.description }}</span>
            </span>
          </button>
        </div>
      </Motion>
    </AnimatePresence>
  </Teleport>
</template>

<style scoped>
.slash-menu {
  position: fixed;
  z-index: 300;
  width: 210px;
  background: var(--bg-card, #0f1014);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  overflow: hidden;
}

.slash-list {
  max-height: inherit;
  overflow-y: auto;
  padding: 4px;
}

.slash-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-primary, #e5e5e5);
  cursor: pointer;
  text-align: left;
  font-size: 12px;
}

.slash-item:hover,
.slash-item.active {
  background: var(--active-bg, #3a3a3c);
}

.slash-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 5px;
  background: var(--bg-toolbar, #2a2a2a);
  color: var(--accent, #4ade80);
}

.slash-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.slash-item-title {
  line-height: 1.3;
}

.slash-item-desc {
  font-size: 10px;
  color: var(--text-secondary, #888);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
