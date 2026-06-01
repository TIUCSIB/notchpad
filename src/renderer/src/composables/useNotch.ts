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

  const panelBgColor = ref('#000')
  const isLightTheme = ref(false)

  function updatePanelBg() {
    const light = isLightTheme.value
    if (!isNotched.value) panelBgColor.value = light ? '#faf6f0' : '#000'
    else if (isAnimating.value) panelBgColor.value = light ? '#faf6f0' : '#000'
    else panelBgColor.value = notchColor.value
  }

  // Notch pill: flat top, rounded bottom — phone notch style
  const pillWidth = computed(() => isNotched.value ? (pillHovered.value ? '84px' : '72px') : 'calc(100% - 4px)')
  const pillHeight = computed(() => isNotched.value ? (pillHovered.value ? '18px' : '14px') : '100vh')
  const pillTop = computed(() => '0px')
  const pillRadius = computed(() => isNotched.value ? '0 0 12px 12px' : '0 0 20px 20px')

  const panelAnimate = computed(() => ({
    x: '-50%',
    width: pillWidth.value,
    height: pillHeight.value,
    top: pillTop.value,
    borderRadius: pillRadius.value,
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
