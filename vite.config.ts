import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/* CI 打 tag 时注入 APP_VERSION 环境变量（如 v1.0.3），本地构建显示 dev */
function resolveAppVersion(): string {
  const raw = (process.env.APP_VERSION ?? "").trim().replace(/^v/i, "");
  return /^\d+\.\d+\.\d+/.test(raw) ? raw : "dev";
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
