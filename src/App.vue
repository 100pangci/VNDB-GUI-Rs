<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import ReleaseRow from "./components/ReleaseRow.vue";
import CandidateDialog from "./components/CandidateDialog.vue";
import CustomFormatDialog from "./components/CustomFormatDialog.vue";
import ContextMenu from "./components/ContextMenu.vue";
import {
  PALETTES,
  candidateState,
  cancelCandidates,
  chooseCandidate,
  copyFilename,
  copySimplifiedTitle,
  currentPalette,
  initConfig,
  isDark,
  linkState,
  onFormatSaved,
  onLinkClick,
  openProjectLink,
  previewFilename,
  search,
  selectNonZh,
  selectPalette,
  selectZh,
  state,
  toggleTheme,
} from "./core/store";

const formatOpen = ref(false);
const paletteOpen = ref(false);
const copiedBtn = ref<"copy" | "simple" | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | null = null;
const PROJECT_URL = "https://github.com/100pangci/VNDB-GUI-Rs";

async function onCopy(kind: "copy" | "simple") {
  if (kind === "copy") await copyFilename();
  else await copySimplifiedTitle();
  copiedBtn.value = kind;
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copiedBtn.value = null;
  }, 1400);
}

const previewText = computed(() => {
  if (!state.vnInfo) return "（等待搜索）";
  if (!previewFilename.value) return "（请选择原版发行）";
  return previewFilename.value;
});

const statusClass = computed(() => `status status-${state.statusKind}`);

function setTitleMode(useRelease: boolean) {
  state.useReleaseTitle = useRelease;
}

function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (paletteOpen.value && !target.closest(".palette-wrap")) {
    paletteOpen.value = false;
  }
}

function onDocKey(e: KeyboardEvent) {
  if (e.key === "Escape") paletteOpen.value = false;
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onDocKey);
  initConfig();
});

onUnmounted(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onDocKey);
  if (copyTimer) clearTimeout(copyTimer);
});
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="brand">
        <div class="logo" aria-hidden="true">V</div>
        <div class="brand-text">
          <h1 class="app-title">VNDB <span class="title-accent">视觉小说文件名生成器</span></h1>
          <p class="subtitle">输入 VNDB ID 或游戏原名，自动生成标准文件名</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="palette-wrap">
          <button
            class="palette-btn"
            :class="{ open: paletteOpen }"
            @click.stop="paletteOpen = !paletteOpen"
          >
            <span class="palette-btn-dot" :style="{ background: currentPalette.dark }"></span>
            配色
          </button>
          <Transition name="pop">
            <div v-if="paletteOpen" class="palette-pop">
              <div class="palette-title">配色方案</div>
              <div class="palette-grid">
                <button
                  v-for="p in PALETTES"
                  :key="p.id"
                  class="palette-item"
                  :class="{ active: p.id === state.palette }"
                  @click.stop="selectPalette(p.id)"
                >
                  <span class="swatch">
                    <span class="swatch-dot dark" :style="{ background: p.dark }"></span>
                    <span class="swatch-dot light" :style="{ background: p.light }"></span>
                  </span>
                  <span class="palette-name">{{ p.name }}</span>
                  <span v-if="p.id === state.palette" class="palette-check">✓</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
        <button class="theme-toggle" @click="toggleTheme">
          <span :key="isDark ? 'light' : 'dark'" class="theme-icon">{{ isDark ? "☀" : "🌙" }}</span>
          {{ isDark ? "浅色" : "深色" }}
        </button>
      </div>
    </header>

    <section class="query-card">
      <input
        v-model="state.query"
        class="query-input"
        placeholder="输入 VNDB ID 或游戏原名…"
        spellcheck="false"
        @keyup.enter="search()"
      />
      <button class="btn search-btn" :disabled="state.searching" @click="search()">
        <span v-if="state.searching" class="spinner"></span>
        {{ state.searching ? "搜索中…" : "搜索 API" }}
      </button>
      <span :key="state.statusText" :class="statusClass">{{ state.statusText }}</span>
    </section>

    <section class="panels">
      <div class="panel">
        <div class="panel-header nonzh-header">非中文发行</div>
        <TransitionGroup tag="div" name="row" class="release-list">
          <ReleaseRow
            v-for="(r, i) in state.nonZh"
            :key="r.id"
            :style="{ animationDelay: `${Math.min(i, 10) * 22}ms` }"
            :release="r"
            :selected="i === state.selectedNonzhIdx"
            :zh="false"
            @click="selectNonZh(i)"
          />
          <div v-if="!state.nonZh.length" key="empty" class="empty-hint">（无发行版本）</div>
        </TransitionGroup>
        <div class="panel-count">共 {{ state.nonZh.length }} 个版本</div>
      </div>

      <div class="divider"></div>

      <div class="panel zh-panel">
        <div class="panel-header zh-header">中文发行</div>
        <TransitionGroup tag="div" name="row" class="release-list">
          <ReleaseRow
            v-for="(r, i) in state.zh"
            :key="r.id"
            :style="{ animationDelay: `${Math.min(i, 10) * 22}ms` }"
            :release="r"
            :selected="i === state.selectedZhIdx"
            :zh="true"
            @click="selectZh(i)"
          />
          <div v-if="!state.zh.length" key="empty" class="empty-hint">（无中文版本）</div>
        </TransitionGroup>
        <div class="panel-count">共 {{ state.zh.length }} 个版本</div>
      </div>
    </section>

    <section class="manual-card">
      <div class="manual-top">
        <div class="segmented">
          <button
            class="segment"
            :class="{ active: !state.useReleaseTitle }"
            @click="setTitleMode(false)"
          >
            游戏标题
          </button>
          <button
            class="segment"
            :class="{ active: state.useReleaseTitle }"
            @click="setTitleMode(true)"
          >
            发行版标题
          </button>
        </div>
        <div class="manual-title">附加信息（点击中文发行列表自动填入）</div>
      </div>
      <div class="group-row">
        <label class="group-label" for="group-input">汉化组：</label>
        <input
          id="group-input"
          v-model="state.groupName"
          class="group-input"
          placeholder="如：XXX汉化组（点击中文发行列表自动填入）"
          spellcheck="false"
        />
      </div>
    </section>

    <section class="preview-card">
      <div class="preview-top">
        <div class="preview-title">文件名预览</div>
        <button class="btn link-btn" :class="{ waiting: linkState.waiting }" @click="onLinkClick">{{ linkState.text }}</button>
        <label class="switch">
          <input v-model="state.sanitizeEnabled" type="checkbox" />
          <span class="track"><span class="thumb"></span></span>
          <span class="switch-label">非法字符替换</span>
        </label>
      </div>
      <div class="preview-body">
        <div :key="previewText" class="preview-box">{{ previewText }}</div>
        <div class="copy-col">
          <button class="btn simple-btn" :class="{ done: copiedBtn === 'simple' }" @click="onCopy('simple')">
            {{ copiedBtn === "simple" ? "已复制 ✓" : "复制简要标题" }}
          </button>
          <button class="btn copy-btn" :class="{ done: copiedBtn === 'copy' }" @click="onCopy('copy')">
            {{ copiedBtn === "copy" ? "已复制 ✓" : "一键复制" }}
          </button>
        </div>
      </div>
    </section>

    <footer class="footer">
      <button class="btn format-btn" @click="formatOpen = true">自定义拼接格式</button>
      <span class="info-text">基于 VNDB API v2 ｜ 自动过滤 Windows 非法字符 ｜ 缺失信息显示「NO DATA」</span>
      <a class="project-link" @click="openProjectLink">{{ PROJECT_URL }}</a>
    </footer>

    <CandidateDialog
      v-if="candidateState.open"
      :candidates="candidateState.candidates"
      @select="chooseCandidate"
      @cancel="cancelCandidates"
    />
    <CustomFormatDialog
      v-if="formatOpen"
      :templates="state.formatTemplates"
      :active-name="state.activeFormatName"
      @save="(t, n) => { onFormatSaved(t, n); formatOpen = false; }"
      @cancel="formatOpen = false"
    />

    <ContextMenu />
  </div>
</template>
