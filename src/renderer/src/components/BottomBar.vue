<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next'
import { Settings } from 'lucide-vue-next'

interface FormatBtn {
  title: string
  icon: LucideIcon
  action: () => void
  isActive?: () => boolean
}

defineProps<{
  formatBtns: FormatBtn[]
}>()

const emit = defineEmits<{
  (e: 'openSettings'): void
}>()
</script>

<template>
  <div class="bottom-bar" @click.stop>
    <div class="format-group">
      <button
        v-for="btn in formatBtns"
        :key="btn.title"
        v-jelly
        class="fmt-btn"
        :class="{ active: btn.isActive?.() }"
        @click="btn.action"
      >
        <component :is="btn.icon" :size="14" :stroke-width="2.5" />
      </button>
    </div>
    <span class="bar-divider" aria-hidden="true"></span>
    <button v-jelly class="fmt-btn" title="设置" @click.stop="emit('openSettings')">
      <Settings :size="15" :stroke-width="2.2" />
    </button>
  </div>
</template>

<style src="./BottomBar.css" />
