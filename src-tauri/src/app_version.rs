//! Application version helpers — mirrors the original src/app_version.py.

pub const DEFAULT_VERSION: &str = "dev";

/// Compile-time bundled version.txt content.
const BUNDLED_VERSION: &str =
    include_str!(concat!(env!("CARGO_MANIFEST_DIR"), "/../version.txt"));

/// Compile-time environment override (GitHub Actions sets VNDB_GUI_VERSION from the tag).
fn compile_env_version() -> Option<&'static str> {
    match option_env!("VNDB_GUI_VERSION") {
        Some(v) if !v.trim().is_empty() => Some(v),
        _ => None,
    }
}

/// Runtime environment override.
fn runtime_env_version() -> Option<String> {
    match std::env::var("VNDB_GUI_VERSION") {
        Ok(v) if !v.trim().is_empty() => Some(v),
        _ => None,
    }
}

/// Return app version: compile-time env (tag) > runtime env > bundled version.txt > "dev".
pub fn get_app_version() -> String {
    if let Some(v) = compile_env_version() {
        return v.trim().to_string();
    }
    if let Some(v) = runtime_env_version() {
        return v.trim().to_string();
    }
    let bundled = BUNDLED_VERSION.trim();
    if !bundled.is_empty() {
        return bundled.to_string();
    }
    DEFAULT_VERSION.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_file_is_non_empty() {
        assert!(!BUNDLED_VERSION.trim().is_empty());
    }
}
