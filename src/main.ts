import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

window.addEventListener("contextmenu", (e) => e.preventDefault());

createApp(App).mount("#app");
