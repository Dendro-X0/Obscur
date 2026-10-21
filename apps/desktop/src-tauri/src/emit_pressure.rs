//! Slice 3 lag: count native→webview emits by event name so L2 can name the hot channel.
//! Quiet=0 still produced PostMessage + heap — need visibility beyond relay dials.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

fn emit_counts() -> &'static Mutex<HashMap<String, u64>> {
    static COUNTS: OnceLock<Mutex<HashMap<String, u64>>> = OnceLock::new();
    COUNTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn last_report_at() -> &'static Mutex<Option<Instant>> {
    static LAST: OnceLock<Mutex<Option<Instant>>> = OnceLock::new();
    LAST.get_or_init(|| Mutex::new(None))
}

fn total_emits() -> &'static AtomicU64 {
    static TOTAL: OnceLock<AtomicU64> = OnceLock::new();
    TOTAL.get_or_init(|| AtomicU64::new(0))
}

/// Record a window/app emit. Periodically prints top event names (debug dogfood).
pub fn note_webview_emit(event: &str) {
    let total = total_emits().fetch_add(1, Ordering::Relaxed) + 1;
    if let Ok(mut map) = emit_counts().lock() {
        *map.entry(event.to_string()).or_insert(0) += 1;
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

    let Ok(map) = emit_counts().lock() else {
        return;
    };
    let mut ranked: Vec<(&String, &u64)> = map.iter().collect();
    ranked.sort_by(|a, b| b.1.cmp(a.1));
    let top: Vec<String> = ranked
        .into_iter()
        .take(6)
        .map(|(k, v)| format!("{k}={v}"))
        .collect();
    println!(
        "[emit-pressure] total={} top=[{}]",
        total,
        top.join(" ")
    );
}
