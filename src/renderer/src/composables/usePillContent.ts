import { ref, computed, watch, onUnmounted, type Ref } from 'vue'

/** 药丸显示内容的单一来源:按设置轮播时钟/一言/自定义文字 */

/** 内置离线一言库:短句,药丸宽度内可完整显示 */
const QUOTES: string[] = [
  '不积跬步,无以至千里',
  '千里之行,始于足下',
  '学而不思则罔,思而不学则殆',
  '博学之,审问之,慎思之,笃行之',
  '路漫漫其修远兮',
  '逝者如斯夫,不舍昼夜',
  '三人行,必有我师',
  '温故而知新',
  '己所不欲,勿施于人',
  '知之者不如好之者',
  '少壮不努力,老大徒伤悲',
  '宝剑锋从磨砺出',
  '梅花香自苦寒来',
  '长风破浪会有时',
  '千磨万击还坚劲',
  '天生我材必有用',
  '会当凌绝顶,一览众山小',
  '纸上得来终觉浅',
  '工欲善其事,必先利其器',
  '锲而不舍,金石可镂',
  '满招损,谦受益',
  '良药苦口利于病',
  '勿以恶小而为之',
  '读万卷书,行万里路',
  '业精于勤,荒于嬉',
  '明日复明日,明日何其多',
  '机不可失,时不再来',
  '一分耕耘,一分收获',
  '精诚所至,金石为开',
  '有志者事竟成'
]

export type PillSource = 'off' | 'clock' | 'quote' | 'custom'

const ROTATE_MS = 5000

function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * @param settingsRef 应用设置(appSettings),读 pillSources(逗号分隔的来源)、pillCustomText
 */
export function usePillContent(settingsRef: Ref<Record<string, string>>) {
  const now = ref(new Date())
  const clockTimer: ReturnType<typeof setInterval> = setInterval(() => {
    now.value = new Date()
  }, 10_000)
  onUnmounted(() => clearInterval(clockTimer))

  const clockText = computed(() => formatClock(now.value))

  // 一言:每天固定一条(按日期做种子),避免每次收起都变
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  const quoteText = QUOTES[dayIndex % QUOTES.length]

  /** 参与轮播的来源列表,顺序:时钟 → 一言 → 自定义 */
  const sources = computed<PillSource[]>(() => {
    const raw = settingsRef.value.pillSources ?? 'off'
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is PillSource => ['clock', 'quote', 'custom'].includes(s))
    return list
  })

  const customText = computed(() => (settingsRef.value.pillCustomText ?? '').trim())

  const rotateIndex = ref(0)
  let rotateTimer: ReturnType<typeof setInterval> | null = null
  // 来源或自定义文字变化时重置轮播
  watch(sources, () => (rotateIndex.value = 0))
  watch(customText, () => (rotateIndex.value = 0))

  // 只有 >1 个来源且各自有内容时才需要轮播
  const activeCount = computed(
    () =>
      sources.value.filter((s) => s !== 'custom' || customText.value).length
  )
  function ensureRotateTimer() {
    const need = activeCount.value > 1
    if (need && !rotateTimer) {
      rotateTimer = setInterval(() => {
        rotateIndex.value = (rotateIndex.value + 1) % activeCount.value
      }, ROTATE_MS)
    } else if (!need && rotateTimer) {
      clearInterval(rotateTimer)
      rotateTimer = null
    }
  }
  watch(activeCount, ensureRotateTimer, { immediate: true })
  onUnmounted(() => {
    if (rotateTimer) clearInterval(rotateTimer)
  })

  /** 当前应显示的文字;'' 表示无内容 */
  const displayText = computed(() => {
    const list = sources.value.filter((s) => s !== 'custom' || customText.value)
    if (!list.length) return ''
    const pick = list[rotateIndex.value % list.length]
    if (pick === 'clock') return clockText.value
    if (pick === 'quote') return quoteText
    return customText.value
  })

  return { displayText }
}
