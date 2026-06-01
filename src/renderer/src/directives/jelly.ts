import type { Directive } from 'vue'

// Inject jelly keyframes once
let injected = false
function ensureKeyframes() {
  if (injected) return
  injected = true
  const style = document.createElement('style')
  style.textContent = `
@keyframes jelly-click {
  0%   { transform: scale(1, 1); }
  20%  { transform: scale(1.18, 0.82); }
  40%  { transform: scale(0.92, 1.1); }
  60%  { transform: scale(1.05, 0.95); }
  80%  { transform: scale(0.98, 1.02); }
  100% { transform: scale(1, 1); }
}
.jelly-animating {
  animation: jelly-click 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
`
  document.head.appendChild(style)
}

export const vJelly: Directive<HTMLElement> = {
  mounted(el) {
    ensureKeyframes()
    el.addEventListener('mouseenter', () => {
      // Remove class first to allow re-trigger
      el.classList.remove('jelly-animating')
      // Force reflow so the animation restarts
      void el.offsetWidth
      el.classList.add('jelly-animating')
    })
    el.addEventListener('animationend', () => {
      el.classList.remove('jelly-animating')
    })
  }
}
