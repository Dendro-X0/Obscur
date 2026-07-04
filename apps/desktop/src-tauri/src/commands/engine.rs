//! Canonical engine_invoke boundary — routes typed requests to libobscur dispatch.

use crate::commands::db::DbState;
use libobscur::engine_invoke::{dispatch, EngineInvokeRequest, EngineInvokeResult};
use tauri::State;

#[tauri::command]
pub fn engine_invoke(
    state: State<'_, DbState>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    state.with_db(|db| Ok(dispatch(db, &request)))
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
