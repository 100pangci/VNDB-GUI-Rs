import { describe, expect, it } from "vitest";
import { PLACEHOLDER } from "./models";
import type { VNInfo, VNRelease } from "./models";
import {
  generateCustomFilename,
  generateFilename,
  getReleasePreview,
  sanitizeFilename,
} from "./filename";

const release: VNRelease = {
  id: "r123",
  title: "Title",
  alttitle: "Alt Title",
  released: "2024-05-01",
  platforms: ["win", "mac"],
  languages: ["ja", "en"],
  producers: [
    { id: "p1", name: "Dev Studio", original: "", developer: true, publisher: false },
    { id: "p2", name: "Pub House", original: "", developer: false, publisher: true },
  ],
  media: [],
};

const vn: VNInfo = {
  id: "v2622",
  title: "English Title",
  alttitle: null,
  titles: [
    { lang: "en", title: "English Title" },
    { lang: "ja", title: "Japanese Title" },
  ],
  image: null,
  releases: [release],
};

describe("sanitizeFilename", () => {
  it("替换 Windows 非法字符为全角", () => {
    expect(sanitizeFilename(`a:b?c*d"e<f>g|h\\i`)).toBe("a：b？c＊d”e《f》g｜h＼i");
  });

  it("disabled 时原样返回", () => {
    expect(sanitizeFilename("a:b", false)).toBe("a:b");
  });

  it("空值返回空串", () => {
    expect(sanitizeFilename(null)).toBe("");
    expect(sanitizeFilename(undefined)).toBe("");
    expect(sanitizeFilename("")).toBe("");
  });
});

describe("generateFilename", () => {
  it("生成标准文件名", () => {
    expect(generateFilename(vn, release)).toBe(
      "[Dev Studio][20240501]Japanese Title[v2622][Windows_MacOS][NO DATA][CHS]",
    );
  });

  it("使用发行版标题、汉化组与补丁日期", () => {
    const name = generateFilename(vn, release, {
      useReleaseTitle: true,
      groupName: "  Group  ",
      patchDate: "2024-06-01",
      language: "chs",
    });
    expect(name).toBe(
      "[Dev Studio][20240501]Alt Title[v2622][Windows_MacOS][Group][2024-06-01][CHS]",
    );
  });

  it("关闭替换后保留非法字符", () => {
    const dirty: VNRelease = { ...release, alttitle: "A:B" };
    expect(generateFilename(vn, dirty, { useReleaseTitle: true, sanitize: false })).toContain(
      "A:B",
    );
    expect(generateFilename(vn, dirty, { useReleaseTitle: true })).toContain("A：B");
  });
});

describe("generateCustomFilename", () => {
  const template =
    "[{developer}][{date}]{title}[{vid}][{platform}][{group}][{patch_date}][{language}]";

  it("按模板替换所有变量", () => {
    const name = generateCustomFilename(template, vn, release, {
      groupName: "Group",
      patchDate: "2024-06-01",
      language: "chs",
      activeRelease: release,
    });
    expect(name).toBe(
      "[Dev Studio][20240501]Japanese Title[v2622][Windows_MacOS][Group][2024-06-01][CHS]",
    );
  });

  it("模板不含 {patch_date} 时日期取 activeRelease", () => {
    const active: VNRelease = { ...release, id: "r999", released: "2023-03-03" };
    const name = generateCustomFilename("[{date}]", vn, release, { activeRelease: active });
    expect(name).toBe("[20230303]");
  });

  it("模板含 {patch_date} 时日期取基础发行", () => {
    const active: VNRelease = { ...release, id: "r999", released: "2023-03-03" };
    const name = generateCustomFilename("[{date}][{patch_date}]", vn, release, {
      patchDate: "2024-06-01",
      activeRelease: active,
    });
    expect(name).toBe("[20240501][2024-06-01]");
  });

  it("vid 变量保留 v 前缀", () => {
    const name = generateCustomFilename("{vid}", vn, release, { activeRelease: release });
    expect(name).toBe("v2622");
  });
});

describe("getReleasePreview", () => {
  it("拼接发行信息", () => {
    expect(getReleasePreview(release)).toBe("Alt Title | 2024-05-01 | win, mac | ja, en");
  });
});
