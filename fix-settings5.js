const fs = require('fs')
const p = 'src/renderer/src/components/Settings.vue'
let c = fs.readFileSync(p, 'utf8')

// 1. Add panelRef
c = c.replace(
  'const settingsBodyRef = ref<HTMLElement | null>(null)',
  'const settingsBodyRef = ref<HTMLElement | null>(null)\nconst panelRef = ref<HTMLElement | null>(null)'
)

// 2. Replace updateDropdownPos to be relative to panel
c = c.replace(
  `function updateDropdownPos() {
  if (!fontSelectRef.value) return
  const rect = fontSelectRef.value.getBoundingClientRect()
  const ddHeight = 220
  const spaceBelow = window.innerHeight - rect.bottom - 8
  if (spaceBelow < ddHeight) {
    dropdownPos.value = { top: rect.top - ddHeight - 4 + 'px', left: rect.left + 'px' }
  } else {
    dropdownPos.value = { top: rect.bottom + 4 + 'px', left: rect.left + 'px' }
  }
}`,
  `function updateDropdownPos() {
  if (!fontSelectRef.value || !panelRef.value) return
  const panelRect = panelRef.value.getBoundingClientRect()
  const triggerRect = fontSelectRef.value.getBoundingClientRect()
  const ddHeight = 220
  const triggerTopInPanel = triggerRect.top - panelRect.top
  const triggerBottomInPanel = triggerRect.bottom - panelRect.top
  const left = triggerRect.left - panelRect.left
  const spaceBelow = panelRect.height - triggerBottomInPanel - 8
  if (spaceBelow < ddHeight) {
    dropdownPos.value = { top: (triggerTopInPanel - ddHeight - 4) + 'px', left: left + 'px' }
  } else {
    dropdownPos.value = { top: (triggerBottomInPanel + 4) + 'px', left: left + 'px' }
  }
}`
)

// 3. Remove onWindowResize and resize listener (not needed anymore - panel-relative)
c = c.replace(
  'function onWindowResize() { if (fontSizeDropdown.value) updateDropdownPos() }\n\n',
  ''
)
c = c.replace("  window.addEventListener('resize', onWindowResize)\n", '')
c = c.replace("  window.removeEventListener('resize', onWindowResize)\n", '')

fs.writeFileSync(p, c, 'utf8')
console.log('Script section updated')
console.log('Has panelRef:', c.includes('panelRef'))
