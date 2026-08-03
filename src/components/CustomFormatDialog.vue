<script setup lang="ts">
import { ref } from "vue";
import { DEFAULT_FORMAT_TEMPLATE } from "../core/store";

const props = defineProps<{ initial: string }>();
const emit = defineEmits<{
  (e: "save", template: string): void;
  (e: "cancel"): void;
}>();

const VARS = ["{developer}", "{date}", "{title}", "{vid}", "{platform}", "{group}", "{patch_date}", "{language}"];

const template = ref(props.initial);
const inputEl = ref<HTMLInputElement | null>(null);

function insertVar(v: string) {
  const el = inputEl.value;
  if (!el) {
    template.value += v;
    return;
  }
  const start = el.selectionStart ?? template.value.length;
  const end = el.selectionEnd ?? template.value.length;
  template.value = template.value.slice(0, start) + v + template.value.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + v.length, start + v.length);
  });
}

function restore() {
  template.value = DEFAULT_FORMAT_TEMPLATE;
  emit("save", template.value);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div class="dialog-overlay">
        <div class="dialog-card format-card">
          <div class="dialog-title">自定义文件名拼接格式</div>
          <div class="var-row">
            <span class="var-label">可用变量：</span>
            <button
              v-for="(v, i) in VARS"
              :key="v"
              class="var-chip"
              :style="{ animationDelay: `${i * 20}ms` }"
              @click="insertVar(v)"
            >
              {{ v }}
            </button>
          </div>
          <input
            ref="inputEl"
            v-model="template"
            class="format-input"
            spellcheck="false"
            @keyup.enter="$emit('save', template)"
          />
          <div class="dialog-actions">
            <button class="btn success-btn" @click="$emit('save', template)">保存</button>
            <button class="btn restore-btn" @click="restore">恢复默认</button>
            <button class="btn neutral-btn" @click="$emit('cancel')">取消</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg) 62%, transparent);
  backdrop-filter: blur(4px);
}
.dialog-card {
  width: 600px;
  max-width: calc(100vw - 60px);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 18px 20px;
}
.dialog-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}
.var-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.var-label {
  font-size: 11px;
  color: var(--muted);
  margin-right: 2px;
}
.var-chip {
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--accent);
  font-size: 11.5px;
  font-family: var(--font-mono);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, transform 0.1s ease;
  animation: chip-in 0.25s ease backwards;
}
.var-chip:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.var-chip:active {
  transform: scale(0.92);
}
@keyframes chip-in {
  from {
    opacity: 0;
    transform: translateY(5px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.format-input {
  width: 100%;
  padding: 9px 12px;
  font-size: 13px;
  font-family: var(--font-mono);
  color: var(--text);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 0.15s ease;
}
.format-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}
</style>
