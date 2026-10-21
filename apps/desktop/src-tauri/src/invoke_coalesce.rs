//! Native coalesce + unlock rate budget — thin-webview Slice 1 accel.
//! Even if JS remounts dual-owned callers, Rust owns the bridge ceiling.

use crate::invoke_pressure;
use libobscur::engine_invoke::{EngineInvokeRequest, EngineInvokeResult};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const COALESCE_WINDOW: Duration = Duration::from_millis(2_500);
/// Max distinct hot dispatches (cache miss) per method class inside the budget window.
const BUDGET_WINDOW: Duration = Duration::from_secs(2);
const BUDGET_MAX_PER_METHOD: u32 = 2;

fn is_hot_read(request: &EngineInvokeRequest) -> bool {
    matches!(
        (request.engine.as_str(), request.method.as_str()),
        ("dm", "listTombstones")
            | ("dm", "listConversations")
            | ("dm", "getThread")
            | ("workspace", "listGroups")
            | ("workspace", "listGroupMessages")
            | ("persistence", "listCallRecords")
    )
}

fn method_class(request: &EngineInvokeRequest) -> String {
    format!("{}:{}", request.engine, request.method)
}

fn cache_key(request: &EngineInvokeRequest) -> String {
    format!(
        "{}:{}:{}:{}",
        request.engine,
        request.method,
        request.scope.profile_id,
        request
            .payload
            .as_ref()
            .and_then(|v| {
                v.get("groupId")
                    .or_else(|| v.get("conversationId"))
                    .or_else(|| v.get("conversation_id"))
            })
            .and_then(|v| v.as_str())
            .unwrap_or("")
    )
}

fn empty_hot_stub(request: &EngineInvokeRequest) -> EngineInvokeResult {
    EngineInvokeResult {
        ok: true,
        data: Some(json!([])),
        error_code: None,
        error_message: None,
    }
}

struct CoalesceEntry {
    at: Instant,
    result: EngineInvokeResult,
}

fn cache() -> &'static Mutex<HashMap<String, CoalesceEntry>> {
    static CACHE: std::sync::OnceLock<Mutex<HashMap<String, CoalesceEntry>>> =
        std::sync::OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

struct BudgetEntry {
    window_start: Instant,
    count: u32,
}

fn budgets() -> &'static Mutex<HashMap<String, BudgetEntry>> {
    static BUDGETS: std::sync::OnceLock<Mutex<HashMap<String, BudgetEntry>>> =
        std::sync::OnceLock::new();
    BUDGETS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Soft-deny when this hot method class already hit the unlock budget.
pub fn budget_exceeded(request: &EngineInvokeRequest) -> Option<EngineInvokeResult> {
    if !is_hot_read(request) {
        return None;
    }
    let class = method_class(request);
    let Ok(mut map) = budgets().lock() else {
        return None;
    };
    let now = Instant::now();
    let entry = map.entry(class.clone()).or_insert(BudgetEntry {
        window_start: now,
        count: 0,
    });
    if now.duration_since(entry.window_start) > BUDGET_WINDOW {
        entry.window_start = now;
        entry.count = 0;
    }
    if entry.count >= BUDGET_MAX_PER_METHOD {
        invoke_pressure::note_invoke(&format!("eng:{}:budget", class));
        return Some(empty_hot_stub(request));
    }
    entry.count += 1;
    None
}

/// If this is a hot unlock read still warm in cache, return it and note coalesce.
pub fn take_hot_read(request: &EngineInvokeRequest) -> Option<EngineInvokeResult> {
    if !is_hot_read(request) {
        return None;
    }
    let key = cache_key(request);
    let Ok(mut map) = cache().lock() else {
        return None;
    };
    let Some(entry) = map.get(&key) else {
        return None;
    };
    if entry.at.elapsed() > COALESCE_WINDOW {
        map.remove(&key);
        return None;
    }
    invoke_pressure::note_invoke(&format!(
        "eng:{}:{}:coalesce",
        request.engine, request.method
    ));
    Some(entry.result.clone())
}

pub fn store_hot_read(request: &EngineInvokeRequest, result: &EngineInvokeResult) {
    if !is_hot_read(request) || !result.ok {
        return;
    }
    let key = cache_key(request);
    if let Ok(mut map) = cache().lock() {
        map.insert(
            key,
            CoalesceEntry {
                at: Instant::now(),
                result: result.clone(),
            },
        );
    }
}
