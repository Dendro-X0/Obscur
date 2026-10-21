//! Dogfood fault-scan planes — isolate local shell from network/Tor without Settings UI.
//! See specs/backend/desktop-local-plane-fault-scan-design-2026-10.md
//!
//! Planes:
//! - `full` (default) — production-like
//! - `local` — Tor/relay/presence-sign stubbed; SQLite/engine still runs (Run A)
//! - `chrome` — local stubs + unlock hydrate stubbed (engine dm/workspace/persistence,
//!   harvest, warmup) + JS offline-stub quarantine (`window.__OBSCUR_PERF_PLANE__`) so
//!   online dogfood cannot stampede account-sync / presence / tombstone hydrate (Run A2)

use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PerfPlane {
    Full,
    Local,
    Chrome,
}

fn parsed_plane() -> PerfPlane {
    match std::env::var("OBSCUR_PERF_PLANE") {
        Ok(raw) => {
            let normalized = raw.trim().to_ascii_lowercase();
            if normalized == "chrome" || normalized == "chrome-only" || normalized == "ui" {
                PerfPlane::Chrome
            } else if normalized == "local" || normalized == "local-only" || normalized == "1" {
                PerfPlane::Local
            } else {
                PerfPlane::Full
            }
        }
        Err(_) => PerfPlane::Full,
    }
}

pub fn current() -> PerfPlane {
    static PLANE: OnceLock<PerfPlane> = OnceLock::new();
    *PLANE.get_or_init(parsed_plane)
}

/// Tor / relay dial / presence-sign stubs (local + chrome).
pub fn stubs_network() -> bool {
    matches!(current(), PerfPlane::Local | PerfPlane::Chrome)
}

/// Unlock SQLite / harvest / warmup stubs (chrome only).
pub fn stubs_hydrate() -> bool {
    current() == PerfPlane::Chrome
}

pub fn is_local() -> bool {
    stubs_network()
}

pub fn reject_message(command: &str) -> String {
    let plane = match current() {
        PerfPlane::Chrome => "chrome",
        PerfPlane::Local => "local",
        PerfPlane::Full => "full",
    };
    format!("OBSCUR_PERF_PLANE={plane}: {command} disabled (fault-scan)")
}

pub fn label() -> &'static str {
    match current() {
        PerfPlane::Chrome => "chrome",
        PerfPlane::Local => "local",
        PerfPlane::Full => "full",
    }
}
