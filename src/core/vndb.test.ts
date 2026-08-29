import { describe, expect, it } from "vitest";
import { PLACEHOLDER } from "./models";
import {
  developerName,
  formatReleased,
  hasNonChineseLanguage,
  isChineseRelease,
  languageLabel,
  languageTags,
  languageTagString,
  languagesDisplay,
  mergeLanguageTag,
  nonDeveloperGroupName,
  nonZhSortKey,
  originalTitle,
  parseDateToInt,
  platformsDisplay,
  producerDisplayName,
  publisherName,
  releaseDisplayTitle,
  zhLanguageTagString,
  zhSortKey,
} from "./vndb";
import type { VNInfo, VNRelease } from "./models";

const release: VNRelease = {
  id: "r123",
  title: "Title",
  alttitle: "Alt Title",
  released: "2024-05-01",
  platforms: ["win", "mac"],
  languages: ["en", "ja"],
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

describe("producerDisplayName", () => {
  it("优先使用 original 名称", () => {
    expect(producerDisplayName({ id: "p1", name: "N", original: "O", developer: true, publisher: false })).toBe("O");
    expect(producerDisplayName({ id: "p1", name: "N", original: "", developer: true, publisher: false })).toBe("N");
  });
});

describe("originalTitle", () => {
  it("优先返回日文标题", () => {
    expect(originalTitle(vn)).toBe("Japanese Title");
  });

  it("无日文标题时回退到 alttitle / title", () => {
    const noJa: VNInfo = { ...vn, titles: [{ lang: "en", title: "English Title" }], alttitle: "Fallback" };
    expect(originalTitle(noJa)).toBe("Fallback");
    expect(originalTitle({ ...noJa, alttitle: null })).toBe("English Title");
  });
});

describe("releaseDisplayTitle", () => {
  it("优先使用 alttitle", () => {
    expect(releaseDisplayTitle(release)).toBe("Alt Title");
    expect(releaseDisplayTitle({ ...release, alttitle: null })).toBe("Title");
  });
});

describe("formatReleased", () => {
  it("补全缺失部分为 00", () => {
    expect(formatReleased(release)).toBe("20240501");
    expect(formatReleased({ ...release, released: "2024" })).toBe("20240000");
  });

  it("空日期返回 NO DATA", () => {
    expect(formatReleased({ ...release, released: "" })).toBe(PLACEHOLDER);
  });
});

describe("parseDateToInt", () => {
  it("解析日期为整数", () => {
    expect(parseDateToInt("2024-05-01")).toBe(20240501);
    expect(parseDateToInt("2024")).toBe(20249999);
  });

  it("非法日期返回 0", () => {
    expect(parseDateToInt("bad")).toBe(0);
    expect(parseDateToInt(null)).toBe(0);
    expect(parseDateToInt(undefined)).toBe(0);
  });
});

describe("platformsDisplay", () => {
  it("映射平台代号为全名", () => {
    expect(platformsDisplay(release)).toBe("Windows, MacOS");
  });

  it("未知代号原样输出", () => {
    expect(platformsDisplay({ ...release, platforms: ["win", "ngp"] })).toBe("Windows, ngp");
  });

  it("无平台返回 NO DATA", () => {
    expect(platformsDisplay({ ...release, platforms: [] })).toBe(PLACEHOLDER);
  });
});

describe("languagesDisplay", () => {
  it("日文排在首位，其余按字母序", () => {
    expect(languagesDisplay({ ...release, languages: ["en", "zh-Hans", "ja", "ko"] })).toBe(
      "ja, en, ko, zh-Hans",
    );
  });

  it("无语言返回 NO DATA", () => {
    expect(languagesDisplay({ ...release, languages: [] })).toBe(PLACEHOLDER);
  });
});

describe("developer / publisher / group", () => {
  it("developerName 返回开发方", () => {
    expect(developerName(release)).toBe("Dev Studio");
  });

  it("publisherName 返回发行方", () => {
    expect(publisherName(release)).toBe("Pub House");
  });

  it("nonDeveloperGroupName 返回非开发方（汉化组）", () => {
    expect(nonDeveloperGroupName(release)).toBe("Pub House");
    expect(nonDeveloperGroupName({ ...release, producers: [release.producers[0]] })).toBe(PLACEHOLDER);
  });
});

describe("isChineseRelease", () => {
  it.each([
    ["zh-Hans", true],
    ["zh-Hant", true],
    ["zh", true],
    ["ja", false],
    ["en", false],
  ])("语言 %s → %s", (lang, expected) => {
    expect(isChineseRelease({ ...release, languages: [lang] })).toBe(expected);
  });

  it("含中文即视为中文发行", () => {
    expect(isChineseRelease({ ...release, languages: ["en", "zh-Hans"] })).toBe(true);
  });
});

describe("hasNonChineseLanguage", () => {
  it.each([
    ["ja", true],
    ["en", true],
    ["zh-Hans", false],
    ["zh-Hant", false],
    ["zh", false],
  ])("语言 %s → %s", (lang, expected) => {
    expect(hasNonChineseLanguage({ ...release, languages: [lang] })).toBe(expected);
  });

  it("含非中文即视为非中文发行", () => {
    expect(hasNonChineseLanguage({ ...release, languages: ["zh-Hans", "en"] })).toBe(true);
  });
});

describe("排序键", () => {
  it("nonZhSortKey 日文优先于英文", () => {
    const ja = nonZhSortKey({ ...release, languages: ["ja"], released: "2020-01-01" });
    const en = nonZhSortKey({ ...release, languages: ["en"], released: "2020-01-01" });
    expect(ja[0]).toBeLessThan(en[0]);
  });

  it("无日期排在有日期之后", () => {
    const dated = nonZhSortKey({ ...release, languages: ["ja"], released: "2020-01-01" });
    const undated = nonZhSortKey({ ...release, languages: ["ja"], released: "" });
    expect(dated[1]).toBe(0);
    expect(undated[1]).toBe(1);
  });

  it("zhSortKey 按日期倒序（新日期排序值更小）", () => {
    const newer = zhSortKey({ ...release, released: "2024-01-01" });
    const older = zhSortKey({ ...release, released: "2020-01-01" });
    expect(newer[1]).toBeLessThan(older[1]);
  });
});

describe("languageLabel", () => {
  it("中文映射为 CHS / CHT", () => {
    expect(languageLabel({ ...release, languages: ["zh-Hans"] })).toBe("CHS");
    expect(languageLabel({ ...release, languages: ["zh-Hant"] })).toBe("CHT");
    expect(languageLabel({ ...release, languages: ["zh"] })).toBe("CHS");
  });

  it("双中文语言取 CHS 在前", () => {
    expect(languageLabel({ ...release, languages: ["zh-Hans", "zh-Hant"] })).toBe("CHS");
  });

  it("其他语言取第一个并大写", () => {
    expect(languageLabel({ ...release, languages: ["ja"] })).toBe("JA");
  });

  it("无语言默认 CHS", () => {
    expect(languageLabel({ ...release, languages: [] })).toBe("CHS");
  });
});

describe("languageTags / languageTagString", () => {
  it("中文语言映射为 CHS / CHT", () => {
    expect(languageTagString({ ...release, languages: ["zh-Hans", "zh-Hant"] })).toBe("CHS&CHT");
  });

  it("非中文语言大写并用 & 连接", () => {
    expect(languageTagString({ ...release, languages: ["ja", "en"] })).toBe("JA&EN");
  });

  it("excludeChinese 排除中文语言", () => {
    expect(languageTagString({ ...release, languages: ["zh-Hans", "zh-Hant", "ja", "en"] }, true)).toBe("JA&EN");
    expect(languageTags({ ...release, languages: ["zh-Hans", "en"] }, true)).toEqual(["EN"]);
  });

  it("全部语言被排除或无语言时返回 NO DATA", () => {
    expect(languageTagString({ ...release, languages: ["zh-Hans"] }, true)).toBe(PLACEHOLDER);
    expect(languageTagString({ ...release, languages: [] })).toBe(PLACEHOLDER);
  });

  it("去重重复语言", () => {
    expect(languageTagString({ ...release, languages: ["ja", "ja", "en"] })).toBe("JA&EN");
  });
});

describe("zhLanguageTagString", () => {
  it("只取中文语言标签", () => {
    expect(zhLanguageTagString({ ...release, languages: ["zh-Hans", "zh-Hant", "en", "ja"] })).toBe(
      "CHS&CHT",
    );
  });

  it("无中文时返回 NO DATA", () => {
    expect(zhLanguageTagString({ ...release, languages: ["en", "ja"] })).toBe(PLACEHOLDER);
  });
});

describe("mergeLanguageTag", () => {
  const nonZh = { ...release, languages: ["en", "zh-Hans", "zh-Hant"] };
  const zh = { ...release, languages: ["en", "zh-Hans", "zh-Hant"] };

  it("同条目左右语言标签合并去重", () => {
    expect(mergeLanguageTag(nonZh, zh)).toBe("EN&CHS&CHT");
  });

  it("左侧为英文、右侧为双中文", () => {
    expect(mergeLanguageTag({ ...release, languages: ["en"] }, { ...release, languages: ["zh-Hans", "zh-Hant"] })).toBe(
      "EN&CHS&CHT",
    );
  });

  it("合并结果与顺序无关（去重）", () => {
    expect(
      mergeLanguageTag(
        { ...release, languages: ["en", "ja"] },
        { ...release, languages: ["zh-Hans", "zh-Hant", "en"] },
      ),
    ).toBe("EN&JA&CHS&CHT");
  });

  it("无语言时返回 NO DATA", () => {
    expect(mergeLanguageTag({ ...release, languages: [] }, { ...release, languages: [] })).toBe(
      PLACEHOLDER,
    );
  });
});
