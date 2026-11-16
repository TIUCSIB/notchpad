<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { Editor } from '@tiptap/core'
import { Motion, AnimatePresence } from 'motion-v'
import { useFontPopups } from '../composables/useFontPopups'

/**
 * 选中正文时浮出的字体菜单:只保留字色(A)和底色(B),横向排布。
 */
const props = defineProps<{
  editor: Editor | undefined
  isNotched: boolean
  colorOptions: string[]
  highlightColors: string[]
  currentTextColor: () => string
  currentHighlightColor: () => string
}>()

const emit = defineEmits<{
  (e: 'setTextColor', color: string): void
  (e: 'clearTextColor'): void
  (e: 'setHighlight', color: string): void
  (e: 'clearHighlightColor'): void
}>()

const visible = ref(false)
const menuStyle = ref<Record<string, string>>({})
// 色板比菜单宽得多:靠边时改对齐方向,菜单本身始终贴着选区
const popupAlign = ref<'left' | 'center' | 'right'>('center')
const { colorPopup, highlightPopup, closeAll, toggle } = useFontPopups()

// 鼠标拖选过程中不弹菜单,松手后再显示,避免浮层挡住选区
let selecting = false

function hide() {
  visible.value = false
  closeAll()
}

function onEditorPointerDown() {
  selecting = true
  hide()
}

function onWindowPointerUp() {
  if (!selecting) return
  selecting = false
  nextTick(update)
}

function update() {
  if (selecting) return hide()
  const ed = props.editor
  if (!ed || ed.isDestroyed) return hide()
  const { from, to, empty } = ed.state.selection
  if (empty || !ed.isFocused) return hide()

  const start = ed.view.coordsAtPos(from)
  const end = ed.view.coordsAtPos(to)
  // 优先用 DOM Range 的包围盒,它比单个 coordsAtPos 更贴近实际选中的文字
  const browserSelection = window.getSelection()
  const rawRect =
    browserSelection && browserSelection.rangeCount
      ? browserSelection.getRangeAt(0).getBoundingClientRect()
      : null
  const domRect = rawRect && (rawRect.width > 0 || rawRect.height > 0) ? rawRect : null

  const selLeft = domRect ? domRect.left : start.left
  const selRight = domRect ? domRect.right : end.right
  const selTop = domRect ? domRect.top : Math.min(start.top, end.top)
  const selBottom = domRect ? domRect.bottom : Math.max(start.bottom, end.bottom)

  // 菜单本身很窄,只留半宽;色板靠边时用 popupAlign 换方向
  const x = Math.min(Math.max((selLeft + selRight) / 2, 40), window.innerWidth - 40)
  popupAlign.value = x < 170 ? 'left' : x > window.innerWidth - 170 ? 'right' : 'center'

  // 优先放在选区上方;上方放不下才翻到下方,并保证整块菜单不出窗口
  const menuH = 36
  const gap = 8
  const aboveTop = selTop - menuH - gap
  const belowTop = selBottom + gap
  const top = Math.min(
    Math.max(aboveTop >= 8 ? aboveTop : belowTop, 8),
    window.innerHeight - menuH - 8
  )

  menuStyle.value = { left: `${x}px`, top: `${top}px` }
  visible.value = true
}

function toggleColor() {
  toggle(colorPopup)
}
function toggleHighlight() {
  toggle(highlightPopup)
}
function setAndClose(fn: () => void) {
  fn()
  closeAll()
}

watch(
  () => props.editor,
  (ed, old) => {
    old?.off('selectionUpdate', update)
    old?.off('blur', hide)
    old?.view.dom.removeEventListener('pointerdown', onEditorPointerDown)
    if (ed) {
      ed.on('selectionUpdate', update)
      ed.on('blur', hide)
      ed.view.dom.addEventListener('pointerdown', onEditorPointerDown)
      nextTick(update)
    }
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('pointerup', onWindowPointerUp)
})

watch(
  () => props.isNotched,
  (v) => {
    if (v) hide()
  }
)

onBeforeUnmount(() => {
  window.removeEventListener('pointerup', onWindowPointerUp)
  props.editor?.off('selectionUpdate', update)
  props.editor?.off('blur', hide)
  props.editor?.view.dom.removeEventListener('pointerdown', onEditorPointerDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sel-menu">
      <div
        v-if="visible"
        class="selection-menu"
        :style="menuStyle"
        @pointerdown.prevent
        @click.stop
      >
        <div class="font-control-wrap">
          <button v-jelly class="fmt-btn" @click.stop="toggleColor">
            <span class="color-indicator" :style="{ borderBottomColor: currentTextColor() }"
              >A</span
            >
          </button>
          <div
            class="popup-anchor"
            :class="{ left: popupAlign === 'left', right: popupAlign === 'right' }"
          >
            <div class="popup-centerer">
              <AnimatePresence>
                <Motion
                  v-if="colorPopup"
                  class="font-popup color-popup"
                  :initial="{ opacity: 0, y: 8, scale: 0.95 }"
                  :animate="{ opacity: 1, y: 0, scale: 1 }"
                  :exit="{ opacity: 0, y: 8, scale: 0.95 }"
                  :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }"
                  @click.stop
                >
                  <button
                    class="color-swatch clear-swatch"
                    @click="setAndClose(() => emit('clearTextColor'))"
                  >
                    <span class="clear-diag"></span>
                  </button>
                  <button
                    v-for="c in colorOptions"
                    :key="c"
                    class="color-swatch"
                    :style="{ background: c }"
                    :class="{ active: currentTextColor() === c }"
                    @click="setAndClose(() => emit('setTextColor', c))"
                  />
                </Motion>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div class="font-control-wrap">
          <button v-jelly class="fmt-btn" @click.stop="toggleHighlight">
            <span class="highlight-label" :style="{ background: currentHighlightColor() }">B</span>
          </button>
          <div
            class="popup-anchor"
            :class="{ left: popupAlign === 'left', right: popupAlign === 'right' }"
          >
            <div class="popup-centerer">
              <AnimatePresence>
                <Motion
                  v-if="highlightPopup"
                  class="font-popup color-popup"
                  :initial="{ opacity: 0, y: 8, scale: 0.95 }"
                  :animate="{ opacity: 1, y: 0, scale: 1 }"
                  :exit="{ opacity: 0, y: 8, scale: 0.95 }"
                  :transition="{ type: 'spring', stiffness: 300, damping: 25, mass: 0.6 }"
                  @click.stop
                >
                  <button
                    class="color-swatch clear-swatch"
                    @click="setAndClose(() => emit('clearHighlightColor'))"
                  >
                    <span class="clear-diag"></span>
                  </button>
                  <button
                    v-for="hc in highlightColors"
                    :key="hc"
                    class="color-swatch"
                    :style="{ background: hc }"
                    @click="setAndClose(() => emit('setHighlight', hc))"
                  />
                </Motion>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style src="./SelectionMenu.css" />
