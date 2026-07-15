//! Pre-launch freshness: kill managed target binaries + purge WebView HTTP caches.
//!
//! Invoked via `scripts/run-obscur-dev-clean.mjs` from desktop `predev` / `prebuild`.

use obscur_desktop_lib::dev_shell_freshness::{
    default_obscur_app_data_dir, kill_managed_desktop_processes, purge_webview_http_caches,
    read_shell_manifest_stamp,
};
use std::env;
use std::path::PathBuf;
use std::process::ExitCode;

fn main() -> ExitCode {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let target_root = env::var_os("OBSCUR_DEV_CLEAN_TARGET_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|| manifest_dir.join("target"));
    let out_dir = env::var_os("OBSCUR_DEV_CLEAN_OUT_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| manifest_dir.join("../../pwa/out"));
    let data_root = env::var_os("OBSCUR_DEV_CLEAN_DATA_ROOT")
        .map(PathBuf::from)
        .or_else(default_obscur_app_data_dir);

    eprintln!(
        "[obscur-dev-clean] target_root={}",
        target_root.display()
    );
    let killed = kill_managed_desktop_processes(&target_root);
    eprintln!("[obscur-dev-clean] killed_managed={killed}");

    if let Some(data_root) = data_root.as_ref() {
        eprintln!(
            "[obscur-dev-clean] data_root={}",
            data_root.display()
        );
        let purged = purge_webview_http_caches(data_root);
        eprintln!(
            "[obscur-dev-clean] purged_cache_dirs={}",
            purged.len()
        );
    } else {
        eprintln!("[obscur-dev-clean] data_root unresolved — skip cache purge");
    }

    match read_shell_manifest_stamp(&out_dir) {
        Ok(stamp) => {
            eprintln!("[obscur-dev-clean] expected_shell_stamp={stamp}");
            println!("{stamp}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("[obscur-dev-clean] manifest stamp unavailable: {error}");
            // Soft OK: out/ may not exist yet before first shell build.
            ExitCode::SUCCESS
        }
    }
}
