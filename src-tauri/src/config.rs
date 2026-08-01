//! Config persistence — mirrors the original `~/.vndb-gui/config.json`.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppConfig {
    #[serde(default = "default_mode")]
    pub appearance_mode: String,
    #[serde(default)]
    pub format_template: String,
}

fn default_mode() -> String {
    "System".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            appearance_mode: default_mode(),
            format_template: String::new(),
        }
    }
}

fn config_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    Some(home.join(".vndb-gui").join("config.json"))
}

pub fn load() -> Result<AppConfig, String> {
    let Some(path) = config_path() else {
        return Ok(AppConfig::default());
    };
    match fs::read_to_string(path) {
        Ok(content) => {
            serde_json::from_str(&content).map_err(|e| format!("配置解析失败：{e}"))
        }
        Err(_) => Ok(AppConfig::default()),
    }
}

pub fn save(cfg: &AppConfig) -> Result<(), String> {
    let Some(path) = config_path() else {
        return Err("无法确定用户主目录".to_string());
    };
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}
