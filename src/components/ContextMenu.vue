<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";

type TextField = HTMLInputElement | HTMLTextAreaElement;

const visible = ref(false);
const x = ref(0);
const y = ref(0);
const canCut = ref(false);
const canCopy = ref(false);
const canPaste = ref(false);

const menuEl = ref<HTMLElement | null>(null);
let target: HTMLElement | null = null;
let targetEditable = false;

function isTextField(el: Element | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "submit", "reset", "file", "range", "color", "image"].includes(
      el.type,
    );
  }
  return false;
}

function isEditable(el: Element | null): boolean {
  return isTextField(el) || (el instanceof HTMLElement && el.isContentEditable);
}

/* 右键目标自身直接持有文本（如预览框），视为文字区域 */
function isPlainTextHost(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (["BUTTON", "A", "LABEL", "SELECT", "SUMMARY", "OPTION"].includes(el.tagName)) return false;
  for (const n of el.childNodes) {
    if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) return true;
  }
  return false;
}

function selRange(el: TextField): [number, number] {
  return [el.selectionStart ?? 0, el.selectionEnd ?? 0];
}

function selectionText(): string {
  const el = target;
  if (!el) return "";
  if (isTextField(el)) {
    const [s, e] = selRange(el);
    return s === e ? "" : el.value.slice(s, e);
  }
  return window.getSelection()?.toString() ?? "";
}

function onContextMenu(e: MouseEvent) {
  e.preventDefault();
  close();

  const el = e.target instanceof Element ? e.target : null;
  const editable = !!el && isEditable(el);
  const sel = window.getSelection();
  const hasSelection = !!sel && sel.type === "Range" && !!sel.toString().trim();
  if (!editable && !hasSelection && !(el && isPlainTextHost(el))) return;

  target = el instanceof HTMLElement ? el : null;
  targetEditable = editable;
  x.value = e.clientX;
  y.value = e.clientY;

  canCopy.value = hasSelection || (editable && selectionText().length > 0);
  canCut.value = editable && canCopy.value;
  canPaste.value = false;

  visible.value = true;
  nextTick(clampPosition);

  readText()
    .then((t) => {
      if (visible.value && targetEditable) canPaste.value = t.length > 0;
    })
    .catch(() => {});
}

function clampPosition() {
  const m = menuEl.value;
  if (!m) return;
  const r = m.getBoundingClientRect();
  x.value = Math.max(8, Math.min(x.value, window.innerWidth - r.width - 8));
  y.value = Math.max(8, Math.min(y.value, window.innerHeight - r.height - 8));
}

function close() {
  visible.value = false;
  target = null;
  targetEditable = false;
}

async function doCopy() {
  const text = selectionText();
  if (!text) return;
  try {
    await writeText(text);
  } catch {}
  close();
}

async function doCut() {
  const text = selectionText();
  if (!text) return;
  try {
    await writeText(text);
  } catch {}
  deleteOrInsert("");
  close();
}

async function doPaste() {
  const el = target;
  if (!el || !targetEditable) return;
  let text = "";
  try {
    text = await readText();
  } catch {
    close();
    return;
  }
  if (!text) return;
  deleteOrInsert(text);
  close();
}

/* 在右键目标的选区处替换文本，并派发 input 事件以同步 v-model */
function deleteOrInsert(text: string) {
  const el = target;
  if (!el) return;
  el.focus({ preventScroll: true });
  if (isTextField(el)) {
    const [s, e] = selRange(el);
    el.setRangeText(text, s, e, "end");
  } else if (text) {
    document.execCommand("insertText", false, text);
    return;
  } else {
    document.execCommand("delete");
    return;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function onDocMouseDown(e: MouseEvent) {
  if (!visible.value) return;
  const t = e.target instanceof Node ? e.target : null;
  if (menuEl.value && t && menuEl.value.contains(t)) return;
  close();
}

function onDocKey(e: KeyboardEvent) {
  if (visible.value && e.key === "Escape") close();
}

function onHide() {
  if (visible.value) close();
}

onMounted(() => {
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("mousedown", onDocMouseDown, true);
  document.addEventListener("keydown", onDocKey);
  window.addEventListener("resize", onHide);
  window.addEventListener("scroll", onHide, true);
  window.addEventListener("blur", onHide);
});

onUnmounted(() => {
  document.removeEventListener("contextmenu", onContextMenu);
  document.removeEventListener("mousedown", onDocMouseDown, true);
  document.removeEventListener("keydown", onDocKey);
  window.removeEventListener("resize", onHide);
  window.removeEventListener("scroll", onHide, true);
  window.removeEventListener("blur", onHide);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="visible"
        ref="menuEl"
        class="ctx-menu"
        :style="{ left: `${x}px`, top: `${y}px` }"
        @contextmenu.prevent
        @mousedown.prevent
      >
        <button class="ctx-item" :disabled="!canCut" @click="doCut">
          <span>剪切</span>
          <span class="ctx-key">Ctrl+X</span>
        </button>
        <button class="ctx-item" :disabled="!canCopy" @click="doCopy">
          <span>复制</span>
          <span class="ctx-key">Ctrl+C</span>
        </button>
        <div class="ctx-sep"></div>
        <button class="ctx-item" :disabled="!canPaste" @click="doPaste">
          <span>粘贴</span>
          <span class="ctx-key">Ctrl+V</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ctx-menu {
  position: fixed;
  z-index: 300;
  min-width: 172px;
  padding: 5px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  user-select: none;
}
.ctx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}
.ctx-item:hover:not(:disabled) {
  background: var(--row-hover);
}
.ctx-item:active:not(:disabled) {
  background: var(--accent-soft);
  color: var(--accent);
}
.ctx-item:disabled {
  color: var(--muted);
  opacity: 0.55;
  cursor: not-allowed;
}
.ctx-key {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--muted);
}
.ctx-item:disabled .ctx-key {
  opacity: 0.6;
}
.ctx-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--border);
}
</style>
