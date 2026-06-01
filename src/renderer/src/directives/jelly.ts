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
    const onMouseEnter = () => {
      el.classList.remove('jelly-animating')
      void el.offsetWidth
      el.classList.add('jelly-animating')
    }
    const onAnimationEnd = () => {
      el.classList.remove('jelly-animating')
    }
    el.addEventListener('mouseenter', onMouseEnter)
    el.addEventListener('animationend', onAnimationEnd)
    ;(el as any).__jellyListeners = { onMouseEnter, onAnimationEnd }
  },
  unmounted(el) {
    const listeners = (el as any).__jellyListeners
    if (listeners) {
      el.removeEventListener('mouseenter', listeners.onMouseEnter)
      el.removeEventListener('animationend', listeners.onAnimationEnd)
      delete (el as any).__jellyListeners
    }
  }
}
