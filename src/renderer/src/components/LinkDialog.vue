<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { Motion, AnimatePresence } from 'motion-v'

const props = defineProps<{
  visible: boolean
  initialUrl?: string
}>()

const emit = defineEmits<{
  (e: 'confirm', url: string): void
  (e: 'cancel'): void
}>()

const url = ref(props.initialUrl || 'https://')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (v) {
      url.value = props.initialUrl || 'https://'
      nextTick(() => inputRef.value?.focus())
    }
  }
)

function onConfirm() {
  emit('confirm', url.value.trim())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') onConfirm()
  if (e.key === 'Escape') emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <Motion v-if="visible" class="link-overlay" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }" :transition="{ duration: 0.2, ease: 'easeInOut' }" @click.self="emit('cancel')">
        <Motion class="link-dialog" :initial="{ opacity: 0, y: -10, scale: 0.96 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }" :exit="{ opacity: 0, y: -10, scale: 0.96 }"
          :transition="{ type: 'spring', stiffness: 400, damping: 28, mass: 0.6 }" @click.stop>
          <div class="link-dialog-title">插入链接</div>
          <input ref="inputRef" v-model="url" type="url" class="link-input" placeholder="https://example.com"
            @keydown="onKeydown" />
          <div class="link-dialog-actions">
            <button class="link-btn cancel" @click="emit('cancel')">取消</button>
            <button class="link-btn confirm" @click="onConfirm">确定</button>
          </div>
        </Motion>
      </Motion>
    </AnimatePresence>
  </Teleport>
</template>

<style scoped>
.link-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg, rgba(0, 0, 0, 0.4));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  border-radius: 0 0 20px 20px;
}

.link-dialog {
  background: var(--bg-toolbar, #2a2a2a);
  border-radius: 10px;
  padding: 16px;
  min-width: 320px;
}

.link-dialog-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #888);
  margin-bottom: 10px;
}

.link-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border-strong, #444);
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  background: var(--input-bg, #1e1e1e);
  color: var(--text-primary, #e5e5e5);
}

.link-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}

.link-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.link-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.link-btn.cancel {
  background: var(--hover-bg, #333);
  color: var(--text-secondary, #999);
}

.link-btn.cancel:hover {
  background: var(--hover-bg-strong, #444);
}

.link-btn.confirm {
  background: var(--accent);
  color: #fff;
}

.link-btn.confirm:hover {
  filter: brightness(0.8);
}
</style>
