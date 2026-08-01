fn main() {
    tauri_build::build();

    // 版本号逻辑（对齐原 Python 版）：
    // 1. 优先使用构建环境变量 VNDB_GUI_VERSION（CI 打标签时由 workflow 注入，如 v1.0.0）
    // 2. 其次读取仓库根目录 version.txt（本地开发构建，如 1.0.0）
    // 3. 兜底为 dev
    println!("cargo:rerun-if-env-changed=VNDB_GUI_VERSION");
    println!("cargo:rerun-if-changed=../version.txt");

    let version = std::env::var("VNDB_GUI_VERSION")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(|| {
            std::fs::read_to_string("../version.txt")
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
        .unwrap_or_else(|| "dev".to_string());

    println!("cargo:rustc-env=VNDB_GUI_VERSION={version}");
}
