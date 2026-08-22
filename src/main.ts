import { createApp } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App.vue";
import { APP_TITLE } from "./core/version";
import "./styles.css";

/* 原版右键菜单的屏蔽与自定义菜单见 components/ContextMenu.vue */

document.title = APP_TITLE;
if ("__TAURI_INTERNALS__" in window) {
  getCurrentWindow().setTitle(APP_TITLE);
}

createApp(App).mount("#app");
