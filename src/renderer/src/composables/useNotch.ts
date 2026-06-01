import { ref, computed, watch } from 'vue'

const expandSpring = { type: 'spring' as const, stiffness: 150, damping: 22, mass: 0.8 }
const collapseSpring = { type: 'spring' as const, stiffness: 200, damping: 30, mass: 0.6 }

export function useNotch(
  pages: { value: any },
  settingsVisible: { value: boolean }
) {
  const isNotched = ref(true)
  const appReady = ref(false)
  const isAnimating = ref(false)
  const pillHovered = ref(false)

  let animTimer: ReturnType<typeof setTimeout> | null = null
  let collapseColorTimer: ReturnType<typeof setTimeout> | null = null

  const notchColor = computed(() => {
    const n = pages.value.length
    if (n === 0) return 'rgba(93,190,138,1)'
    if (n >= 3) return 'rgba(236,43,36,1)'
    return 'rgba(251,139,5,1)'
  })

  // panelBgColor needs isLightTheme, passed from useSettings
  const panelBgColor = ref('#000')
  const isLightTheme = ref(false)
  // Initialize panelBgColor to notch color on first render
  // (updatePanelBg won't fire from watchers since isNotched starts as true)

  function updatePanelBg() {
    const light = isLightTheme.value
    if (!isNotched.value) panelBgColor.value = light ? '#faf6f0' : '#000'
    else if (isAnimating.value) panelBgColor.value = light ? '#faf6f0' : '#000'
    else panelBgColor.value = notchColor.value
  }

  const panelAnimate = computed(() => ({
    x: '-50%',
    width: isNotched.value ? (pillHovered.value ? '80px' : '64px') : 'calc(100% - 4px)',
    height: isNotched.value ? (pillHovered.value ? '10px' : '8px') : '100vh',
    top: isNotched.value ? (pillHovered.value ? '3px' : '4px') : '0px',
    borderRadius: isNotched.value ? '4px' : '0 0 20px 20px',
    backgroundColor: panelBgColor.value,
    opacity: 1,
    scale: 1
  }))

  const panelTransition = computed(() => (isNotched.value ? collapseSpring : expandSpring))

  watch(isNotched, (notched) => {
    if (notched && settingsVisible.value) settingsVisible.value = false
    if (animTimer) { clearTimeout(animTimer); animTimer = null }
    if (collapseColorTimer) { clearTimeout(collapseColorTimer); collapseColorTimer = null }

    if (notched) {
      isAnimating.value = true
      collapseColorTimer = setTimeout(() => {
        isAnimating.value = false
        updatePanelBg()
      }, 380)
    } else {
      isAnimating.value = true
      animTimer = setTimeout(() => {
        isAnimating.value = false
      }, 300)
    }
    updatePanelBg()
  })

  watch([isAnimating, isLightTheme], () => updatePanelBg())

  // Initialize pill color on setup (watcher won't fire since isNotched starts true)
  updatePanelBg()

  function cleanup() {
    if (animTimer) clearTimeout(animTimer)
    if (collapseColorTimer) clearTimeout(collapseColorTimer)
  }

  return {
    isNotched,
    appReady,
    isAnimating,
    pillHovered,
    notchColor,
    panelAnimate,
    panelTransition,
    isLightTheme,
    updatePanelBg,
    cleanup
  }
}
