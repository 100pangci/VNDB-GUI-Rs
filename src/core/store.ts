import { computed, reactive, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { VNCandidate, VNInfo, VNRelease } from "./models";
import { PLACEHOLDER } from "./models";
import {
  formatReleased,
  isChineseRelease,
  languageLabel,
  nonDeveloperGroupName,
  nonZhSortKey,
  originalTitle,
  zhSortKey,
} from "./vndb";
import { generateCustomFilename, generateFilename, sanitizeFilename } from "./filename";

export const DEFAULT_FORMAT_TEMPLATE =
  "[{developer}][{date}]{title}[{vid}][{platform}][{group}][{patch_date}][{language}]";
export const DEFAULT_TEMPLATE_NAME = "默认模板";
export const PROJECT_URL = "https://github.com/100pangci/VNDB-GUI-Rs";
export const APP_VERSION = "1.0.1";

export interface FormatTemplate {
  name: string;
  template: string;
}

export type ThemeMode = "System" | "Dark" | "Light";
export type StatusKind = "info" | "success" | "error";

export interface PaletteDef {
  id: string;
  name: string;
  dark: string;
  light: string;
}

export const PALETTES: PaletteDef[] = [
  { id: "default", name: "经典蓝", dark: "#3d8bfd", light: "#2f6fd0" },
  { id: "violet", name: "紫罗兰", dark: "#9d7bff", light: "#6d5ae0" },
  { id: "cyan", name: "冰青", dark: "#3dc6ea", light: "#0f9fc2" },
  { id: "pink", name: "玫红", dark: "#ff7aa2", light: "#e05a84" },
  { id: "orange", name: "暖橙", dark: "#f5a54a", light: "#d9822f" },
  { id: "gray", name: "石墨", dark: "#9aa3b2", light: "#5a6170" },
];

const PALETTE_IDS = new Set(PALETTES.map((p) => p.id));

export interface AppConfig {
  appearance_mode: string;
  format_template: string;
  color_palette: string;
  format_templates?: FormatTemplate[];
  format_template_name?: string;
}

interface SearchOutcome {
  kind: "vn" | "multiple";
  candidates?: VNCandidate[];
  vn?: VNInfo;
}

export const state = reactive({
  query: "",
  searching: false,

  statusText: "",
  statusKind: "info" as StatusKind,

  vnInfo: null as VNInfo | null,
  allReleases: [] as VNRelease[],
  nonZh: [] as VNRelease[],
  zh: [] as VNRelease[],

  selectedNonzhIdx: 0,
  selectedZhIdx: 0,
  focusSide: "nonzh" as "nonzh" | "zh",

  groupName: "",
  patchDate: "",
  language: "CHS",

  useReleaseTitle: false,
  sanitizeEnabled: true,

  themeMode: "System" as ThemeMode,
  palette: "default",
  formatTemplates: [] as FormatTemplate[],
  activeFormatName: "",

  vnUrl: null as string | null,
});

export const candidateState = reactive({
  open: false,
  candidates: [] as VNCandidate[],
});

export const linkState = reactive({
  waiting: false,
  text: "复制页面链接",
});

let statusTimer: ReturnType<typeof setTimeout> | null = null;
let linkTimer: ReturnType<typeof setTimeout> | null = null;

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

export const isDark = computed(() => {
  if (state.themeMode === "Dark") return true;
  if (state.themeMode === "Light") return false;
  return systemDark.matches;
});

watch(
  isDark,
  (dark) => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  },
  { immediate: true },
);

watch(
  () => state.palette,
  (palette) => {
    document.documentElement.dataset.palette = palette;
  },
  { immediate: true },
);

export const currentPalette = computed(
  () => PALETTES.find((p) => p.id === state.palette) ?? PALETTES[0],
);

systemDark.addEventListener("change", () => {
  if (state.themeMode === "System") {
    document.documentElement.dataset.theme = systemDark.matches ? "dark" : "light";
  }
});

export const activeRelease = computed<VNRelease | null>(() => {
  if (state.focusSide === "nonzh" && state.nonZh.length) {
    return state.nonZh[state.selectedNonzhIdx];
  }
  if (state.focusSide === "zh" && state.zh.length) {
    return state.zh[state.selectedZhIdx];
  }
  if (state.nonZh.length) return state.nonZh[state.selectedNonzhIdx];
  if (state.zh.length) return state.zh[state.selectedZhIdx];
  return null;
});

export const baseRelease = computed<VNRelease | null>(() => {
  if (state.nonZh.length) return state.nonZh[state.selectedNonzhIdx];
  if (state.zh.length) return state.zh[state.selectedZhIdx];
  return null;
});

export const activeFormat = computed<FormatTemplate | null>(
  () =>
    state.formatTemplates.find((t) => t.name === state.activeFormatName) ?? null,
);

export const savedFormat = computed<string>(() => activeFormat.value?.template ?? "");

export const previewFilename = computed<string>(() => {
  if (!state.vnInfo) return "";
  const base = baseRelease.value;
  if (!base) return "";
  if (savedFormat.value) {
    return generateCustomFilename(savedFormat.value, state.vnInfo, base, {
      groupName: state.groupName,
      patchDate: state.patchDate,
      language: state.language,
      useReleaseTitle: state.useReleaseTitle,
      sanitizeEnabled: state.sanitizeEnabled,
      activeRelease: activeRelease.value,
    });
  }
  return generateFilename(state.vnInfo, base, {
    groupName: state.groupName,
    patchDate: state.patchDate,
    language: state.language,
    useReleaseTitle: state.useReleaseTitle,
    sanitize: state.sanitizeEnabled,
  });
});

// ── Status ────────────────────────────────────────────────────────────

function setStatus(text: string, kind: StatusKind = "info") {
  state.statusText = text;
  state.statusKind = kind;
}

function resetStatusAfter(ms: number) {
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    if (state.vnInfo && state.allReleases.length) {
      setStatus(`✓ 找到 ${state.allReleases.length} 个发行版本`, "success");
    } else {
      state.statusText = "";
      state.statusKind = "info";
    }
  }, ms);
}

// ── Theme & Config ────────────────────────────────────────────────────

export async function initConfig() {
  try {
    const cfg = await invoke<AppConfig>("get_config");
    if (cfg.appearance_mode) state.themeMode = cfg.appearance_mode as ThemeMode;
    if (cfg.color_palette && PALETTE_IDS.has(cfg.color_palette)) {
      state.palette = cfg.color_palette;
    }
    if (cfg.format_templates?.length) {
      state.formatTemplates = cfg.format_templates;
    } else if (cfg.format_template) {
      state.formatTemplates = [{ name: DEFAULT_TEMPLATE_NAME, template: cfg.format_template }];
    } else {
      state.formatTemplates = [{ name: DEFAULT_TEMPLATE_NAME, template: DEFAULT_FORMAT_TEMPLATE }];
    }
    state.activeFormatName = state.formatTemplates.some(
      (t) => t.name === cfg.format_template_name,
    )
      ? (cfg.format_template_name as string)
      : state.formatTemplates[0].name;
  } catch {
    // keep defaults
  }
  if (!state.formatTemplates.length) {
    state.formatTemplates = [{ name: DEFAULT_TEMPLATE_NAME, template: DEFAULT_FORMAT_TEMPLATE }];
  }
  if (!state.activeFormatName) state.activeFormatName = state.formatTemplates[0].name;
}

export function persistConfig() {
  invoke("save_config", {
    cfg: {
      appearance_mode: state.themeMode,
      format_template: savedFormat.value,
      format_templates: state.formatTemplates,
      format_template_name: state.activeFormatName,
      color_palette: state.palette,
    },
  }).catch(() => {});
}

export function toggleTheme() {
  state.themeMode = isDark.value ? "Light" : "Dark";
  persistConfig();
}

export function selectPalette(id: string) {
  if (!PALETTE_IDS.has(id)) return;
  state.palette = id;
  persistConfig();
}

// ── Search ────────────────────────────────────────────────────────────

function applyVn(vn: VNInfo) {
  state.vnInfo = vn;
  state.allReleases = vn.releases;
  state.nonZh = state.allReleases.filter((r) => !isChineseRelease(r));
  state.zh = state.allReleases.filter((r) => isChineseRelease(r));

  state.nonZh.sort((a, b) => {
    const ka = nonZhSortKey(a);
    const kb = nonZhSortKey(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });
  state.zh.sort((a, b) => {
    const ka = zhSortKey(a);
    const kb = zhSortKey(b);
    for (let i = 0; i < ka.length; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i];
    }
    return 0;
  });

  state.selectedNonzhIdx = 0;
  state.selectedZhIdx = 0;
  state.focusSide = state.zh.length ? "zh" : "nonzh";

  if (state.zh.length) {
    const r = state.zh[0];
    const grp = nonDeveloperGroupName(r);
    if (grp) state.groupName = grp;
    const patch = formatReleased(r);
    if (patch && patch !== PLACEHOLDER) state.patchDate = patch;
    state.language = languageLabel(r);
  } else if (state.nonZh.length) {
    const r = state.nonZh[0];
    if (r.languages.length) state.language = r.languages[0].toUpperCase();
  }

  state.vnUrl = `https://vndb.org/${vn.id}`;
  state.searching = false;
  setStatus(
    `✓ 找到 ${state.allReleases.length} 个发行版本（非中文 ${state.nonZh.length}，中文 ${state.zh.length}）`,
    "success",
  );
}

function onSearchError(msg: string) {
  state.searching = false;
  setStatus(`✗ ${msg}`, "error");
  state.vnInfo = null;
  state.allReleases = [];
  state.nonZh = [];
  state.zh = [];
  state.vnUrl = null;
}

export async function search() {
  const query = state.query.trim();
  if (!query) {
    setStatus("请输入 VNDB ID 或游戏名称", "error");
    return;
  }
  if (state.searching) return;

  state.searching = true;
  setStatus("正在查询 VNDB API…", "info");
  try {
    const res = await invoke<SearchOutcome>("search_vn", { query });
    if (res.kind === "multiple" && res.candidates) {
      candidateState.candidates = res.candidates;
      candidateState.open = true;
    } else if (res.vn) {
      applyVn(res.vn);
    }
  } catch (e) {
    onSearchError(String(e));
  }
}

export async function chooseCandidate(cand: VNCandidate) {
  candidateState.open = false;
  setStatus(`正在获取 ${cand.id}…`, "info");
  try {
    const vn = await invoke<VNInfo>("fetch_vn_by_id", { id: cand.id });
    applyVn(vn);
  } catch (e) {
    onSearchError(String(e));
  }
}

export function cancelCandidates() {
  candidateState.open = false;
  state.searching = false;
  setStatus("已取消选择", "info");
}

// ── Selection ─────────────────────────────────────────────────────────

export function selectNonZh(idx: number) {
  state.focusSide = "nonzh";
  state.selectedNonzhIdx = idx;
  const r = state.nonZh[idx];
  if (r.languages.length) {
    state.language = r.languages[0].toUpperCase();
  }
}

export function selectZh(idx: number) {
  state.focusSide = "zh";
  state.selectedZhIdx = idx;
  const r = state.zh[idx];
  const grp = nonDeveloperGroupName(r);
  if (grp) state.groupName = grp;
  const patch = formatReleased(r);
  if (patch && patch !== PLACEHOLDER) state.patchDate = patch;
  state.language = languageLabel(r);
}

// ── Copy / Links ──────────────────────────────────────────────────────

export async function copyFilename() {
  const content = previewFilename.value;
  if (!content) return;
  await writeText(content);
  setStatus("✓ 已复制到剪贴板", "success");
  resetStatusAfter(3000);
}

export async function copySimplifiedTitle() {
  if (!state.vnInfo || !baseRelease.value) return;
  const base = baseRelease.value;
  const title = state.useReleaseTitle
    ? base.alttitle || base.title
    : originalTitle(state.vnInfo);
  const group = state.groupName.trim();
  const simplified = group ? `【${group}】${title}` : title;
  await writeText(sanitizeFilename(simplified, state.sanitizeEnabled));
  setStatus("✓ 已复制简要标题", "success");
  resetStatusAfter(3000);
}

export function onLinkClick() {
  if (!state.vnUrl) return;
  if (linkState.waiting) {
    if (linkTimer) clearTimeout(linkTimer);
    linkState.waiting = false;
    linkState.text = "复制页面链接";
    invoke("open_url", { url: state.vnUrl }).catch(() => {});
  } else {
    writeText(state.vnUrl).catch(() => {});
    setStatus("✓ 已复制VNDB链接", "success");
    resetStatusAfter(3000);
    linkState.waiting = true;
    linkState.text = "再次点击打开链接";
    linkTimer = setTimeout(() => {
      linkState.waiting = false;
      linkState.text = "复制页面链接";
    }, 3000);
  }
}

export function openProjectLink() {
  invoke("open_url", { url: PROJECT_URL }).catch(() => {});
}

// ── Custom Format ─────────────────────────────────────────────────────

export function onFormatSaved(templates: FormatTemplate[], activeName: string) {
  state.formatTemplates = templates;
  state.activeFormatName = activeName;
  persistConfig();
}
