//! Pre-launch freshness helpers for static desktop shell (OBSCUR_DESKTOP_STATIC_DEV).
//!
//! Kill only managed binaries under `src-tauri/target`. Purge HTTP/code caches only —
//! never IndexedDB / Local Storage / keychain.

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Cache directory leaf names that may be purged for shell freshness.
pub const WEBVIEW_HTTP_CACHE_DIR_NAMES: &[&str] = &[
    "Cache",
    "Code Cache",
    "GPUCache",
    "Service Worker",
];

const MANAGED_WINDOWS_BINARIES: &[(&str, &str)] = &[
    ("obscur_desktop_app.exe", "desktop app"),
    ("tor.exe", "Tor sidecar"),
];

const MANAGED_POSIX_BINARY_SUFFIXES: &[(&str, &str)] = &[
    ("/obscur_desktop_app", "desktop app"),
    ("/tor", "Tor sidecar"),
];

/// True when `executable_path` is a managed binary under `target_root`.
pub fn is_managed_target_binary_path(
    executable_path: &Path,
    target_root: &Path,
    binary_name: &str,
) -> bool {
    let Some(exe) = normalize_path_lossy(executable_path) else {
        return false;
    };
    let Some(root) = normalize_path_lossy(target_root) else {
        return false;
    };
    let binary = binary_name.to_ascii_lowercase();
    exe.starts_with(&root) && exe.ends_with(&format!("/{binary}"))
}

/// True when a directory leaf name is on the HTTP/code cache allow-list.
pub fn is_webview_http_cache_dir_name(name: &str) -> bool {
    WEBVIEW_HTTP_CACHE_DIR_NAMES
        .iter()
        .any(|allowed| *allowed == name)
}

/// Read `clientBuildStamp` from `out_dir/obscur-shell-manifest.json`.
pub fn read_shell_manifest_stamp(out_dir: &Path) -> Result<String, String> {
    let path = out_dir.join("obscur-shell-manifest.json");
    let raw = fs::read_to_string(&path).map_err(|error| {
        format!(
            "failed to read {}: {error}",
            path.display()
        )
    })?;
    let parsed: Value = serde_json::from_str(&raw).map_err(|error| {
        format!(
            "invalid JSON in {}: {error}",
            path.display()
        )
    })?;
    let stamp = parsed
        .get("clientBuildStamp")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                "missing clientBuildStamp in {}",
                path.display()
            )
        })?;
    Ok(stamp.to_string())
}

/// Init script snippet that publishes the on-disk expected stamp for static-dev gate.
pub fn expected_shell_stamp_init_script(expected_stamp: &str) -> String {
    let escaped = serde_json::to_string(expected_stamp).unwrap_or_else(|_| "\"\"".to_string());
    format!(
        r#"(function(){{try{{window.__OBSCUR_EXPECTED_SHELL_STAMP__={escaped};document.documentElement.setAttribute("data-obscur-expected-shell-stamp",{escaped});}}catch(e){{}}}})();"#
    )
}

/// Kill managed desktop/tor processes whose executable lives under `target_root`.
/// Returns number of processes successfully signaled.
pub fn kill_managed_desktop_processes(target_root: &Path) -> usize {
    if cfg!(windows) {
        kill_managed_windows(target_root)
    } else {
        kill_managed_posix(target_root)
    }
}

/// Recursively purge allow-listed WebView HTTP/code cache directories under `data_root`.
/// Returns paths successfully removed.
pub fn purge_webview_http_caches(data_root: &Path) -> Vec<PathBuf> {
    let mut removed = Vec::new();
    if !data_root.exists() {
        return removed;
    }
    walk_purge_caches(data_root, &mut removed);
    removed
}

/// Default local app-data directory for identifier `app.obscur.desktop`.
pub fn default_obscur_app_data_dir() -> Option<PathBuf> {
    let home = dirs_home()?;
    if cfg!(windows) {
        std::env::var_os("LOCALAPPDATA").map(|base| PathBuf::from(base).join("app.obscur.desktop"))
    } else if cfg!(target_os = "macos") {
        Some(
            home.join("Library")
                .join("Application Support")
                .join("app.obscur.desktop"),
        )
    } else {
        Some(home.join(".local").join("share").join("app.obscur.desktop"))
    }
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn normalize_path_lossy(path: &Path) -> Option<String> {
    let raw = path.to_str()?.replace('\\', "/").to_ascii_lowercase();
    Some(raw)
}

fn walk_purge_caches(dir: &Path, removed: &mut Vec<PathBuf>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if is_webview_http_cache_dir_name(&name) {
            match fs::remove_dir_all(&path) {
                Ok(()) => {
                    eprintln!(
                        "[obscur-dev-clean] purged cache dir {}",
                        path.display()
                    );
                    removed.push(path);
                }
                Err(error) => {
                    eprintln!(
                        "[obscur-dev-clean] failed to purge {}: {error}",
                        path.display()
                    );
                }
            }
            continue;
        }
        // Never descend into IndexedDB / Local Storage trees looking for coincident names.
        if matches!(
            name.as_str(),
            "IndexedDB" | "Local Storage" | "Session Storage" | "databases"
        ) {
            continue;
        }
        walk_purge_caches(&path, removed);
    }
}

#[cfg(windows)]
fn kill_managed_windows(target_root: &Path) -> usize {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-Process -Name tor,obscur_desktop_app -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,Path | ConvertTo-Json -Compress",
        ])
        .output();
    let Ok(output) = output else {
        return 0;
    };
    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() || raw == "null" {
        return 0;
    }
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(_) => return 0,
    };
    let list = match parsed {
        Value::Array(items) => items,
        other => vec![other],
    };
    let mut killed = 0usize;
    for proc in list {
        let process_name = format!(
            "{}.exe",
            proc.get("ProcessName")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_ascii_lowercase()
        );
        let Some((_, label)) = MANAGED_WINDOWS_BINARIES
            .iter()
            .find(|(name, _)| *name == process_name.as_str())
        else {
            continue;
        };
        let pid = proc
            .get("Id")
            .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|n| n as u64)))
            .unwrap_or(0);
        if pid == 0 {
            continue;
        }
        let executable_path = proc
            .get("Path")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if !is_managed_target_binary_path(
            Path::new(executable_path),
            target_root,
            &process_name,
        ) {
            continue;
        }
        let stop = Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("Stop-Process -Id {pid} -Force"),
            ])
            .status();
        if stop.map(|s| s.success()).unwrap_or(false) {
            eprintln!(
                "[obscur-dev-clean] Stopped stale {label} PID {pid}: {executable_path}"
            );
            killed += 1;
        }
    }
    killed
}

#[cfg(not(windows))]
fn kill_managed_windows(_target_root: &Path) -> usize {
    0
}

fn kill_managed_posix(target_root: &Path) -> usize {
    let output = Command::new("ps")
        .args(["-axo", "pid=,command="])
        .output();
    let Ok(output) = output else {
        return 0;
    };
    let raw = String::from_utf8_lossy(&output.stdout);
    let Some(root) = normalize_path_lossy(target_root) else {
        return 0;
    };
    let mut killed = 0usize;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Some((pid_str, command)) = trimmed.split_once(char::is_whitespace) else {
            continue;
        };
        let Ok(pid) = pid_str.trim().parse::<i32>() else {
            continue;
        };
        let command_norm = command.replace('\\', "/").to_ascii_lowercase();
        if !command_norm.contains(&root) {
            continue;
        }
        let Some((_, label)) = MANAGED_POSIX_BINARY_SUFFIXES
            .iter()
            .find(|(suffix, _)| command_norm.contains(suffix))
        else {
            continue;
        };
        if signal_kill(pid) {
            eprintln!("[obscur-dev-clean] Stopped stale {label} PID {pid}");
            killed += 1;
        }
    }
    killed
}

#[cfg(unix)]
fn signal_kill(pid: i32) -> bool {
    // SIGKILL = 9
    unsafe { libc::kill(pid, 9) == 0 }
}

#[cfg(not(unix))]
fn signal_kill(_pid: i32) -> bool {
    false
}

#[cfg(unix)]
mod libc {
    extern "C" {
        pub fn kill(pid: i32, sig: i32) -> i32;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let path = std::env::temp_dir().join(format!("obscur-dev-fresh-{label}-{nanos}"));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("temp dir");
        path
    }

    #[test]
    fn managed_path_requires_target_root_prefix() {
        let target = PathBuf::from(r"E:\repo\apps\desktop\src-tauri\target");
        assert!(is_managed_target_binary_path(
            &target.join("debug").join("obscur_desktop_app.exe"),
            &target,
            "obscur_desktop_app.exe",
        ));
        assert!(!is_managed_target_binary_path(
            Path::new(r"C:\Windows\System32\tor.exe"),
            &target,
            "tor.exe",
        ));
    }

    #[test]
    fn cache_allow_list_is_exact() {
        assert!(is_webview_http_cache_dir_name("Cache"));
        assert!(is_webview_http_cache_dir_name("Code Cache"));
        assert!(is_webview_http_cache_dir_name("GPUCache"));
        assert!(is_webview_http_cache_dir_name("Service Worker"));
        assert!(!is_webview_http_cache_dir_name("IndexedDB"));
        assert!(!is_webview_http_cache_dir_name("Local Storage"));
        assert!(!is_webview_http_cache_dir_name("EBWebView"));
    }

    #[test]
    fn purge_only_allowlisted_cache_dirs() {
        let root = temp_dir("purge");
        let eb = root.join("profiles").join("default").join("EBWebView").join("Default");
        let code_cache = eb.join("Code Cache");
        let gpu = eb.join("GPUCache");
        let indexed = eb.join("IndexedDB").join("https_127.0.0.1_1430");
        let local = eb.join("Local Storage");
        fs::create_dir_all(&code_cache).unwrap();
        fs::create_dir_all(&gpu).unwrap();
        fs::create_dir_all(&indexed).unwrap();
        fs::create_dir_all(&local).unwrap();
        fs::write(code_cache.join("blob"), b"old").unwrap();
        fs::write(indexed.join("idb"), b"keep").unwrap();
        fs::write(local.join("ls"), b"keep").unwrap();

        let removed = purge_webview_http_caches(&root);
        assert_eq!(removed.len(), 2);
        assert!(!code_cache.exists());
        assert!(!gpu.exists());
        assert!(indexed.exists());
        assert!(local.exists());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn read_shell_manifest_stamp_ok() {
        let out = temp_dir("manifest");
        fs::write(
            out.join("obscur-shell-manifest.json"),
            r#"{ "clientBuildStamp": "shell-abc123" }"#,
        )
        .unwrap();
        assert_eq!(
            read_shell_manifest_stamp(&out).unwrap(),
            "shell-abc123"
        );
        let _ = fs::remove_dir_all(&out);
    }

    #[test]
    fn expected_stamp_init_script_embeds_value() {
        let script = expected_shell_stamp_init_script("shell-xyz");
        assert!(script.contains("shell-xyz"));
        assert!(script.contains("__OBSCUR_EXPECTED_SHELL_STAMP__"));
    }
}
