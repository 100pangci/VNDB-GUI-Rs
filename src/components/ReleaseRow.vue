<script setup lang="ts">
import { computed } from "vue";
import type { VNRelease } from "../core/models";
import { PLACEHOLDER } from "../core/models";
import {
  developerName,
  languageTagString,
  languagesDisplay,
  nonDeveloperGroupName,
  platformsDisplay,
  releaseDisplayTitle,
} from "../core/vndb";

const props = defineProps<{
  release: VNRelease;
  selected: boolean;
  flash: boolean;
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
    const langTag = languageTagString(r);
    const langText = langTag && langTag !== PLACEHOLDER ? `  |  ${langTag}` : "";
    return `${group}  |  ${date}${langText}`;
  }
  const dev = developerName(r);
  const devText = dev && dev !== PLACEHOLDER ? dev : "?";
  const langTag = languageTagString(r, true);
  const langText = langTag && langTag !== PLACEHOLDER ? langTag : languagesDisplay(r);
  return `${devText}  |  ${date}  |  ${platformsDisplay(r)}  |  ${langText}`;
});
</script>

<template>
  <div class="release-row" :class="{ selected, flash }" @click="$emit('click')">
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
.release-row.flash {
  animation: row-flash 1.6s ease;
  z-index: 1;
}
@keyframes row-flash {
  0% {
    background: var(--accent);
    box-shadow: 0 0 0 2px var(--accent), 0 0 14px var(--accent);
  }
  40% {
    background: var(--accent-soft);
    box-shadow: 0 0 0 2px var(--accent);
  }
  100% {
    background: var(--row-bg);
    box-shadow: none;
  }
}

.indicator {
  flex: 0 0 3px;
  border-radius: 1px;
  background: transparent;
  align-self: stretch;
}
.release-row.selected .indicator {
  background: var(--accent);
  animation: indicator-in 0.3s ease;
}
@keyframes indicator-in {
  from {
    transform: scaleY(0.2);
  }
  to {
    transform: scaleY(1);
  }
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
