//! Desktop phone-preview harness (`OBSCUR_MOBILE_PREVIEW=1`).
//!
//! Loads the mobile PWA shell in a phone-sized Tauri window with native SQLite.
//! Not a substitute for Android emulator / APK release gates.

/// Pixel-5-class logical size (CSS px) for day-to-day mobile UI iteration.
pub const PREVIEW_WIDTH: f64 = 390.0;
pub const PREVIEW_HEIGHT: f64 = 844.0;
pub const PREVIEW_MIN_WIDTH: f64 = 320.0;
pub const PREVIEW_MIN_HEIGHT: f64 = 568.0;

const ENV_FLAG: &str = "OBSCUR_MOBILE_PREVIEW";

pub fn is_enabled() -> bool {
    match std::env::var(ENV_FLAG) {
        Ok(value) => {
            let trimmed = value.trim();
            trimmed == "1" || trimmed.eq_ignore_ascii_case("true")
        }
        Err(_) => false,
    }
}

/// Injected before the page bundle — marks preview + simulated safe-area CSS vars.
pub fn init_script() -> String {
    r#"
(function () {
  try {
    window.__OBSCUR_MOBILE_PREVIEW__ = true;
    var root = document.documentElement;
    root.setAttribute("data-obscur-mobile-preview", "1");
    // Top simulates a status bar; bottom stays 0 — the preview window is rectangular
    // (no home-indicator bezel), so a fake bottom inset only created a dead band.
    root.style.setProperty("--obscur-safe-area-inset-top", "24px");
    root.style.setProperty("--obscur-safe-area-inset-bottom", "0px");
    root.style.setProperty("--obscur-safe-area-inset-left", "0px");
    root.style.setProperty("--obscur-safe-area-inset-right", "0px");
  } catch (e) {}
})();
"#
    .to_string()
}
