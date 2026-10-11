import { ref, computed, watch } from 'vue'
import type { Page } from '../../types'

const expandSpring = { type: 'spring' as const, stiffness: 150, damping: 22, mass: 0.8 }
const collapseSpring = { type: 'spring' as const, stiffness: 200, damping: 30, mass: 0.6 }

export function useNotch(
  pages: { value: Page[] },
  settingsVisible: { value: boolean },
  linkPromptVisible?: { value: boolean }
) {
  const isNotched = ref(true)
  const appReady = ref(false)
  const isAnimating = ref(false)
  const pillHovered = ref(false)
  /** 预热用:为 true 时面板动画零时长直达目标态 */
  const instant = ref(false)

  let animTimer: ReturnType<typeof setTimeout> | null = null
  let collapseColorTimer: ReturnType<typeof setTimeout> | null = null

  const notchColor = computed(() => {
    if (!appReady.value) return 'rgba(251,139,5,1)'
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

  const pillWidth = computed(() =>
    isNotched.value ? (pillHovered.value ? '84px' : '72px') : 'calc(100% - 4px)'
  )
  const pillHeight = computed(() =>
    isNotched.value ? (pillHovered.value ? '18px' : '14px') : '100vh'
  )
  const pillTop = computed(() => '0px')
  const pillRadius = computed(() => (isNotched.value ? '0 0 12px 12px' : '0 0 20px 20px'))

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

  const panelTransition = computed(() =>
    instant.value ? { duration: 0 } : isNotched.value ? collapseSpring : expandSpring
  )

  watch(isNotched, (notched) => {
    if (notched) {
      if (settingsVisible.value) settingsVisible.value = false
      if (linkPromptVisible?.value) linkPromptVisible.value = false
    }
    if (animTimer) {
      clearTimeout(animTimer)
      animTimer = null
    }
    if (collapseColorTimer) {
      clearTimeout(collapseColorTimer)
      collapseColorTimer = null
    }

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

  watch([isAnimating, isLightTheme, notchColor], () => updatePanelBg())

  updatePanelBg()

  const nextPaint = () =>
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

  /**
   * 首次展开预热:冷启动时窗口还是 opacity 0,趁用户看不见,
   * 用零时长动画把"展开→收起"整个流程静默走一遍 ——
   * 全尺寸布局、首次绘制、GPU 瓦片/动画管线都在隐形期备好,
   * 用户第一次悬浮展开时不再吃冷启动开销。调用后必须紧跟 rendererReady 亮窗。
   */
  async function warmUpFirstExpand(): Promise<void> {
    instant.value = true
    isNotched.value = false
    await nextPaint()
    isNotched.value = true
    await nextPaint()
    instant.value = false
    // 两次翻转触发的 isAnimating 定时器不再有意义,直接把状态落在稳态,
    // 避免亮窗后药丸背景先黑一小段才变回主题色
    if (animTimer) {
      clearTimeout(animTimer)
      animTimer = null
    }
    if (collapseColorTimer) {
      clearTimeout(collapseColorTimer)
      collapseColorTimer = null
    }
    isAnimating.value = false
    updatePanelBg()
  }

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
    warmUpFirstExpand,
    cleanup
  }
}
