mod app_version;
mod config;
mod vndb;

use config::AppConfig;
use tauri::{Manager, State};
use vndb::{SearchOutcome, VNInfoDto, VndbClient};

pub struct AppState {
    client: VndbClient,
}

#[tauri::command]
async fn search_vn(query: String, state: State<'_, AppState>) -> Result<SearchOutcome, String> {
    let client = state.client.clone();
    tauri::async_runtime::spawn_blocking(move || client.search_vn(&query))
        .await
        .map_err(|e| format!("后台任务失败：{e}"))?
}

#[tauri::command]
async fn fetch_vn_by_id(id: String, state: State<'_, AppState>) -> Result<VNInfoDto, String> {
    let client = state.client.clone();
    tauri::async_runtime::spawn_blocking(move || client.fetch_vn_by_id(&id))
        .await
        .map_err(|e| format!("后台任务失败：{e}"))?
}

#[tauri::command]
fn get_config() -> Result<AppConfig, String> {
    config::load()
}

#[tauri::command]
fn save_config(cfg: AppConfig) -> Result<(), String> {
    config::save(&cfg)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("无法打开链接：{e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState {
            client: VndbClient::new(),
        })
        .setup(|app| {
            let version = app_version::get_app_version();
            let version = version.trim_start_matches('v');
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_title(&format!("VNDB 文件名生成器 v{version}"));
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_vn,
            fetch_vn_by_id,
            get_config,
            save_config,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
