//! Repo-hosted desktop update channel (stable feed on `main`).

use tauri::{AppHandle, Url};
use tauri_plugin_updater::UpdaterExt;

pub const DEFAULT_STABLE_FEED_URL: &str =
    "https://raw.githubusercontent.com/Dendro-X0/Obscur/main/apps/desktop/release/channel/stable/latest.json";

pub fn resolve_stable_feed_url() -> &'static str {
    option_env!("OBSCUR_STABLE_UPDATE_FEED_URL").unwrap_or(DEFAULT_STABLE_FEED_URL)
}

pub fn build_updater(app: &AppHandle) -> Result<tauri_plugin_updater::Updater, String> {
    let feed_url = resolve_stable_feed_url()
        .parse::<Url>()
        .map_err(|error| format!("Invalid update feed URL: {error}"))?;
    app.updater_builder()
        .endpoints(vec![feed_url])
        .map_err(|error| format!("Invalid updater endpoints: {error}"))?
        .build()
        .map_err(|error| format!("Failed to build updater: {error}"))
}
