const fs = require('fs')
const p = 'src/renderer/src/components/Settings.vue'
let c = fs.readFileSync(p, 'utf8')

// 1. Add ref="panelRef" to settings-panel
c = c.replace(
  '@click.stop>',
  '@click.stop>\n          <div ref="panelRef" class="settings-panel-inner">',
  1 // only first occurrence... but there might be multiple
)

// Actually, let me be more precise. The settings-panel Motion element ends with @click.stop>
// Let me find the exact line
const panelMatch = c.match(/(<Motion class="settings-panel"[^>]*@click\.stop>)/)
if (panelMatch) {
  c = c.replace(
    panelMatch[1],
    panelMatch[1] + '\n          <div ref="panelRef" class="settings-panel-inner">'
  )
}

// 2. Close the inner div before the toast Transition
c = c.replace(
  '          <!-- 保存成功提示 -->',
  '          </div>\n\n          <!-- 保存成功提示 -->'
)

// 3. Remove the second Teleport block (the dropdown one) and close the main Teleport properly
// Find and remove the dropdown Teleport block
const ddTeleportStart = c.indexOf('    <!-- 字号下拉 - Teleport 到 body')
if (ddTeleportStart > -1) {
  const ddTeleportEnd = c.indexOf('  </Teleport>\n</template>', ddTeleportStart)
  if (ddTeleportEnd > -1) {
    c = c.substring(0, ddTeleportStart) + '  </Teleport>\n</template>'
  }
}

// 4. Add dropdown markup inside the panel, after settings-body, before toast
// Find the closing of settings-body and insert the dropdown before toast
c = c.replace(
  '          </div>\n\n          <!-- 保存成功提示 -->',
  `          </div>

          <!-- 字号下拉 - 在 panel 内部，不受 overflow 裁切 -->
          <AnimatePresence>
            <Motion v-if="visible && fontSizeDropdown" class="font-select-dropdown"
              :initial="{ opacity: 0, y: -4, scale: 0.96 }"
              :animate="{ opacity: 1, y: 0, scale: 1 }"
              :exit="{ opacity: 0, y: -4, scale: 0.96 }"
              :transition="{ type: 'spring', stiffness: 400, damping: 28, mass: 0.5 }"
              :style="dropdownPos"
              @click.stop>
              <div class="font-select-list">
                <div v-for="s in fontSizeOptions" :key="s" class="font-select-item"
                  :class="{ active: settings.defaultFontSize === s }"
                  @click.stop="save('defaultFontSize', s); fontSizeDropdown = false">
                  {{ s }}
                </div>
              </div>
            </Motion>
          </AnimatePresence>

          <!-- 保存成功提示 -->`
)

// 5. Update CSS - change .font-select-dropdown from fixed to absolute, remove min-width
c = c.replace(
  `.font-select-dropdown {
  position: fixed;
  z-index: 10000;
  background: var(--bg-toolbar, #151516);
  border: 1px solid var(--border-strong, #3a3a3c);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  min-width: 80px;
}`,
  `.font-select-dropdown {
  position: absolute;
  z-index: 10;
  background: var(--bg-toolbar, #151516);
  border: 1px solid var(--border-strong, #3a3a3c);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  min-width: 80px;
}`
)

// 6. Make settings-panel position: relative for absolute children
c = c.replace(
  `.settings-panel {
  width: 320px;
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #1a1a1c);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  position: relative;
  flex-shrink: 0;
}`,
  `.settings-panel {
  width: 320px;
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  background: var(--bg-card, #1a1a1c);
  border: 1px solid var(--border, #2a2a2c);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  position: relative;
  flex-shrink: 0;
  overflow: visible;
}`
)

fs.writeFileSync(p, c, 'utf8')

// Verify
console.log('Has panelRef ref:', c.includes('ref="panelRef"'))
console.log('Has panelRef script:', c.includes('const panelRef'))
console.log('Dropdown in panel:', c.includes('字号下拉 - 在 panel 内部'))
console.log('No Teleport dropdown:', !c.includes('字号下拉 - Teleport'))
console.log('position absolute:', c.includes('position: absolute;\n  z-index: 10'))
