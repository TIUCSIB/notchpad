import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useFontPopups() {
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

  function toggle(next: { value: boolean }) {
    const wasOpen = next.value
    closeAll()
    next.value = !wasOpen
  }

  function onDocClick(e: PointerEvent) {
    const target = e.target as HTMLElement
    if (!target.closest('.font-control-wrap') && !target.closest('.font-popup')) closeAll()
  }

  onMounted(() => { document.addEventListener('pointerdown', onDocClick, true) })
  onBeforeUnmount(() => { document.removeEventListener('pointerdown', onDocClick, true) })

  return {
    fontSizePopup, fontFamilyPopup, colorPopup, highlightPopup,
    closeAll, toggle
  }
}
