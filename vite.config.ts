import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/* CI 打 tag 时注入 APP_VERSION 环境变量（如 v1.0.3），本地构建回退 package.json 的版本号 */
function resolveAppVersion(): string {
  const raw = (process.env.APP_VERSION ?? "").trim().replace(/^v/i, "");
  return /^\d+\.\d+\.\d+/.test(raw) ? raw : pkg.version;
}

export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2021",
  },
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
});
