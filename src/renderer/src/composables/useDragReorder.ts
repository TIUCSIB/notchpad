import { ref, onUnmounted } from 'vue'

const DRAG_THRESHOLD = 4
const LONG_PRESS_MS = 500

export function useDragReorder(
  getPages: () => Array<{ id: number; pinned: number }>,
  emit: {
    select: (index: number) => void
    reorder: (from: number, to: number) => void
  },
  onLongPress?: (index: number, rect: DOMRect) => void
) {
  const isDragging = ref(false)
  const dragFromIndex = ref<number | null>(null)
  const dragToIndex = ref<number | null>(null)
  let dragGhost: HTMLElement | null = null
  let startX = 0
  let startY = 0
  let dragStarted = false
  let longPressTimer: ReturnType<typeof setTimeout> | null = null

  function onPointerDown(e: PointerEvent, index: number) {
    if (e.button !== 0) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    startX = e.clientX
    startY = e.clientY
    dragStarted = false
    dragFromIndex.value = index

    longPressTimer = setTimeout(() => {
      longPressTimer = null
      onLongPress?.(index, rect)
      cancelDrag()
    }, LONG_PRESS_MS)

    document.addEventListener('pointermove', onGlobalPointerMove)
    document.addEventListener('pointerup', onGlobalPointerUp)
  }

  function onGlobalPointerMove(e: PointerEvent) {
    if (dragFromIndex.value === null) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    if (!dragStarted) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
      clearLongPress()
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

    clearLongPress()

    if (dragStarted && dragFromIndex.value !== null && dragToIndex.value !== null) {
      if (dragFromIndex.value !== dragToIndex.value) {
        emit.reorder(dragFromIndex.value, dragToIndex.value)
      }
    } else if (!dragStarted && dragFromIndex.value !== null) {
      emit.select(dragFromIndex.value)
    }

    cancelDrag()
  }

  function clearLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  function cancelDrag() {
    clearLongPress()
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
    if (dragGhost) { dragGhost.remove(); dragGhost = null }
  }

  function updateDragTarget(x: number, _y: number) {
    const dotsEl = document.querySelector('.page-dots')
    if (!dotsEl) { dragToIndex.value = null; return }

    const wraps = dotsEl.querySelectorAll('.page-dot-wrap')
    let closest: number | null = null
    let closestDist = Infinity

    wraps.forEach((el, i) => {
      const rect = el.getBoundingClientRect()
      const dist = Math.abs(x - (rect.left + rect.width / 2))
      if (dist < closestDist) { closestDist = dist; closest = i }
    })

    if (closest === null || closestDist > 40) { dragToIndex.value = null; return }

    const fromPinned = getPages()[dragFromIndex.value!]?.pinned
    const toPinned = getPages()[closest!]?.pinned
    if (fromPinned !== toPinned) { dragToIndex.value = null; return }

    dragToIndex.value = closest
  }

  function canDrop() { return dragToIndex.value !== null }
  function isDragTarget(i: number) { return isDragging.value && dragToIndex.value === i && dragFromIndex.value !== i }
  function isDragSource(i: number) { return isDragging.value && dragFromIndex.value === i }

  onUnmounted(() => {
    document.removeEventListener('pointermove', onGlobalPointerMove)
    document.removeEventListener('pointerup', onGlobalPointerUp)
    clearLongPress()
    removeGhost()
  })

  return {
    isDragging, dragFromIndex, dragToIndex,
    onPointerDown, cancelDrag,
    canDrop, isDragTarget, isDragSource
  }
}
