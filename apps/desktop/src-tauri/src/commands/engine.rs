//! Canonical engine_invoke boundary — routes typed requests to libobscur dispatch.

use crate::commands::db::DbState;
use libobscur::engine_invoke::{dispatch, EngineInvokeRequest, EngineInvokeResult};
use serde_json::json;
use tauri::State;

/// Soft-empty success for chrome plane — must not throw into React (A2 error-boundary false positive).
fn chrome_hydrate_stub(engine: &str, method: &str) -> EngineInvokeResult {
    let data = match method {
        "getThread"
        | "listConversations"
        | "listTombstones"
        | "listGroups"
        | "listGroupMessages"
        | "listCallRecords"
        | "searchMessages" => json!([]),
        "insertTombstone" | "insertTombstones" => json!({ "inserted": true, "chromeStub": true }),
        "deleteMessages" | "deleteMessage" | "deleteAllTombstones" => {
            json!({ "deleted": true, "chromeStub": true })
        }
        "upsertConversation" | "insertMessage" => json!({ "upserted": true, "chromeStub": true }),
        _ => json!({ "chromeStub": true, "engine": engine, "method": method }),
    };
    EngineInvokeResult {
        ok: true,
        data: Some(data),
        error_code: None,
        error_message: None,
    }
}

#[tauri::command]
pub fn engine_invoke(
    state: State<'_, DbState>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    // Slice 3: method-level pressure (wrapper only sees bare `engine_invoke`).
    crate::invoke_pressure::note_invoke(&format!(
        "eng:{}:{}",
        request.engine,
        request.method
    ));
    // Run A2 chrome plane: unlock hydrate (dm/workspace/persistence) must not touch SQLite.
    // Return ok:true empty payloads — ok:false throws in listDmTombstones / listConversations
    // and trips the fatal React error boundary (E34).
    if crate::perf_plane::stubs_hydrate()
        && matches!(
            request.engine.as_str(),
            "dm" | "workspace" | "persistence"
        )
    {
        let cmd = format!("eng:{}:{}", request.engine, request.method);
        crate::invoke_pressure::note_invoke(&format!("perf_plane:stub:{cmd}"));
        return Ok(chrome_hydrate_stub(&request.engine, &request.method));
    }
    // Slice 1 accel: coalesce then rate-budget — Rust owns the bridge ceiling.
    if let Some(cached) = crate::invoke_coalesce::take_hot_read(&request) {
        return Ok(cached);
    }
    if let Some(denied) = crate::invoke_coalesce::budget_exceeded(&request) {
        return Ok(denied);
    }
    let result = state.with_db(|db| Ok(dispatch(db, &request)))?;
    crate::invoke_coalesce::store_hot_read(&request, &result);
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_camel_case_request() {
        let raw = serde_json::json!({
            "engine": "dm",
            "method": "getThread",
            "scope": { "profileId": "default", "windowLabel": "main" },
            "payload": { "conversationId": "abc", "limit": 50 }
        });
        let parsed: EngineInvokeRequest = serde_json::from_value(raw).unwrap();
        assert_eq!(parsed.engine, "dm");
        assert_eq!(parsed.method, "getThread");
        assert_eq!(parsed.scope.profile_id, "default");
    }
}
