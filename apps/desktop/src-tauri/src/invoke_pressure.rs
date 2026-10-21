//! Slice 3 lag: count webview→native invoke IPC by command name.
//! E8: Quiet=0 + emit-pressure=0 still PostMessage-flooded — suspect invoke round-trips.
//! E32 fault-scan: ring journal of last N invokes for post-crash attribution.

use std::collections::{HashMap, VecDeque};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{ipc::Invoke, Runtime};

const JOURNAL_CAPACITY: usize = 128;
/// Flush often enough that a hard heap death still leaves a usable ring on disk.
/// Not every invoke (that pegs SATA); sync_all after each flush for durability.
const FLUSH_EVERY_N: u64 = 8;

#[derive(Clone)]
struct JournalEntry {
    t_ms: u64,
    cmd: String,
}

/// Wrap a Tauri invoke handler so every command is counted for L2 dogfood.
pub fn wrap_invoke_handler<R: Runtime>(
    handler: impl Fn(Invoke<R>) -> bool + Send + Sync + 'static,
) -> impl Fn(Invoke<R>) -> bool + Send + Sync + 'static {
    move |invoke| {
        note_invoke(invoke.message.command());
        handler(invoke)
    }
}

fn invoke_counts() -> &'static Mutex<HashMap<String, u64>> {
    static COUNTS: OnceLock<Mutex<HashMap<String, u64>>> = OnceLock::new();
    COUNTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn last_report_at() -> &'static Mutex<Option<Instant>> {
    static LAST: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    LAST.get_or_init(|| Mutex::new(None))
}

fn total_invokes() -> &'static AtomicU64 {
    static TOTAL: OnceLock<AtomicU64> = OnceLock::new();
    TOTAL.get_or_init(|| AtomicU64::new(0))
}

fn process_started_at() -> Instant {
    static START: OnceLock<Instant> = OnceLock::new();
    *START.get_or_init(Instant::now)
}

fn journal() -> &'static Mutex<VecDeque<JournalEntry>> {
    static JOURNAL: OnceLock<Mutex<VecDeque<JournalEntry>>> = OnceLock::new();
    JOURNAL.get_or_init(|| Mutex::new(VecDeque::with_capacity(JOURNAL_CAPACITY)))
}

fn journal_path() -> Option<PathBuf> {
    if let Ok(raw) = std::env::var("OBSCUR_INVOKE_JOURNAL") {
        let trimmed = raw.trim();
        if !trimmed.is_empty() {
            return Some(PathBuf::from(trimmed));
        }
    }
    crate::dev_shell_freshness::default_obscur_app_data_dir().map(|root| {
        root.join("diagnostics").join("invoke-journal-latest.json")
    })
}

fn wall_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn push_journal(command: &str) {
    let entry = JournalEntry {
        t_ms: wall_ms(),
        cmd: command.to_string(),
    };
    if let Ok(mut ring) = journal().lock() {
        if ring.len() >= JOURNAL_CAPACITY {
            ring.pop_front();
        }
        ring.push_back(entry);
    }
}

fn flush_journal(total: u64) {
    let Some(path) = journal_path() else {
        return;
    };
    let Ok(ring) = journal().lock() else {
        return;
    };
    let Ok(counts) = invoke_counts().lock() else {
        return;
    };
    let mut ranked: Vec<(&String, &u64)> = counts.iter().collect();
    ranked.sort_by(|a, b| b.1.cmp(a.1));
    let top: Vec<String> = ranked
        .into_iter()
        .take(12)
        .map(|(k, v)| format!("{k}={v}"))
        .collect();
    let recent: Vec<String> = ring
        .iter()
        .map(|e| format!("{{\"t_ms\":{},\"cmd\":{}}}", e.t_ms, serde_json::to_string(&e.cmd).unwrap_or_else(|_| "\"?\"".into())))
        .collect();
    let elapsed_ms = process_started_at().elapsed().as_millis();
    let plane = crate::perf_plane::label();
    let body = format!(
        "{{\n  \"wall_ms\": {},\n  \"elapsed_ms\": {},\n  \"total\": {},\n  \"perf_plane\": \"{}\",\n  \"top\": [{}],\n  \"recent\": [\n    {}\n  ]\n}}\n",
        wall_ms(),
        elapsed_ms,
        total,
        plane,
        top.iter()
            .map(|s| serde_json::to_string(s).unwrap_or_else(|_| "\"?\"".into()))
            .collect::<Vec<_>>()
            .join(", "),
        recent.join(",\n    ")
    );
    drop(ring);
    drop(counts);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = fs::File::create(&path) {
        let _ = file.write_all(body.as_bytes());
        // Crash-surviving: durable before process can die mid-stampede.
        let _ = file.sync_all();
    }
}

/// Record a Tauri command invoke. Periodically prints top command names (debug dogfood).
pub fn note_invoke(command: &str) {
    let total = total_invokes().fetch_add(1, Ordering::Relaxed) + 1;
    if let Ok(mut map) = invoke_counts().lock() {
        *map.entry(command.to_string()).or_insert(0) += 1;
    }
    push_journal(command);

    if total == 1 {
        let plane = crate::perf_plane::label();
        println!(
            "[perf-plane] OBSCUR_PERF_PLANE={plane} (fault-scan: local=Tor/relay/presence stubs; chrome=+engine hydrate/harvest/warmup stubs)"
        );
        if let Some(path) = journal_path() {
            println!("[invoke-journal] {}", path.display());
        }
    }

    if total % FLUSH_EVERY_N == 0 {
        flush_journal(total);
    }

    let should_report = {
        let Ok(mut last) = last_report_at().lock() else {
            return;
        };
        let now = Instant::now();
        match *last {
            None => {
                *last = Some(now);
                false
            }
            Some(prev) if now.duration_since(prev) >= Duration::from_secs(2) => {
                *last = Some(now);
                true
            }
            Some(_) => false,
        }
    };

    if !should_report {
        return;
    }

    flush_journal(total);

    let Ok(map) = invoke_counts().lock() else {
        return;
    };
    let mut ranked: Vec<(&String, &u64)> = map.iter().collect();
    ranked.sort_by(|a, b| b.1.cmp(a.1));
    let top: Vec<String> = ranked
        .into_iter()
        .take(8)
        .map(|(k, v)| format!("{k}={v}"))
        .collect();
    println!(
        "[invoke-pressure] total={} top=[{}]",
        total,
        top.join(" ")
    );
}
