<script setup lang="ts">
import type { VNCandidate } from "../core/models";

defineProps<{ candidates: VNCandidate[] }>();
defineEmits<{
  (e: "select", cand: VNCandidate): void;
  (e: "cancel"): void;
}>();

function displayTitle(c: VNCandidate): string {
  for (const t of c.titles) {
    if (t.lang === "ja" && t.title) return t.title;
  }
  return c.alttitle || c.title;
}

function displayText(c: VNCandidate): string {
  const display = displayTitle(c);
  const extra = c.alttitle || c.title;
  return extra && extra !== display ? `${display}  (${extra})  [${c.id}]` : `${display}  [${c.id}]`;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div class="dialog-overlay" @click.self="$emit('cancel')">
        <div class="dialog-card">
          <div class="dialog-title">找到多个匹配结果，请选择一个：</div>
          <div class="candidate-list">
            <button
              v-for="c in candidates"
              :key="c.id"
              class="candidate-btn"
              @click="$emit('select', c)"
            >
              {{ displayText(c) }}
            </button>
          </div>
          <div class="dialog-actions">
            <button class="btn cancel-btn" @click="$emit('cancel')">取消</button>
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
}
.dialog-card {
  width: 600px;
  max-width: calc(100vw - 60px);
  max-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 18px 20px;
}
.dialog-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 12px;
}
.candidate-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 5px;
  background: var(--bg-elev);
}
.candidate-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.12s ease;
}
.candidate-btn:hover {
  background: var(--row-hover);
}
.dialog-actions {
  display: flex;
  justify-content: center;
  padding-top: 14px;
}
.cancel-btn {
  width: 100px;
}
</style>
