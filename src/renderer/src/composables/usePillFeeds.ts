/**
 * 药丸在线内容源:一言(hitokoto)与和风天气。
 * 按设置的更新间隔调度拉取;一言失败时静默回落到本地语录库。
 */
import { ref, watch, onUnmounted, type Ref } from 'vue'

/** 本地兜底语录(与一言分类无关,拉取失败时使用) */
export const LOCAL_QUOTES: string[] = [
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

export function dailyLocalQuote(): string {
  const dayIndex = Math.floor(Date.now() / 86_400_000)
  return LOCAL_QUOTES[dayIndex % LOCAL_QUOTES.length]
}

const INTERVAL_MS: Record<string, number> = {
  '5min': 5 * 60_000,
  '30min': 30 * 60_000,
  hour: 3_600_000,
  day: 24 * 3_600_000,
  '3hour': 3 * 3_600_000
}

/**
 * @param settingsRef 应用设置
 * @param isNotchedRef 刘海收起态(quoteInterval = collapse 时每次收起拉新一言)
 */
export function usePillFeeds(
  settingsRef: Ref<Record<string, string>>,
  isNotchedRef?: Ref<boolean>
) {
  /** 当前一言:初始为本地每日一句,在线拉取成功后替换 */
  const quoteText = ref(dailyLocalQuote())
  /** 当前天气文案(如 "23° 晴");无 key/失败/未配置时为 '' */
  const weatherText = ref('')

  const quoteTimer: Ref<ReturnType<typeof setInterval> | null> = ref(null)
  const weatherTimer: Ref<ReturnType<typeof setInterval> | null> = ref(null)

  async function fetchQuote() {
    try {
      const cats = (settingsRef.value.quoteCategories ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => `&c=${encodeURIComponent(c)}`)
        .join('')
      const res = await fetch(`https://v1.hitokoto.cn/?max_length=18${cats}`)
      if (!res.ok) throw new Error(String(res.status))
      const j = await res.json()
      if (j?.hitokoto) quoteText.value = j.hitokoto
    } catch {
      // 网络失败:保留当前一言(初始即本地语录),不打扰用户
    }
  }

  /** 和风 API Host:新账号使用控制台分配的专属 Host,公共域名对新 Key 无效 */
  function weatherHost(): string {
    const custom = (settingsRef.value.weatherApiHost ?? '').trim().replace(/^https?:\/\//, '')
    return custom || 'devapi.qweather.com'
  }

  async function resolveCityId(name: string, key: string): Promise<string | null> {
    try {
      const res = await fetch(
        `https://${weatherHost()}/geo/v2/city/lookup?location=${encodeURIComponent(name)}&key=${key}`
      )
      const j = await res.json()
      return j?.location?.[0]?.id ?? null
    } catch {
      return null
    }
  }

  async function fetchWeather() {
    const key = (settingsRef.value.weatherApiKey ?? '').trim()
    const city = (settingsRef.value.weatherCity ?? '').trim()
    if (!key || !city) return
    try {
      const locId = await resolveCityId(city, key)
      if (!locId) return
      const res = await fetch(
        `https://${weatherHost()}/v7/weather/now?location=${locId}&key=${key}`
      )
      const j = await res.json()
      if (j?.now?.temp != null && j?.now?.text) {
        weatherText.value = `${j.now.temp}° ${j.now.text}`
      }
    } catch {
      // 失败保持上一条或空
    }
  }

  function resetTimer(
    slot: Ref<ReturnType<typeof setInterval> | null>,
    intervalKey: string,
    fn: () => void
  ) {
    if (slot.value) {
      clearInterval(slot.value)
      slot.value = null
    }
    // collapse / never(仅启动一次)不设定时器;立即型由各自的 watch 触发
    const ms = INTERVAL_MS[intervalKey]
    if (ms) slot.value = setInterval(fn, ms)
  }

  function scheduleQuote() {
    if ((settingsRef.value.quoteSource ?? 'online') !== 'online') return
    const interval = settingsRef.value.quoteInterval ?? '30min'
    if (interval === 'collapse') {
      // 每次收起拉新:由 isNotched watch 触发
      return
    }
    if (interval === 'never') return // 仅启动/启用时拉一次(下方 init 已覆盖)
    resetTimer(quoteTimer, interval, fetchQuote)
  }

  function scheduleWeather() {
    const interval = settingsRef.value.weatherInterval ?? 'hour'
    if (interval === 'never') return
    resetTimer(weatherTimer, interval, fetchWeather)
  }

  // 启动/设置变化时调度;在线一言与天气启用时立即拉一次
  watch(
    () => [
      settingsRef.value.quoteSource,
      settingsRef.value.quoteInterval,
      settingsRef.value.quoteCategories
    ],
    () => {
      scheduleQuote()
      if ((settingsRef.value.quoteSource ?? 'online') === 'online') fetchQuote()
    },
    { immediate: true }
  )

  watch(
    () => [
      settingsRef.value.weatherApiKey,
      settingsRef.value.weatherCity,
      settingsRef.value.weatherInterval
    ],
    () => {
      scheduleWeather()
      fetchWeather()
    },
    { immediate: true }
  )

  // 每次收起拉新一言
  if (isNotchedRef) {
    watch(isNotchedRef, (notched) => {
      if (
        notched &&
        (settingsRef.value.quoteSource ?? 'online') === 'online' &&
        settingsRef.value.quoteInterval === 'collapse'
      ) {
        fetchQuote()
      }
    })
  }

  onUnmounted(() => {
    if (quoteTimer.value) clearInterval(quoteTimer.value)
    if (weatherTimer.value) clearInterval(weatherTimer.value)
  })

  return { quoteText, weatherText }
}
