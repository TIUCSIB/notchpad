import { ref, computed, watch } from 'vue'

/** 设置项的默认值。导出给设置面板复用,避免两处硬编码不一致。 */
export const SETTINGS_DEFAULTS: Record<string, string> = {
  theme: 'dark',
  accentColor: '#4ade80',
  defaultFontSize: '14px',
  autoStart: 'false',
  wakeMode: 'hover',
  maxPages: '10',
  /** 药丸显示内容,逗号分隔的来源:clock / quote / weather / custom;off 或空 = 不显示 */
  pillSources: 'off',
  /** 自定义文字(仅 pillSources 含 custom 时显示) */
  pillCustomText: '',
  /** 一言来源:online(hitokoto)/ local(内置语录);分类见 quoteCategories */
  quoteSource: 'online',
  /** 一言更新:5min / 30min / 3hour / day / collapse(每次收起)/ never(仅启用时) */
  quoteInterval: '30min',
  /** hitokoto 分类,逗号分隔(a 动画 b 漫画 c 游戏 d 文学 e 原创 i 诗词 k 哲学…);空 = 全部 */
  quoteCategories: '',
  /** 和风天气 API Key(开发者控制台创建) */
  weatherApiKey: '',
  /** 和风 API Host:新账号用控制台分配的专属 Host(如 xxx.re.qweatherapi.com),留空走公共域名 */
  weatherApiHost: '',
  /** 天气城市名(如:北京),由和风 GeoAPI 解析 */
  weatherCity: '',
  /** 天气更新:30min / hour / 3hour / day / never */
  weatherInterval: 'hour'
}

export function useSettings() {
  const appSettings = ref<Record<string, string>>({ ...SETTINGS_DEFAULTS })

  const accentColor = computed(() => appSettings.value.accentColor || SETTINGS_DEFAULTS.accentColor)
  const osThemeDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
  const osMedia = window.matchMedia('(prefers-color-scheme: dark)')

  const onOsThemeChange = (e: MediaQueryListEvent) => {
    osThemeDark.value = e.matches
  }

  const isLightTheme = computed(() => {
    const t = appSettings.value.theme
    if (t === 'system') return !osThemeDark.value
    return t === 'light'
  })

  const appStyle = computed(() => ({
    '--accent': accentColor.value,
    '--accent-dim': accentColor.value + '20',
    '--bg-main': isLightTheme.value ? '#faf6f0' : '#000',
    '--bg-card': isLightTheme.value ? '#f5f0e8' : '#0f1014',
    '--bg-bar': isLightTheme.value ? '#ede8df' : '#1a1a1a',
    '--bg-toolbar': isLightTheme.value ? '#e5dfd4' : '#151516',
    '--text-primary': isLightTheme.value ? '#3d3629' : '#e5e5e5',
    '--text-secondary': isLightTheme.value ? '#666' : '#888',
    '--border': isLightTheme.value ? '#ddd' : '#2a2a2c',
    '--border-strong': isLightTheme.value ? '#ccc' : '#3a3a3c',
    '--hover-bg': isLightTheme.value ? '#d9d3c6' : '#3a3a3a',
    '--hover-bg-strong': isLightTheme.value ? '#ccc5b8' : '#4a4a4a',
    '--input-bg': isLightTheme.value ? '#fff' : '#1e1e1e',
    '--overlay-bg': isLightTheme.value ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.4)',
    '--label-color': isLightTheme.value ? '#888' : '#aaa',
    '--active-bg': isLightTheme.value ? '#d1cbbf' : '#3a3a3c',
    '--divider': isLightTheme.value ? '#ddd' : '#2a2a2c',
    '--danger-text': '#dc2626',
    '--danger-hover': isLightTheme.value ? '#fecaca' : '#3a1a1a',
    '--editor-font-size': appSettings.value.defaultFontSize || SETTINGS_DEFAULTS.defaultFontSize
  }))

  function applyRootVars(vars: Record<string, string>) {
    for (const [k, v] of Object.entries(vars)) {
      document.documentElement.style.setProperty(k, v)
    }
  }

  watch(appStyle, (val) => applyRootVars(val as Record<string, string>), { immediate: true })

  function initSettingsListeners() {
    osMedia.addEventListener('change', onOsThemeChange)
  }

  function cleanupSettings() {
    osMedia.removeEventListener('change', onOsThemeChange)
  }

  async function loadSettings() {
    const saved = await window.api.getSettings()
    if (saved && Object.keys(saved).length) {
      appSettings.value = { ...SETTINGS_DEFAULTS, ...saved }
    }
  }

  return {
    appSettings,
    accentColor,
    isLightTheme,
    appStyle,
    initSettingsListeners,
    cleanupSettings,
    loadSettings
  }
}
