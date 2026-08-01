<script setup lang="ts">
import { computed } from "vue";
import type { VNRelease } from "../core/models";
import { PLACEHOLDER } from "../core/models";
import {
  developerName,
  languagesDisplay,
  nonDeveloperGroupName,
  platformsDisplay,
  releaseDisplayTitle,
} from "../core/vndb";

const props = defineProps<{
  release: VNRelease;
  selected: boolean;
  zh: boolean;
}>();

defineEmits<{ (e: "click"): void }>();

const title = computed(() => releaseDisplayTitle(props.release));

const info = computed(() => {
  const r = props.release;
  const date = r.released || "????-??-??";
  if (props.zh) {
    const grp = nonDeveloperGroupName(r);
    const group = grp && grp !== PLACEHOLDER ? grp : "无汉化组数据";
    return `${group}  |  ${date}`;
  }
  const dev = developerName(r);
  const devText = dev && dev !== PLACEHOLDER ? dev : "?";
  return `${devText}  |  ${date}  |  ${platformsDisplay(r)}  |  ${languagesDisplay(r)}`;
});
</script>

<template>
  <div class="release-row" :class="{ selected }" @click="$emit('click')">
    <div class="indicator"></div>
    <div class="row-body">
      <div class="row-title">{{ title }}</div>
      <div class="row-info">{{ info }}</div>
    </div>
  </div>
</template>

<style scoped>
.release-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
  padding: 6px 8px 6px 4px;
  border-radius: var(--radius-sm);
  background: var(--row-bg);
  cursor: pointer;
  transition: background 0.12s ease;
  user-select: none;
}
.release-row:hover {
  background: var(--row-hover);
}
.release-row.selected {
  background: var(--row-selected-bg);
}

.indicator {
  flex: 0 0 3px;
  border-radius: 1px;
  background: transparent;
  align-self: stretch;
}
.release-row.selected .indicator {
  background: var(--accent);
}

.row-body {
  min-width: 0;
  flex: 1;
}
.row-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}
.release-row.selected .row-title {
  color: var(--accent);
}
.row-info {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.5;
}
</style>
