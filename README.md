# VNDB-GUI (Rust + Tauri 重写版)

> VNDB 视觉小说文件名生成器 — 基于 [VNDB API v2 (kana)](https://api.vndb.org/kana) 的桌面工具，自动生成标准化的文件名。
> 本仓库为原 [VNDB-GUI](https://github.com/100pangci/VNDB-GUI)（Python + customtkinter）的 **Rust + Tauri v2 + Vue 3** 重写版，功能完全复刻。

![License](https://img.shields.io/badge/License-MPL--2.0-orange)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey)

---

## ✨ 功能特点

- **🔍 智能搜索** — 输入 VNDB ID（如 `v2622`）或游戏原名，自动获取视觉小说信息及所有发行版本
- **📋 多结果选择** — 标题搜索返回多个匹配时，弹出候选列表供用户精确选择
- **🔄 双列布局** — 左侧「非中文发行」显示非中文版本，右侧「中文发行」显示中文版本，一目了然
- **🧠 智能排序** — 非中文发行优先按日语语言排序，再按日期降序排列；中文发行按日期降序排列
- **🏷️ 文件名生成** — 自动生成标准格式文件名：

  ```
  [开发商][发售日期]原版标题[vID][平台][汉化组][汉化补丁日期][语言标签]
  ```

- **📋 一键复制** — 点击「一键复制」按钮将文件名复制到剪贴板
- **📋 简要标题** — 点击「复制简要标题」以 `【汉化组】游戏原名` 格式复制简化版标题
- **🔗 页面链接** — 「复制页面链接」按钮：单击复制 VNDB 页面地址，再次点击直接打开浏览器访问
- **🛡️ 非法字符替换** — Windows 非法字符自动替换为全角等效字符（`:?/\*"<>|`），可通过开关自由关闭

### 高级功能

- **🎭 标题模式切换** — 可选择使用「游戏原名」或「发行版标题」作为文件名中的标题
- **✏️ 汉化组手动编辑** — 汉化组名称支持自由编辑修改，预览实时更新
- **🧩 自定义拼接格式** — 通过底栏按钮打开格式编辑器，使用 `{developer}` `{date}` `{title}` `{vid}` `{platform}` `{group}` `{patch_date}` `{language}` 等变量自由组合文件名格式，点击变量标签即可插入
- **🌓 主题切换** — 默认跟随系统自动切换深色/浅色模式，也可通过顶栏开关手动覆盖
- **💾 配置持久化** — 主题偏好和自定义格式模板自动保存到 `~/.vndb-gui/config.json`，重启后恢复
- **⛔ 错误处理** — 网络超时、连接失败、未找到、请求频率限制等均有友好提示

## 📁 文件名格式

```
[developer][YYYYMMDD]original_title[vVNDB_ID][platform][group][patch_date][language]
```

示例：

```
[ゆずソフト][20160729]千恋＊万花[v19073][Windows][落樱汉化组][20171111][CHS]
```

当缺失信息时，对应字段显示 `[NO DATA]`。

## 🚀 开发与运行

### 环境要求

- [Rust](https://www.rust-lang.org/)（stable，含 MSVC 工具链）
- [Node.js](https://nodejs.org/) 18+
- Windows 需 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)（Win11 自带）

### 运行（开发模式）

```bash
npm install
npm run tauri dev
```

### 打包（便携版 zip）

```bash
npm run portable
```

脚本会构建 release 版（不生成安装包）并压缩为 `release/VNDB-GUI-1.0.1-win64.zip`，解压即用。

## 📂 项目结构

```
VNDB-GUI-Rs/
├── src/                             # Vue 3 前端
│   ├── App.vue                      # 主界面布局
│   ├── styles.css                   # 深色/浅色主题样式
│   ├── components/                  # 发行行、候选对话框、格式编辑对话框
│   └── core/
│       ├── models.ts                # 数据模型（VNInfo/VNRelease/VNCandidate）
│       ├── vndb.ts                  # 显示逻辑、排序、语言/平台解析
│       ├── filename.ts              # 文件名生成与非法字符过滤
│       └── store.ts                 # 全局状态与搜索流程
├── src-tauri/                       # Tauri v2 后端 (Rust)
│   ├── src/
│   │   ├── lib.rs                   # Tauri 命令注册
│   │   ├── vndb.rs                  # VNDB API v2 客户端（reqwest）
│   │   └── config.rs                # 配置读写 (~/.vndb-gui/config.json)
│   ├── capabilities/                # 权限配置
│   └── tauri.conf.json
├── LICENSE                          # MPL-2.0
└── version.txt                      # 版本号
```

## 🏗️ 技术架构

| 层 | 技术 | 职责 |
|----|------|------|
| 桌面壳 | Tauri v2 | 窗口、WebView、系统集成 |
| 后端 | Rust (reqwest) | VNDB API 请求、超时/错误映射、配置持久化、打开外链 |
| 前端 | Vue 3 + Vite + TS | 界面渲染、状态管理、文件名生成逻辑 |

### 错误处理

| 错误类型 | 触发条件 | 处理方式 |
|----------|----------|----------|
| VNDBNotFoundError | VN 未找到 | 界面显示未找到提示 |
| VNDBMultipleResultsError | 标题搜索返回多个结果 | 弹出候选对话框让用户选择 |
| VNDBError | 网络超时/连接失败/频率限制 | 界面显示具体错误描述 |

### 平台映射

VNDB API 返回的平台代码（如 `win`）自动映射为完整名称：`win → Windows` · `lin → Linux` · `mac → MacOS` · `swi → Switch` · `ps4 → PlayStation 4` 等（共 20+ 平台）。

### 语言解析

- `zh-Hans` → `CHS`（简体中文）
- `zh-Hant` → `CHT`（繁体中文）
- `zh` → `CHS`（默认简体）
- 其他语言保留原始代码

## 🔗 数据来源

所有数据来自 [VNDB](https://vndb.org/) 的 [API v2 (kana)](https://api.vndb.org/kana)。

## 📜 许可证

本项目使用 [Mozilla Public License Version 2.0](https://mozilla.org/MPL/2.0/) (MPL-2.0) 开源协议。
