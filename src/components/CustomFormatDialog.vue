<script setup lang="ts">
import { nextTick, reactive, ref } from "vue";
import { DEFAULT_FORMAT_TEMPLATE, DEFAULT_TEMPLATE_NAME, type FormatTemplate } from "../core/store";

const props = defineProps<{ templates: FormatTemplate[]; activeName: string }>();
const emit = defineEmits<{
  (e: "save", templates: FormatTemplate[], activeName: string): void;
  (e: "cancel"): void;
}>();

const VARS = ["{developer}", "{date}", "{title}", "{vid}", "{platform}", "{group}", "{patch_date}", "{language}"];

const templates = reactive<FormatTemplate[]>(
  props.templates.map((t) => ({ ...t })),
);
const activeIdx = ref(Math.max(0, templates.findIndex((t) => t.name === props.activeName)));

const inputEl = ref<HTMLInputElement | null>(null);
const renameEl = ref<HTMLInputElement | null>(null);
const editingIdx = ref<number | null>(null);
const editName = ref("");

const active = (): FormatTemplate => templates[activeIdx.value];

function insertVar(v: string) {
  const el = inputEl.value;
  const cur = active();
  if (!el) {
    cur.template += v;
    return;
  }
  const start = el.selectionStart ?? cur.template.length;
  const end = el.selectionEnd ?? cur.template.length;
  cur.template = cur.template.slice(0, start) + v + cur.template.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + v.length, start + v.length);
  });
}

function addTemplate() {
  let n = templates.length + 1;
  let name = `${DEFAULT_TEMPLATE_NAME} ${n}`;
  while (templates.some((t) => t.name === name)) {
    n++;
    name = `${DEFAULT_TEMPLATE_NAME} ${n}`;
  }
  templates.push({ name, template: DEFAULT_FORMAT_TEMPLATE });
  activeIdx.value = templates.length - 1;
  startRename(activeIdx.value);
}

function startRename(i: number) {
  editingIdx.value = i;
  editName.value = templates[i].name;
  nextTick(() => {
    const el = renameEl.value;
    if (el) {
      el.focus();
      el.select();
    }
  });
}

function commitRename() {
  if (editingIdx.value === null) return;
  const idx = editingIdx.value;
  editingIdx.value = null;
  const name = editName.value.trim() || DEFAULT_TEMPLATE_NAME;
  let finalName = name;
  let n = 2;
  while (templates.some((t) => t.name === finalName && t !== templates[idx])) {
    finalName = `${name} ${n}`;
    n++;
  }
  templates[idx].name = finalName;
}

function cancelRename() {
  editingIdx.value = null;
}

function removeAt(idx: number) {
  if (templates.length <= 1) return;
  templates.splice(idx, 1);
  if (activeIdx.value >= templates.length) {
    activeIdx.value = templates.length - 1;
  } else if (idx < activeIdx.value) {
    activeIdx.value -= 1;
  }
}

function restore() {
  active().template = DEFAULT_FORMAT_TEMPLATE;
}

function save() {
  const name = active().name.trim() || DEFAULT_TEMPLATE_NAME;
  let finalName = name;
  if (templates.some((t) => t.name === finalName && t !== active())) {
    let n = 2;
    while (templates.some((t) => t.name === `${finalName} ${n}`)) n++;
    finalName = `${finalName} ${n}`;
  }
  active().name = finalName;
  emit("save", templates.map((t) => ({ ...t })), active().name);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div class="dialog-overlay">
        <div class="dialog-card format-card">
          <div class="dialog-title">自定义文件名拼接格式</div>
          <div class="tpl-row">
            <span class="var-label">模板：</span>
            <div class="tpl-chips">
              <span
                v-for="(t, i) in templates"
                :key="i"
                class="tpl-chip"
                :class="{ active: i === activeIdx, editing: editingIdx === i }"
                @click="activeIdx = i"
                @dblclick="startRename(i)"
              >
                <input
                  v-if="editingIdx === i"
                  ref="renameEl"
                  v-model="editName"
                  class="tpl-chip-input"
                  spellcheck="false"
                  @click.stop
                  @keydown.enter.prevent="commitRename"
                  @keydown.esc="cancelRename"
                  @blur="commitRename"
                />
                <template v-else>
                  {{ t.name }}
                  <button
                    v-if="templates.length > 1"
                    class="tpl-chip-del"
                    title="删除模板"
                    @click.stop="removeAt(i)"
                  >
                    ×
                  </button>
                </template>
              </span>
              <button class="tpl-chip add" @click="addTemplate">＋ 新建</button>
            </div>
          </div>
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
            v-model="active().template"
            class="format-input"
            spellcheck="false"
            @keyup.enter="save()"
          />
          <div class="dialog-actions">
            <button class="btn success-btn" @click="save()">保存</button>
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
.tpl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.tpl-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.tpl-chip {
  position: relative;
  border: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--muted);
  font-size: 12px;
  border-radius: var(--radius-sm);
  padding: 3px 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
}
.tpl-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.tpl-chip.active {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}
.tpl-chip.add {
  border-style: dashed;
}
.tpl-chip-del {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 11px;
  line-height: 1;
  color: var(--muted);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.8);
  transition: opacity 0.12s ease, transform 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}
.tpl-chip:hover .tpl-chip-del {
  opacity: 1;
  transform: scale(1);
}
.tpl-chip-del:hover {
  border-color: var(--danger);
  color: var(--danger);
}
.tpl-chip-del:active {
  transform: scale(0.9);
}
.tpl-chip.editing {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.tpl-chip-input {
  width: 110px;
  padding: 1px 6px;
  font-size: 12px;
  color: var(--text);
  background: var(--bg-elev);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  outline: none;
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
  white-space: nowrap;
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
