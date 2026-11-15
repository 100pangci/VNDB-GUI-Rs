mod app_version;
mod config;
#[cfg(target_os = "linux")]
mod linux_compat;
mod vndb;

use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use std::thread;
use std::time::{Duration, Instant};

use config::AppConfig;
use tauri::{LogicalSize, Manager, PhysicalPosition, State, WindowEvent};
use vndb::{SearchOutcome, VNInfoDto, VndbClient};

// Windows and tao can apply transient rectangles around a DPI change, in either
// order and more than once. Re-check the actual size for a short while afterwards
// and re-apply the configured size whenever it was overridden.
const SIZE_CORRECTION_DELAYS: [Duration; 4] = [
    Duration::from_millis(40),
    Duration::from_millis(160),
    Duration::from_millis(420),
    Duration::from_millis(800),
];
// Differences at or below this many logical pixels are rounding noise.
const LOGICAL_SIZE_TOLERANCE: f64 = 1.5;
// After a DPI change, keep re-asserting the configured size while the window is
// being dragged; Windows can re-apply its own scaled rectangle during the move.
const TRANSITION_ENFORCE_MILLIS: u64 = 3000;
const MOVE_ENFORCE_INTERVAL_MILLIS: u64 = 50;

pub struct AppState {
    client: VndbClient,
}

#[derive(Clone, Copy)]
struct WindowSizeLimits {
    min_width: f64,
    min_height: f64,
}

fn window_frame_logical(window: &tauri::WebviewWindow, scale_factor: f64) -> (f64, f64) {
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return (0.0, 0.0);
    }

    match (window.outer_size(), window.inner_size()) {
        (Ok(outer), Ok(inner)) => (
            f64::from(outer.width.saturating_sub(inner.width)) / scale_factor,
            f64::from(outer.height.saturating_sub(inner.height)) / scale_factor,
        ),
        _ => (0.0, 0.0),
    }
}

fn available_logical_inner_size(
    window: &tauri::WebviewWindow,
    scale_factor: f64,
) -> Option<(f64, f64)> {
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return None;
    }

    let monitor = window.current_monitor().ok().flatten()?;
    let work_area = monitor.work_area();
    let (frame_width, frame_height) = window_frame_logical(window, scale_factor);
    Some((
        (f64::from(work_area.size.width) / scale_factor - frame_width).max(1.0),
        (f64::from(work_area.size.height) / scale_factor - frame_height).max(1.0),
    ))
}

fn clamp_position_to_work_area(
    window: &tauri::WebviewWindow,
    logical_width: f64,
    logical_height: f64,
) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };
    let scale_factor = monitor.scale_factor();
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return;
    }

    let (frame_width, frame_height) = window_frame_logical(window, scale_factor);
    let outer_width = ((logical_width + frame_width) * scale_factor)
        .round()
        .clamp(1.0, f64::from(i32::MAX)) as i32;
    let outer_height = ((logical_height + frame_height) * scale_factor)
        .round()
        .clamp(1.0, f64::from(i32::MAX)) as i32;
    let work_area = monitor.work_area();
    let work_width = work_area.size.width.min(i32::MAX as u32) as i32;
    let work_height = work_area.size.height.min(i32::MAX as u32) as i32;
    let min_x = work_area.position.x;
    let min_y = work_area.position.y;
    let max_x = min_x.saturating_add(work_width.saturating_sub(outer_width));
    let max_y = min_y.saturating_add(work_height.saturating_sub(outer_height));
    let x = position.x.clamp(min_x, max_x.max(min_x));
    let y = position.y.clamp(min_y, max_y.max(min_y));
    if x != position.x || y != position.y {
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}

fn target_logical_size(
    window: &tauri::WebviewWindow,
    limits: &WindowSizeLimits,
    logical_width: f64,
    logical_height: f64,
    scale_factor: f64,
) -> (f64, f64, f64, f64) {
    let (available_width, available_height) = available_logical_inner_size(window, scale_factor)
        .unwrap_or((logical_width, logical_height));
    let min_width = limits.min_width.min(available_width).max(0.0);
    let min_height = limits.min_height.min(available_height).max(0.0);
    let width = logical_width.clamp(min_width, available_width.max(min_width));
    let height = logical_height.clamp(min_height, available_height.max(min_height));
    (width, height, min_width, min_height)
}

fn set_window_logical_size(
    window: &tauri::WebviewWindow,
    limits: &WindowSizeLimits,
    logical_width: f64,
    logical_height: f64,
    scale_factor: f64,
) -> (f64, f64) {
    let (width, height, min_width, min_height) =
        target_logical_size(window, limits, logical_width, logical_height, scale_factor);
    let _ = window.set_min_size(Some(LogicalSize::new(min_width, min_height)));
    let _ = window.set_size(LogicalSize::new(width, height));
    (width, height)
}

fn apply_window_size(
    window: &tauri::WebviewWindow,
    limits: &WindowSizeLimits,
    logical_width: f64,
    logical_height: f64,
    scale_factor: f64,
) -> (f64, f64) {
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return (logical_width, logical_height);
    }

    if window.is_maximized().unwrap_or(false) || window.is_fullscreen().unwrap_or(false) {
        let (_, _, min_width, min_height) =
            target_logical_size(window, limits, logical_width, logical_height, scale_factor);
        let _ = window.set_min_size(Some(LogicalSize::new(min_width, min_height)));
        return (logical_width, logical_height);
    }

    let (width, height) =
        set_window_logical_size(window, limits, logical_width, logical_height, scale_factor);
    clamp_position_to_work_area(window, width, height);
    (width, height)
}

// Re-assert the configured size if something (the OS drag loop or tao) replaced
// it during a monitor switch. Called from movement events while a transition is
// still recent.
fn enforce_window_size(
    window: &tauri::WebviewWindow,
    limits: &WindowSizeLimits,
    logical_width: f64,
    logical_height: f64,
) {
    if window.is_maximized().unwrap_or(false)
        || window.is_fullscreen().unwrap_or(false)
        || window.is_minimized().unwrap_or(false)
    {
        return;
    }
    let Ok(scale_factor) = window.scale_factor() else {
        return;
    };
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return;
    }

    let (width, height, _, _) =
        target_logical_size(window, limits, logical_width, logical_height, scale_factor);
    let matches = current_logical_size(window, scale_factor).is_some_and(
        |(current_width, current_height)| {
            (current_width - width).abs() <= LOGICAL_SIZE_TOLERANCE
                && (current_height - height).abs() <= LOGICAL_SIZE_TOLERANCE
        },
    );
    if matches {
        return;
    }

    let _ = set_window_logical_size(window, limits, logical_width, logical_height, scale_factor);
}

fn current_logical_size(window: &tauri::WebviewWindow, scale_factor: f64) -> Option<(f64, f64)> {
    if !scale_factor.is_finite() || scale_factor <= 0.0 {
        return None;
    }

    let size = window.inner_size().ok()?;
    Some((
        f64::from(size.width) / scale_factor,
        f64::from(size.height) / scale_factor,
    ))
}

fn schedule_size_correction(
    window: tauri::WebviewWindow,
    generation: Arc<AtomicU64>,
    my_generation: u64,
    limits: WindowSizeLimits,
    scale_factor: f64,
    target_width: f64,
    target_height: f64,
) {
    thread::spawn(move || {
        let start = Instant::now();
        for delay in SIZE_CORRECTION_DELAYS {
            let wait = delay.saturating_sub(start.elapsed());
            if !wait.is_zero() {
                thread::sleep(wait);
            }
            if generation.load(Ordering::SeqCst) != my_generation {
                return;
            }

            let window_for_main_thread = window.clone();
            let generation_for_main_thread = Arc::clone(&generation);
            let _ = window.run_on_main_thread(move || {
                if generation_for_main_thread.load(Ordering::SeqCst) != my_generation
                    || window_for_main_thread.is_maximized().unwrap_or(false)
                    || window_for_main_thread.is_fullscreen().unwrap_or(false)
                    || window_for_main_thread.is_minimized().unwrap_or(false)
                {
                    return;
                }

                let scale_matches = window_for_main_thread
                    .scale_factor()
                    .map(|current| (current - scale_factor).abs() <= 0.01)
                    .unwrap_or(false);
                if !scale_matches {
                    // The transition is still in flight; check again later.
                    return;
                }

                let (width, height, _, _) = target_logical_size(
                    &window_for_main_thread,
                    &limits,
                    target_width,
                    target_height,
                    scale_factor,
                );
                let already_matches = current_logical_size(&window_for_main_thread, scale_factor)
                    .is_some_and(|(current_width, current_height)| {
                        (current_width - width).abs() <= LOGICAL_SIZE_TOLERANCE
                            && (current_height - height).abs() <= LOGICAL_SIZE_TOLERANCE
                    });
                if already_matches {
                    return;
                }

                let _ = apply_window_size(
                    &window_for_main_thread,
                    &limits,
                    target_width,
                    target_height,
                    scale_factor,
                );
            });
        }
    });
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
    // Configure WebKit before Tauri initializes GTK or starts worker threads.
    #[cfg(target_os = "linux")]
    linux_compat::configure();

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

                let window_config = app
                    .config()
                    .app
                    .windows
                    .iter()
                    .find(|window| window.label == "main");
                let default_width = window_config.map_or(960.0, |window| window.width);
                let default_height = window_config.map_or(820.0, |window| window.height);
                let limits = WindowSizeLimits {
                    min_width: window_config
                        .and_then(|window| window.min_width)
                        .unwrap_or(0.0),
                    min_height: window_config
                        .and_then(|window| window.min_height)
                        .unwrap_or(0.0),
                };

                let scale_factor = win
                    .scale_factor()
                    .ok()
                    .filter(|scale_factor| scale_factor.is_finite() && *scale_factor > 0.0)
                    .unwrap_or(1.0);
                let _ =
                    apply_window_size(&win, &limits, default_width, default_height, scale_factor);
                let generation = Arc::new(AtomicU64::new(0));
                let transition_deadline = Arc::new(AtomicU64::new(0));
                let last_enforce_millis = Arc::new(AtomicU64::new(0));
                let clock = Instant::now();

                let generation_for_events = Arc::clone(&generation);
                let transition_deadline_for_events = Arc::clone(&transition_deadline);
                let last_enforce_for_events = Arc::clone(&last_enforce_millis);
                let window_for_events = win.clone();
                win.on_window_event(move |event| {
                    match event {
                        WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                            let scale_factor = *scale_factor;
                            if !scale_factor.is_finite() || scale_factor <= 0.0 {
                                return;
                            }

                            let now_millis = clock.elapsed().as_millis() as u64;
                            transition_deadline_for_events
                                .store(now_millis + TRANSITION_ENFORCE_MILLIS, Ordering::SeqCst);
                            let my_generation =
                                generation_for_events.fetch_add(1, Ordering::SeqCst) + 1;
                            if window_for_events.is_maximized().unwrap_or(false)
                                || window_for_events.is_fullscreen().unwrap_or(false)
                            {
                                // Keep the OS size, but refresh the minimum constraints
                                // for the monitor's new scale factor.
                                let _ = apply_window_size(
                                    &window_for_events,
                                    &limits,
                                    default_width,
                                    default_height,
                                    scale_factor,
                                );
                                return;
                            }

                            let _ = apply_window_size(
                                &window_for_events,
                                &limits,
                                default_width,
                                default_height,
                                scale_factor,
                            );

                            schedule_size_correction(
                                window_for_events.clone(),
                                Arc::clone(&generation_for_events),
                                my_generation,
                                limits,
                                scale_factor,
                                default_width,
                                default_height,
                            );
                        }
                        WindowEvent::Moved(_) => {
                            let now_millis = clock.elapsed().as_millis() as u64;
                            if now_millis >= transition_deadline_for_events.load(Ordering::Relaxed)
                            {
                                return;
                            }
                            let last = last_enforce_for_events.load(Ordering::Relaxed);
                            if now_millis.saturating_sub(last) < MOVE_ENFORCE_INTERVAL_MILLIS {
                                return;
                            }
                            last_enforce_for_events.store(now_millis, Ordering::Relaxed);
                            enforce_window_size(
                                &window_for_events,
                                &limits,
                                default_width,
                                default_height,
                            );
                        }
                        _ => {}
                    }
                });
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
