import type { Producer, VNInfo, VNRelease } from "./models";
import { PLACEHOLDER } from "./models";

export const PLATFORM_MAP: Record<string, string> = {
  win: "Windows",
  lin: "Linux",
  mac: "MacOS",
  and: "Android",
  ios: "iOS",
  dvd: "DVD",
  bdp: "Blu-ray Player",
  dos: "DOS",
  win3x: "Windows 3.x",
  win9x: "Windows 9x",
  winnt: "Windows NT",
  web: "Web",
  oth: "Other",
  swi: "Switch",
  xb3: "Xbox 360",
  mob: "Mobile",
  ps2: "PlayStation 2",
  ps3: "PlayStation 3",
  ps4: "PlayStation 4",
  psv: "PlayStation Vita",
  psp: "PlayStation Portable",
};

export function producerDisplayName(p: Producer): string {
  return p.original || p.name;
}

export function originalTitle(vn: VNInfo): string {
  for (const t of vn.titles) {
    if (t.lang === "ja" && t.title) return t.title;
  }
  return vn.alttitle || vn.title;
}

export function releaseDisplayTitle(r: VNRelease): string {
  return r.alttitle || r.title;
}

export function formatReleased(r: VNRelease): string {
  const raw = (r.released || "").trim();
  if (!raw) return PLACEHOLDER;
  const parts = raw.split("-").filter((p) => p.length > 0);
  while (parts.length < 3) parts.push("00");
  return parts.join("");
}

export function parseDateToInt(released: string | null | undefined): number {
  if (!released) return 0;
  const parts = released.split("-").filter((p) => p.length > 0);
  try {
    while (parts.length < 3) parts.push("99");
    return parts.slice(0, 3).reduce((sum, p, i) => {
      const v = parseInt(p, 10);
      if (isNaN(v)) throw new Error("bad date");
      return sum + v * (10000 / Math.pow(100, i));
    }, 0);
  } catch {
    return 0;
  }
}

export function platformsDisplay(r: VNRelease): string {
  if (!r.platforms.length) return PLACEHOLDER;
  return r.platforms.map((p) => PLATFORM_MAP[p] ?? p).join(", ");
}

export function languagesDisplay(r: VNRelease): string {
  if (!r.languages.length) return PLACEHOLDER;
  const sorted = [...r.languages].sort((a, b) => {
    const ak = a === "ja" ? 0 : 1;
    const bk = b === "ja" ? 0 : 1;
    if (ak !== bk) return ak - bk;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return sorted.join(", ");
}

export function developerName(r: VNRelease): string {
  for (const p of r.producers) {
    if (p.developer) {
      return producerDisplayName(p) || PLACEHOLDER;
    }
  }
  return PLACEHOLDER;
}

export function publisherName(r: VNRelease): string {
  for (const p of r.producers) {
    if (p.publisher) {
      return producerDisplayName(p) || PLACEHOLDER;
    }
  }
  return PLACEHOLDER;
}

export function nonDeveloperGroupName(r: VNRelease): string {
  const dev = developerName(r);
  for (const p of r.producers) {
    const pn = producerDisplayName(p);
    if (pn !== dev && pn !== PLACEHOLDER) return pn;
  }
  return PLACEHOLDER;
}

export function isChineseRelease(r: VNRelease): boolean {
  return r.languages.some((l) => l === "zh-Hans" || l === "zh-Hant" || l === "zh");
}

export function hasNonChineseLanguage(r: VNRelease): boolean {
  return r.languages.some((l) => l !== "zh-Hans" && l !== "zh-Hant" && l !== "zh");
}

export function nonZhSortKey(r: VNRelease): [number, number, number] {
  const hasJa = r.languages.includes("ja");
  const hasEn = r.languages.includes("en");
  const prio = hasJa ? 0 : hasEn ? 1 : 2;
  const date = parseDateToInt(r.released);
  return [prio, date === 0 ? 1 : 0, date];
}

export function zhSortKey(r: VNRelease): [number, number] {
  const date = parseDateToInt(r.released);
  return [date === 0 ? 1 : 0, -date];
}

const ZH_LABEL: Record<string, string> = {
  "zh-Hans": "CHS",
  zh: "CHS",
  "zh-Hant": "CHT",
};

function zhTagOf(lang: string): string | null {
  return ZH_LABEL[lang] ?? null;
}

export function languageTags(r: VNRelease, excludeChinese = false): string[] {
  const tags: string[] = [];
  for (const l of r.languages) {
    if (excludeChinese && zhTagOf(l)) continue;
    const tag = zhTagOf(l) ?? l.toUpperCase();
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export function languageTagString(r: VNRelease, excludeChinese = false): string {
  const tags = languageTags(r, excludeChinese);
  return tags.length ? tags.join("&") : PLACEHOLDER;
}

export function zhLanguageTagString(r: VNRelease): string {
  const tags: string[] = [];
  for (const l of r.languages) {
    const tag = zhTagOf(l);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  return tags.length ? tags.join("&") : PLACEHOLDER;
}

export function mergeLanguageTag(nonZh: VNRelease, zh: VNRelease): string {
  const tags: string[] = [];
  for (const t of [
    ...languageTags(nonZh, true),
    ...zhLanguageTagString(zh).split("&").filter((t) => t && t !== PLACEHOLDER),
  ]) {
    if (!tags.includes(t)) tags.push(t);
  }
  return tags.length ? tags.join("&") : PLACEHOLDER;
}

export function languageLabel(r: VNRelease): string {
  return languageTags(r)[0] ?? "CHS";
}
