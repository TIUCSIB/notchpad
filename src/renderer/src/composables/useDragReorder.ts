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
  /** 一个标签的宽度 + 间距:标签之间"让位"时平移的距离 */
  const dragStep = ref(0)
  let dragGhost: HTMLElement | null = null
  // 拖拽影子上显示的标签文字(文本标签页需要跟着指针带标题)
  let dragLabel = ''
  // 拖拽开始时缓存标签的中心位置(相对滚动内容),避免让位动画改变 rect 后目标来回跳
  let dragContainer: HTMLElement | null = null
  let dragCenters: Array<{ center: number; width: number }> = []
  let startX = 0
  let startY = 0
  let dragStarted = false
  let longPressTimer: ReturnType<typeof setTimeout> | null = null

  function onPointerDown(e: PointerEvent, index: number) {
    if (e.button !== 0) return

    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    dragLabel = (
      target.querySelector('.page-tab-label')?.textContent ||
      target.textContent ||
      ''
    ).trim()
    // 捕获指针:在窗口外松开也能收到 pointerup,避免拖拽影子和高亮卡住
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // 某些指针类型不支持捕获,退回 document 监听
    }
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
    // 按钮已经在别处松开(pointerup 丢失)时直接收尾,不让拖拽态残留
    if (e.buttons === 0) {
      onGlobalPointerUp(e)
      return
    }

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    if (!dragStarted) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return
      clearLongPress()
      dragStarted = true
      cacheDragMetrics()
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
    dragStep.value = 0
    dragContainer = null
    dragCenters = []
    dragStarted = false
    removeGhost()
  }

  /**
   * 缓存每个标签在滚动内容坐标系里的中心点。
   * 让位动画用的是 transform,如果每次拿 getBoundingClientRect 判断目标,
   * 位移后的位置会反过来影响判定,导致目标索引来回跳。
   */
  function cacheDragMetrics() {
    const tabsEl = document.querySelector<HTMLElement>('.page-tabs')
    dragContainer = tabsEl
    dragCenters = []
    dragStep.value = 0
    if (!tabsEl) return

    const base = tabsEl.getBoundingClientRect().left - tabsEl.scrollLeft
    const tabs = tabsEl.querySelectorAll<HTMLElement>('.page-tab')
    dragCenters = Array.from(tabs).map((el) => {
      const rect = el.getBoundingClientRect()
      // 宽度用 offsetWidth:按下时 :active 的 scale(0.97) 会污染 rect,影响让位距离
      return { center: rect.left + rect.width / 2 - base, width: el.offsetWidth }
    })

    const from = dragFromIndex.value
    const width = from !== null ? (dragCenters[from]?.width ?? 0) : 0
    const gap = parseFloat(getComputedStyle(tabsEl).columnGap || '0') || 0
    dragStep.value = width + gap
  }

  function createGhost(x: number, y: number) {
    removeGhost()
    dragGhost = document.createElement('div')
    dragGhost.className = 'drag-ghost'
    dragGhost.textContent = dragLabel
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

  function updateDragTarget(x: number, _y: number) {
    const tabsEl = dragContainer
    if (!tabsEl || !dragCenters.length) {
      dragToIndex.value = null
      return
    }

    const base = tabsEl.getBoundingClientRect().left - tabsEl.scrollLeft
    const px = x - base
    let closest: number | null = null
    let closestDist = Infinity

    dragCenters.forEach((entry, i) => {
      const dist = Math.abs(px - entry.center)
      if (dist < closestDist) {
        closestDist = dist
        closest = i
      }
    })

    if (closest === null || closestDist > 40) {
      dragToIndex.value = null
      return
    }

    const fromPinned = getPages()[dragFromIndex.value!]?.pinned
    const toPinned = getPages()[closest!]?.pinned
    if (fromPinned !== toPinned) {
      dragToIndex.value = null
      return
    }

    dragToIndex.value = closest
  }

  function canDrop() {
    return dragToIndex.value !== null
  }
  function isDragTarget(i: number) {
    return isDragging.value && dragToIndex.value === i && dragFromIndex.value !== i
  }
  function isDragSource(i: number) {
    return isDragging.value && dragFromIndex.value === i
  }

  onUnmounted(() => {
    document.removeEventListener('pointermove', onGlobalPointerMove)
    document.removeEventListener('pointerup', onGlobalPointerUp)
    clearLongPress()
    removeGhost()
  })

  return {
    isDragging,
    dragFromIndex,
    dragToIndex,
    dragStep,
    onPointerDown,
    cancelDrag,
    canDrop,
    isDragTarget,
    isDragSource
  }
}
