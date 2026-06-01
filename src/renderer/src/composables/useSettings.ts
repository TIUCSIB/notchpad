import { ref, computed, watch } from 'vue'

const SETTINGS_DEFAULTS: Record<string, string> = {
  theme: 'dark',
  accentColor: '#4ade80',
  defaultFontSize: '14px',
  autoStart: 'false',
  wakeMode: 'hover'
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
