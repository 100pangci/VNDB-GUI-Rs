/// Avoid WebKitGTK DMA-BUF rendering failures on Wayland (notably NVIDIA).
/// This only affects this process and its WebKit children, not the desktop.
pub fn configure() {
    // Preserve explicit overrides, including "0" to opt back into DMA-BUF.
    // Must run before GTK/WebKit initialization and before spawning threads.
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
}
