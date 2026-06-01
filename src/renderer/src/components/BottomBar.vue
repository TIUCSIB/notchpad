<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Motion, AnimatePresence } from 'motion-v'
import type { LucideIcon } from 'lucide-vue-next'

interface FormatBtn {
  title: string
  icon: LucideIcon
  action: () => void
  isActive?: () => boolean
}

defineProps<{
  formatBtns: FormatBtn[]
  fontSizeOptions: string[]
  fontOptions: string[]
  colorOptions: string[]
  highlightColors: string[]
  currentFontSize: () => string
  currentFontFamily: () => string
  currentTextColor: () => string
  currentHighlightColor: () => string
}>()

const emit = defineEmits<{
  (e: 'setFontSize', size: string): void
  (e: 'clearFontSize'): void
  (e: 'setFontFamily', family: string): void
  (e: 'setTextColor', color: string): void
  (e: 'clearTextColor'): void
  (e: 'setHighlight', color: string): void
  (e: 'clearHighlightColor'): void
  (e: 'openLink'): void
}>()

const fontSizePopup = ref(false)
const fontFamilyPopup = ref(false)
const colorPopup = ref(false)
const highlightPopup = ref(false)

function closeAll() {
  fontSizePopup.value = false
  fontFamilyPopup.value = false
  colorPopup.value = false
  highlightPopup.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocClick, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocClick, true)
})
function onDocClick(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.font-control-wrap') && !target.closest('.font-popup')) {
    closeAll()
  }
}

function toggleFontSize() {
  const next = !fontSizePopup.value
  closeAll()
  fontSizePopup.value = next
}

function toggleFontFamily() {
  const next = !fontFamilyPopup.value
  closeAll()
  fontFamilyPopup.value = next
}

function toggleColor() {
  const next = !colorPopup.value
  closeAll()
  colorPopup.value = next
}

function toggleHighlight() {
  const next = !highlightPopup.value
  closeAll()
  highlightPopup.value = next
}

function clearFontSize() {
  emit('clearFontSize')
  closeAll()
}

function setFontSize(size: string) {
  emit('setFontSize', size)
  closeAll()
}

function setFontFamily(family: string) {
  emit('setFontFamily', family)
  closeAll()
}

function setTextColor(color: string) {
  emit('setTextColor', color)
  closeAll()
}

function setHighlight(color: string) {
  emit('setHighlight', color)
  closeAll()
}

function clearTextColor() {
  emit('clearTextColor')
  closeAll()
}

function clearHighlightColor() {
  emit('clearHighlightColor')
  closeAll()
}
</script>

<template>
  <div class="bottom-bar" @click.stop>
    <div class="format-group">
      <button v-for="btn in formatBtns" :key="btn.title" class="fmt-btn" :class="{ active: btn.isActive?.() }"
        @click="btn.action">
        <component :is="btn.icon" :size="14" :stroke-width="2.5" />
      </button>
    </div>
    <div class="font-controls">
      <div class="font-control-wrap">
        <button class="fmt-btn" @click.stop="toggleFontSize">
          <span class="font-size-label">{{ currentFontSize() }}</span>
        </button>
        <div class="popup-anchor">
          <div class="popup-centerer">
            <AnimatePresence>
              <Motion v-if="fontSizePopup" class="font-popup"
                :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
                :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
                <button class="font-popup-item" @click="clearFontSize">默认</button>
                <button v-for="s in fontSizeOptions" :key="s" class="font-popup-item"
                  :class="{ active: currentFontSize() === s }" @click="() => setFontSize(s)">
                  {{ s }}
                </button>
              </Motion>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div class="font-control-wrap">
        <button class="fmt-btn" @click.stop="toggleFontFamily">
          <span class="font-family-label">Aa</span>
        </button>
        <div class="popup-anchor">
          <div class="popup-centerer">
            <AnimatePresence>
              <Motion v-if="fontFamilyPopup" class="font-popup font-popup-wide"
                :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
                :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
                <button v-for="f in fontOptions" :key="f" class="font-popup-item"
                  :class="{ active: currentFontFamily() === f }" :style="{ fontFamily: f === '默认' ? 'inherit' : f }"
                  @click="() => setFontFamily(f)">
                  {{ f }}
                </button>
              </Motion>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div class="font-control-wrap">
        <button class="fmt-btn" @click.stop="toggleColor">
          <span class="color-indicator" :style="{ borderBottomColor: currentTextColor() }">A</span>
        </button>
        <div class="popup-anchor">
          <div class="popup-centerer">
            <AnimatePresence>
              <Motion v-if="colorPopup" class="font-popup color-popup"
                :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
                :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
                <button class="color-swatch clear-swatch" @click="clearTextColor">
                  <span class="clear-diag"></span>
                </button>
                <button v-for="c in colorOptions" :key="c" class="color-swatch" :style="{ background: c }"
                  :class="{ active: currentTextColor() === c }" @click="() => setTextColor(c)" />
              </Motion>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div class="font-control-wrap">
        <button class="fmt-btn" @click.stop="toggleHighlight">
          <span class="highlight-label" :style="{ background: currentHighlightColor() }">B</span>
        </button>
        <div class="popup-anchor">
          <div class="popup-centerer">
            <AnimatePresence>
              <Motion v-if="highlightPopup" class="font-popup color-popup"
                :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
                :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
                :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
                <button class="color-swatch clear-swatch" @click="clearHighlightColor">
                  <span class="clear-diag"></span>
                </button>
                <button v-for="hc in highlightColors" :key="hc" class="color-swatch" :style="{ background: hc }"
                  @click="() => setHighlight(hc)" />
              </Motion>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* border-top: 1px solid #121319; */
  background: var(--bg-bar, #1a1a1a);
  padding: 5px 8px 4px;
  flex-shrink: 0;
  border-radius: 0 0 8px 8px;
}

.format-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.fmt-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 5px;
  color: var(--text-secondary, #888);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.fmt-btn:hover {
  background: var(--bg-toolbar, #2a2a2a);
  color: var(--text-primary, #e5e5e5);
}

.fmt-btn.active {
  background: var(--bg-toolbar, #2a2a2a);
  color: var(--accent, #4ade80);
}

.font-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  margin-right: 4px;
}

.font-control-wrap {
  position: relative;
}

/* Zero-width anchor at horizontal center of button */
.popup-anchor {
  position: absolute;
  bottom: 100%;
  left: 50%;
  margin-bottom: 6px;
  z-index: 100;
}

/* Centering wrapper: CSS translateX centers popup without conflicting with motion-v */
.popup-centerer {
  transform: translateX(-50%);
}

.font-size-label {
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.font-family-label {
  font-size: 12px;
  font-weight: 700;
  font-family: Georgia, serif;
  line-height: 1;
}

.color-indicator {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  border-bottom: 3px solid;
  padding-bottom: 1px;
}

.highlight-label {
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  background: currentColor;
  padding: 0 2px;
  border-radius: 2px;
}

.font-popup {
  background: var(--bg-toolbar, #2a2a2a);
  border: 1px solid var(--border-strong, #3a3a3a);
  border-radius: 8px;
  /* box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4); */
  padding: 4px;
  display: flex;
  flex-direction: column;
  max-width: calc(100vw - 40px);
  gap: 2px;
}

.font-popup-wide {
  min-width: 120px;
}

.color-popup {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
  padding: 6px;
  width: fit-content;
}

.color-popup .color-swatch {
  width: 22px;
  height: 22px;
}

.font-popup-item {
  padding: 4px 10px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary, #ccc);
  text-align: left;
  white-space: nowrap;
  transition: background 0.1s;
}

.font-popup-item:hover {
  background: var(--accent-dim, #3a3a3a);
}

.font-popup-item.active {
  background: rgba(74, 222, 128, 0.12);
  color: var(--accent, #4ade80);
}

.color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    transform 0.1s,
    border-color 0.1s;
  padding: 0;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.active {
  border-color: var(--accent, #4ade80);
}

.clear-swatch {
  position: relative;
  background: var(--bg-bar, #1a1a1a);
  overflow: hidden;
}

.clear-swatch::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 2px;
  right: 2px;
  height: 2px;
  margin-top: -1px;
  background: #f87171;
  transform: rotate(-45deg);
  border-radius: 1px;
}
</style>
