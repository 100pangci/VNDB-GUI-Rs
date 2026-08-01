<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ReleaseRow from "./components/ReleaseRow.vue";
import CandidateDialog from "./components/CandidateDialog.vue";
import CustomFormatDialog from "./components/CustomFormatDialog.vue";
import {
  candidateState,
  cancelCandidates,
  chooseCandidate,
  copyFilename,
  copySimplifiedTitle,
  initConfig,
  isDark,
  linkState,
  onFormatSaved,
  onLinkClick,
  openProjectLink,
  previewFilename,
  search,
  selectNonZh,
  selectZh,
  state,
  toggleTheme,
} from "./core/store";

const formatOpen = ref(false);
const PROJECT_URL = "https://github.com/100pangci/VNDB-GUI";

const previewText = computed(() => {
  if (!state.vnInfo) return "（等待搜索）";
  if (!previewFilename.value) return "（请选择原版发行）";
  return previewFilename.value;
});

const statusClass = computed(() => `status status-${state.statusKind}`);

function setTitleMode(useRelease: boolean) {
  state.useReleaseTitle = useRelease;
}

onMounted(initConfig);
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-text">
        <h1 class="app-title">VNDB <span class="title-accent">视觉小说文件名生成器</span></h1>
        <p class="subtitle">输入 VNDB ID（如 v2622）或游戏原名，自动生成标准文件名</p>
      </div>
      <button class="theme-toggle" @click="toggleTheme">
        {{ isDark ? "☀ 浅色" : "🌙 深色" }}
      </button>
    </header>

    <section class="query-card">
      <input
        v-model="state.query"
        class="query-input"
        placeholder="输入 VNDB ID（如 v2622）或游戏原名…"
        spellcheck="false"
        @keyup.enter="search()"
      />
      <button class="btn search-btn" :disabled="state.searching" @click="search()">
        {{ state.searching ? "搜索中…" : "搜索 API" }}
      </button>
      <span :class="statusClass">{{ state.statusText }}</span>
    </section>

    <section class="panels">
      <div class="panel">
        <div class="panel-header nonzh-header">非中文发行</div>
        <div class="release-list">
          <ReleaseRow
            v-for="(r, i) in state.nonZh"
            :key="r.id"
            :release="r"
            :selected="i === state.selectedNonzhIdx"
            :zh="false"
            @click="selectNonZh(i)"
          />
          <div v-if="!state.nonZh.length" class="empty-hint">（无发行版本）</div>
        </div>
        <div class="panel-count">共 {{ state.nonZh.length }} 个版本</div>
      </div>

      <div class="divider"></div>

      <div class="panel zh-panel">
        <div class="panel-header zh-header">中文发行</div>
        <div class="release-list">
          <ReleaseRow
            v-for="(r, i) in state.zh"
            :key="r.id"
            :release="r"
            :selected="i === state.selectedZhIdx"
            :zh="true"
            @click="selectZh(i)"
          />
          <div v-if="!state.zh.length" class="empty-hint">（无中文版本）</div>
        </div>
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
          placeholder="如：Makura Castle（点击中文发行列表自动填入）"
          spellcheck="false"
        />
      </div>
    </section>

    <section class="preview-card">
      <div class="preview-top">
        <div class="preview-title">文件名预览</div>
        <button class="btn link-btn" @click="onLinkClick">{{ linkState.text }}</button>
        <label class="switch">
          <input v-model="state.sanitizeEnabled" type="checkbox" />
          <span class="track"><span class="thumb"></span></span>
          <span class="switch-label">非法字符替换</span>
        </label>
      </div>
      <div class="preview-body">
        <div class="preview-box">{{ previewText }}</div>
        <div class="copy-col">
          <button class="btn copy-btn" @click="copyFilename()">一键复制</button>
          <button class="btn simple-btn" @click="copySimplifiedTitle()">复制简要标题</button>
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
      :initial="state.customTemplate"
      @save="(t) => { onFormatSaved(t); formatOpen = false; }"
      @cancel="formatOpen = false"
    />
  </div>
</template>
