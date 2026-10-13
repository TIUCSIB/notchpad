import { ref, computed, watch, onUnmounted, type Ref } from 'vue'

/**
 * 药丸显示内容的单一来源:按设置在时钟/一言/天气/自定义文字间轮播。
 * 一言与天气的文本由 usePillFeeds 注入;一言离线兜底为每日本地语录。
 */

export type PillSource = 'off' | 'clock' | 'quote' | 'weather' | 'custom'

const ROTATE_MS = 5000

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 月/日 星期单字 时:分(数字窄、中文单字,一行放得下) */
function formatClock(d: Date): string {
  const mo = d.getMonth() + 1
  const day = d.getDate()
  const week = WEEKDAYS[d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${mo}/${day} ${week} ${hh}:${mm}`
}

/**
 * @param settingsRef 应用设置(appSettings)
 * @param quoteTextRef 一言文本(usePillFeeds 提供,含离线兜底)
 * @param weatherTextRef 天气文案(usePillFeeds 提供,空 = 无数据)
 */
export function usePillContent(
  settingsRef: Ref<Record<string, string>>,
  quoteTextRef: Ref<string>,
  weatherTextRef: Ref<string>
) {
  const now = ref(new Date())
  const clockTimer: ReturnType<typeof setInterval> = setInterval(() => {
    now.value = new Date()
  }, 10_000)
  onUnmounted(() => clearInterval(clockTimer))

  const clockText = computed(() => formatClock(now.value))

  /** 参与轮播的来源列表,顺序:时钟 → 一言 → 天气 → 自定义 */
  const sources = computed<PillSource[]>(() => {
    const raw = settingsRef.value.pillSources ?? 'off'
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is PillSource => ['clock', 'quote', 'weather', 'custom'].includes(s))
    return list
  })

  const customText = computed(() => (settingsRef.value.pillCustomText ?? '').trim())

  /** 来源有内容才算有效(天气无数据、自定义为空时自动跳过) */
  const activeSources = computed(() =>
    sources.value.filter((s) => {
      if (s === 'custom') return !!customText.value
      if (s === 'weather') return !!weatherTextRef.value
      if (s === 'quote') return !!quoteTextRef.value
      return true
    })
  )

  const rotateIndex = ref(0)
  let rotateTimer: ReturnType<typeof setInterval> | null = null

  function ensureRotateTimer() {
    const need = activeSources.value.length > 1
    if (need && !rotateTimer) {
      rotateTimer = setInterval(() => {
        rotateIndex.value = (rotateIndex.value + 1) % activeSources.value.length
      }, ROTATE_MS)
    } else if (!need && rotateTimer) {
      clearInterval(rotateTimer)
      rotateTimer = null
    }
  }
  watch(activeSources, ensureRotateTimer, { immediate: true, deep: false })
  onUnmounted(() => {
    if (rotateTimer) clearInterval(rotateTimer)
  })

  /** 当前应显示的文字;'' 表示无内容(模板侧隐藏) */
  const displayText = computed(() => {
    const list = activeSources.value
    if (!list.length) return ''
    const idx = rotateIndex.value % list.length
    const pick = list[idx]
    if (pick === 'clock') return clockText.value
    if (pick === 'quote') return quoteTextRef.value
    if (pick === 'weather') return weatherTextRef.value
    return customText.value
  })

  /** 当前轮到的来源(clock/quote/weather/custom) */
  const currentSource = computed<PillSource | null>(() => {
    const list = activeSources.value
    if (!list.length) return null
    return list[rotateIndex.value % list.length]
  })

  return { displayText, currentSource }
}
