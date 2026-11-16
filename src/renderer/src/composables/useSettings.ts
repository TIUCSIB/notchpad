import { ref, computed, watch } from 'vue'
import { getTheme, themeVars } from '../themes'
import {
  clampInt,
  hexToRgba,
  resolveWallpaperText,
  wallpaperSurfaceVars,
  wallpaperVars,
  type WallpaperText,
  type WallpaperTone
} from '../utils/wallpaper'

/** 设置项的默认值。导出给设置面板复用,避免两处硬编码不一致。 */
export const SETTINGS_DEFAULTS: Record<string, string> = {
  theme: 'dark',
  /** 风格包:default / eye / warm / ink */
  themeId: 'default',
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
  weatherInterval: 'hour',
  /** 面板壁纸:附件 URL(由后端按平台拼好),空 = 不用壁纸 */
  wallpaperUrl: '',
  /** 壁纸整体明暗:light / dark,上传时用 8x8 采样算出 */
  wallpaperTone: 'light',
  /** 内容区(卡片/栏位)不透明度 0-100(%) */
  wallpaperOpacity: '78',
  /** 内容卡毛玻璃模糊 0-20(px),0 = 完全透视壁纸 */
  wallpaperCardBlur: '6',
  /** 主题色遮罩浓度 0-80(%) */
  wallpaperScrim: '25',
  /** 壁纸模糊像素 0-12 */
  wallpaperBlur: '0',
  /** 壁纸上的文字色:auto 跟随明暗 / light / dark */
  wallpaperText: 'auto'
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

  /** 壁纸渲染视图:URL / 遮罩色 / 模糊滤镜 / 文字明暗,供 App.vue 铺层 */
  const wallpaper = computed(() => {
    const s = appSettings.value
    const theme = getTheme(s.themeId)
    const palette = theme[isLightTheme.value ? 'light' : 'dark']
    const scrim = clampInt(s.wallpaperScrim, 25, 0, 80)
    const blur = clampInt(s.wallpaperBlur, 0, 0, 12)
    const tone: WallpaperTone = s.wallpaperTone === 'dark' ? 'dark' : 'light'
    return {
      enabled: Boolean(s.wallpaperUrl),
      url: s.wallpaperUrl || '',
      // 遮罩取主题底色,浓度按设置换算成 alpha;壁纸开启时底色仍能统一风格
      scrim: hexToRgba(palette.bgMain, scrim / 100),
      blur: blur > 0 ? `blur(${blur}px)` : 'none',
      text: resolveWallpaperText(tone, (s.wallpaperText || 'auto') as WallpaperText),
      cardBlur: clampInt(s.wallpaperCardBlur, 6, 0, 20)
    }
  })

  const appStyle = computed(() => {
    const theme = getTheme(appSettings.value.themeId)
    const mode = isLightTheme.value ? 'light' : 'dark'
    const vars = themeVars(theme, mode, accentColor.value)
    const wp = wallpaper.value
    if (wp.enabled) {
      // 卡片/栏位半透明露壁纸,文字/边框按明暗切;--bg-main 保持不透明,
      // 面板运动层(药丸态)仍用它做纯色背景
      Object.assign(
        vars,
        wallpaperSurfaceVars(
          theme[mode].bgCard,
          theme[mode].bgBar,
          theme[mode].bgToolbar,
          clampInt(appSettings.value.wallpaperOpacity, 78, 0, 100)
        ),
        wallpaperVars(wp.text),
        { '--wallpaper-card-blur': `${wp.cardBlur}px` }
      )
    }
    vars['--editor-font-size'] =
      appSettings.value.defaultFontSize || SETTINGS_DEFAULTS.defaultFontSize
    return vars
  })

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
    wallpaper,
    initSettingsListeners,
    cleanupSettings,
    loadSettings
  }
}
