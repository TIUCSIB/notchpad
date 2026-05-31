<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'

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
    <div v-if="visible" class="link-overlay" @click.self="emit('cancel')">
      <div class="link-dialog">
        <div class="link-dialog-title">Insert Link</div>
        <input
          ref="inputRef"
          v-model="url"
          type="url"
          class="link-input"
          placeholder="https://example.com"
          @keydown="onKeydown"
        />
        <div class="link-dialog-actions">
          <button class="link-btn cancel" @click="emit('cancel')">Cancel</button>
          <button class="link-btn confirm" @click="onConfirm">OK</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.link-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg, rgba(0, 0, 0, 0.6));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.link-dialog {
  background: var(--bg-toolbar, #2a2a2a);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  min-width: 320px;
  border: 1px solid var(--border-strong, #3a3a3a);
}

.link-dialog-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #888);
  margin-bottom: 10px;
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
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
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
  background: #4ade80;
  color: #fff;
}

.link-btn.confirm:hover {
  background: #15803d;
}
</style>
