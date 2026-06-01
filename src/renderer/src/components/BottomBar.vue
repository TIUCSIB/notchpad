<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next'
import { Motion, AnimatePresence } from 'motion-v'
import { useFontPopups } from '../composables/useFontPopups'

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

const {
  fontSizePopup, fontFamilyPopup, colorPopup, highlightPopup, closeAll
} = useFontPopups()

function setAndClose(emitFn: () => void) { emitFn(); closeAll() }
function toggleFontSizePopup() { const o = fontSizePopup.value; closeAll(); fontSizePopup.value = !o }
function toggleFontFamilyPopup() { const o = fontFamilyPopup.value; closeAll(); fontFamilyPopup.value = !o }
function toggleColorPopup() { const o = colorPopup.value; closeAll(); colorPopup.value = !o }
function toggleHighlightPopup() { const o = highlightPopup.value; closeAll(); highlightPopup.value = !o }
</script>

<template>
  <div class="bottom-bar" @click.stop>
    <div class="format-group">
      <button v-for="btn in formatBtns" :key="btn.title" class="fmt-btn" v-jelly :class="{ active: btn.isActive?.() }" @click="btn.action">
        <component :is="btn.icon" :size="14" :stroke-width="2.5" />
      </button>
    </div>
    <div class="font-controls">
      <div class="font-control-wrap">
        <button class="fmt-btn" v-jelly @click.stop="toggleFontSizePopup">
          <span class="font-size-label">{{ currentFontSize() }}</span>
        </button>
        <div class="popup-anchor"><div class="popup-centerer">
          <AnimatePresence>
            <Motion v-if="fontSizePopup" class="font-popup"
              :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
              :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
              <button class="font-popup-item" @click="setAndClose(() => emit('clearFontSize'))">默认</button>
              <button v-for="s in fontSizeOptions" :key="s" class="font-popup-item" :class="{ active: currentFontSize() === s }" @click="setAndClose(() => emit('setFontSize', s))">{{ s }}</button>
            </Motion>
          </AnimatePresence>
        </div></div>
      </div>
      <div class="font-control-wrap">
        <button class="fmt-btn" v-jelly @click.stop="toggleFontFamilyPopup">
          <span class="font-family-label">Aa</span>
        </button>
        <div class="popup-anchor"><div class="popup-centerer">
          <AnimatePresence>
            <Motion v-if="fontFamilyPopup" class="font-popup font-popup-wide"
              :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
              :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
              <button v-for="f in fontOptions" :key="f" class="font-popup-item" :class="{ active: currentFontFamily() === f }" :style="{ fontFamily: f === '默认' ? 'inherit' : f }" @click="setAndClose(() => emit('setFontFamily', f))">{{ f }}</button>
            </Motion>
          </AnimatePresence>
        </div></div>
      </div>
      <div class="font-control-wrap">
        <button class="fmt-btn" v-jelly @click.stop="toggleColorPopup">
          <span class="color-indicator" :style="{ borderBottomColor: currentTextColor() }">A</span>
        </button>
        <div class="popup-anchor"><div class="popup-centerer">
          <AnimatePresence>
            <Motion v-if="colorPopup" class="font-popup color-popup"
              :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
              :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
              <button class="color-swatch clear-swatch" @click="setAndClose(() => emit('clearTextColor'))"><span class="clear-diag"></span></button>
              <button v-for="c in colorOptions" :key="c" class="color-swatch" :style="{ background: c }" :class="{ active: currentTextColor() === c }" @click="setAndClose(() => emit('setTextColor', c))" />
            </Motion>
          </AnimatePresence>
        </div></div>
      </div>
      <div class="font-control-wrap">
        <button class="fmt-btn" v-jelly @click.stop="toggleHighlightPopup">
          <span class="highlight-label" :style="{ background: currentHighlightColor() }">B</span>
        </button>
        <div class="popup-anchor"><div class="popup-centerer">
          <AnimatePresence>
            <Motion v-if="highlightPopup" class="font-popup color-popup"
              :initial="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :animate="{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }"
              :exit="{ opacity: 0, y: 8, scale: 0.95, filter: 'blur(4px)' }"
              :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }" @click.stop>
              <button class="color-swatch clear-swatch" @click="setAndClose(() => emit('clearHighlightColor'))"><span class="clear-diag"></span></button>
              <button v-for="hc in highlightColors" :key="hc" class="color-swatch" :style="{ background: hc }" @click="setAndClose(() => emit('setHighlight', hc))" />
            </Motion>
          </AnimatePresence>
        </div></div>
      </div>
    </div>
  </div>
</template>

<style src="./BottomBar.css" />
