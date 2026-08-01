import type { VNInfo, VNRelease } from "./models";
import { PLACEHOLDER } from "./models";
import {
  developerName,
  formatReleased,
  languagesDisplay,
  originalTitle,
  platformsDisplay,
  releaseDisplayTitle,
} from "./vndb";

export const ILLEGAL_CHAR_MAP: Record<string, string> = {
  ":": "：",
  "?": "？",
  "/": "／",
  "\\": "＼",
  "*": "＊",
  '"': "”",
  "<": "《",
  ">": "》",
  "|": "｜",
};

const ILLEGAL_PATTERN = /[:?/\\*"<>|]/g;

export function sanitizeFilename(text: string | null | undefined, enabled = true): string {
  if (!text || !enabled) return text ?? "";
  return text.replace(ILLEGAL_PATTERN, (ch) => ILLEGAL_CHAR_MAP[ch] ?? ch);
}

export interface GenerateOptions {
  groupName?: string;
  patchDate?: string;
  language?: string;
  useReleaseTitle?: boolean;
  sanitize?: boolean;
}

export function generateFilename(
  vnInfo: VNInfo,
  release: VNRelease,
  opts: GenerateOptions = {},
): string {
  const {
    groupName = "",
    patchDate = "",
    language = "CHS",
    useReleaseTitle = false,
    sanitize = true,
  } = opts;

  const developer = developerName(release) || PLACEHOLDER;
  const dateStr = formatReleased(release);
  const title = useReleaseTitle ? releaseDisplayTitle(release) : originalTitle(vnInfo);

  const platDisplay = platformsDisplay(release);
  const platformStr =
    platDisplay && platDisplay !== PLACEHOLDER ? platDisplay.replace(/, /g, "_") : PLACEHOLDER;

  const groupClean = (groupName ?? "").trim();
  const patchClean = (patchDate ?? "").trim();
  const languageClean = (language ?? "").trim().toUpperCase() || "CHS";

  const vid = (vnInfo.id ?? "").replace(/^v+/i, "");
  const parts: string[] = [
    `[${sanitizeFilename(developer, sanitize)}]`,
    `[${sanitizeFilename(dateStr, sanitize)}]`,
    sanitizeFilename(title, sanitize),
    `[v${vid}]`,
    `[${sanitizeFilename(platformStr, sanitize)}]`,
    `[${sanitizeFilename(groupClean || PLACEHOLDER, sanitize)}]`,
  ];
  if (patchClean) {
    parts.push(`[${sanitizeFilename(patchClean, sanitize)}]`);
  }
  parts.push(`[${sanitizeFilename(languageClean, sanitize)}]`);
  return parts.join("");
}

export function getReleasePreview(release: VNRelease): string {
  const platforms = release.platforms.length ? release.platforms.join(", ") : PLACEHOLDER;
  const languages = release.languages.length ? release.languages.join(", ") : PLACEHOLDER;
  const displayTitle = releaseDisplayTitle(release);
  return `${displayTitle} | ${release.released || PLACEHOLDER} | ${platforms} | ${languages}`;
}

export interface CustomGenerateOptions {
  groupName?: string;
  patchDate?: string;
  language?: string;
  useReleaseTitle?: boolean;
  sanitizeEnabled?: boolean;
  activeRelease: VNRelease | null;
}

export function generateCustomFilename(
  template: string,
  vnInfo: VNInfo,
  release: VNRelease,
  opts: CustomGenerateOptions,
): string {
  const {
    groupName = "",
    patchDate = "",
    language = "CHS",
    useReleaseTitle = false,
    sanitizeEnabled = true,
    activeRelease = null,
  } = opts;

  let dateVal: string;
  if (!template.includes("{patch_date}")) {
    dateVal = formatReleased(activeRelease ?? release);
  } else {
    dateVal = formatReleased(release);
  }

  const parts: Record<string, string> = {
    developer: developerName(release) || PLACEHOLDER,
    date: dateVal,
    title: useReleaseTitle ? releaseDisplayTitle(release) : originalTitle(vnInfo),
    vid: vnInfo.id ? `v${vnInfo.id.replace(/^v+/i, "")}` : PLACEHOLDER,
    platform:
      platformsDisplay(release) !== PLACEHOLDER
        ? platformsDisplay(release).replace(/, /g, "_")
        : PLACEHOLDER,
    group: (groupName ?? "").trim() || PLACEHOLDER,
    patch_date: patchDate ?? "",
    language: (language ?? "").toUpperCase(),
  };

  let result = template;
  for (const [key, value] of Object.entries(parts)) {
    result = result.replaceAll(`{${key}}`, sanitizeFilename(value, sanitizeEnabled));
  }
  return result;
}
