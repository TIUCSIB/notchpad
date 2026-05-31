const fs = require('fs')
let c = fs.readFileSync('./src/renderer/src/components/Settings.vue', 'utf8')

// The core problem: the non-scoped <style> might not be applying to
// teleported content in Electron. Let's check if styles have data-v attrs.
// But more importantly, let's check if the settings-panel animation
// is leaving a transform that shifts the click area.

// Check if animation is properly cleaned up
const hasAnimation = c.includes('animation: settingsPanelIn')
const hasOverflowHidden = c.includes('overflow: hidden')
const hasBorderRadius = c.includes('border-radius: 12px')

console.log('Has panel animation:', hasAnimation)
console.log('Has overflow hidden:', hasOverflowHidden)
console.log('Has border-radius:', hasBorderRadius)

// Print the template structure
const lines = c.split('\n')
let inTemplate = false
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<template>')) inTemplate = true
  if (lines[i].includes('</template>')) inTemplate = false
  if (
    inTemplate &&
    (lines[i].includes('close') ||
      lines[i].includes('settings-header') ||
      lines[i].includes('settings-panel') ||
      lines[i].includes('settings-overlay'))
  ) {
    console.log(`Line ${i}: ${lines[i].trim()}`)
  }
}
