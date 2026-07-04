//! Canonical engine_invoke dispatch — shared by Tauri and headless CLI.

use crate::db::Database;
use crate::protocol::types::{unix_ms_now, QuorumPublishReport, RelayPublishAttempt};
use crate::protocol::ProtocolRuntime;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::Instant;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineScope {
    pub profile_id: String,
    pub window_label: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineInvokeRequest {
    pub engine: String,
    pub method: String,
    pub scope: EngineScope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineInvokeResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

fn err(code: &str, message: impl Into<String>) -> EngineInvokeResult {
    EngineInvokeResult {
        ok: false,
        data: None,
        error_code: Some(code.to_string()),
        error_message: Some(message.into()),
    }
}

fn ok(data: impl Serialize) -> EngineInvokeResult {
    match serde_json::to_value(data) {
        Ok(value) => EngineInvokeResult {
            ok: true,
            data: Some(value),
            error_code: None,
            error_message: None,
        },
        Err(e) => err("serialize_error", e.to_string()),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DmGetThreadPayload {
    conversation_id: String,
    #[serde(default = "default_thread_limit")]
    limit: u32,
    before_received_at: Option<i64>,
}

fn default_thread_limit() -> u32 {
    200
}

fn dispatch_dm(
    db: &Database,
    method: &str,
    scope: &EngineScope,
    payload: Option<Value>,
) -> EngineInvokeResult {
    match method {
        "getThread" => {
            let parsed: DmGetThreadPayload = match payload {
                Some(value) => match serde_json::from_value(value) {
                    Ok(parsed) => parsed,
                    Err(e) => return err("invalid_payload", format!("invalid getThread payload: {e}")),
                },
                None => return err("invalid_payload", "getThread requires payload"),
            };
            if parsed.conversation_id.trim().is_empty() {
                return err("invalid_payload", "conversationId is required");
            }
            match db.get_messages_by_conversation(
                &scope.profile_id,
                &parsed.conversation_id,
                parsed.limit,
                parsed.before_received_at,
            ) {
                Ok(rows) => ok(rows),
                Err(e) => err("db_error", e.to_string()),
            }
        }
        "listConversations" => match db.get_conversations(&scope.profile_id) {
            Ok(rows) => ok(rows),
            Err(e) => err("db_error", e.to_string()),
        },
        other => err("invalid_method", format!("unknown dm method: {other}")),
    }
}

fn dispatch_workspace(db: &Database, method: &str, scope: &EngineScope) -> EngineInvokeResult {
    match method {
        "listGroups" => match db.get_groups(&scope.profile_id) {
            Ok(rows) => ok(rows),
            Err(e) => err("db_error", e.to_string()),
        },
        other => err("invalid_method", format!("unknown workspace method: {other}")),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransportPublishRelayEventPayload {
    relay_urls: Vec<String>,
    payload: String,
    #[serde(default)]
    correlation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransportPublishRelayEventRelayResult {
    relay_url: String,
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TransportPublishRelayEventResult {
    success: bool,
    success_count: u32,
    total_relays: u32,
    quorum_required: u32,
    met_quorum: bool,
    results: Vec<TransportPublishRelayEventRelayResult>,
    failures: Vec<TransportPublishRelayEventRelayResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    overall_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    correlation_id: Option<String>,
}

/// Legacy stub error code retained for contract pins across pre-w37 waves.
#[allow(dead_code)]
const TRANSPORT_PUBLISH_NOT_WIRED: &str = "transport_publish_not_wired";

const TRANSPORT_PUBLISH_DRY_RUN_ERROR: &str = "transport_publish_dry_run";

/// Retained for charter pins across W42 contract history.
#[allow(dead_code)]
const TRANSPORT_PUBLISH_NETWORK_NOT_WIRED: &str = "transport_publish_network_not_wired";

fn normalize_transport_relay_urls(urls: &[String]) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut normalized = Vec::new();
    for url in urls {
        let trimmed = url.trim();
        if !trimmed.is_empty() && seen.insert(trimmed.to_string()) {
            normalized.push(trimmed.to_string());
        }
    }
    normalized
}

fn parse_transport_publish_relay_event_payload(
    payload: Option<Value>,
) -> Result<TransportPublishRelayEventPayload, EngineInvokeResult> {
    let value = match payload {
        Some(value) => value,
        None => {
            return Err(err(
                "invalid_payload",
                "publishRelayEvent requires payload",
            ));
        }
    };
    let parsed: TransportPublishRelayEventPayload = match serde_json::from_value(value) {
        Ok(parsed) => parsed,
        Err(e) => {
            return Err(err(
                "invalid_payload",
                format!("invalid publishRelayEvent payload: {e}"),
            ));
        }
    };
    if normalize_transport_relay_urls(&parsed.relay_urls).is_empty() {
        return Err(err(
            "invalid_payload",
            "publishRelayEvent requires non-empty relayUrls",
        ));
    }
    if parsed.payload.trim().is_empty() {
        return Err(err(
            "invalid_payload",
            "publishRelayEvent requires non-empty payload",
        ));
    }
    Ok(parsed)
}

fn transport_publish_quorum_required(total_relays: u32) -> u32 {
    std::cmp::max(1, (total_relays + 1) / 2)
}

fn assemble_transport_publish_relay_event_network(payload: Option<Value>) -> EngineInvokeResult {
    let parsed = match parse_transport_publish_relay_event_payload(payload.clone()) {
        Ok(parsed) => parsed,
        Err(result) => return result,
    };
    let relay_urls = normalize_transport_relay_urls(&parsed.relay_urls);
    let attempts = collect_headless_transport_publish_attempts(&relay_urls);
    let started = Instant::now();
    assemble_transport_publish_relay_event_network_with_attempts(
        payload,
        &attempts,
        started.elapsed().as_millis() as u64,
    )
}

/// Desktop relay-pool injection surface (W45): supply real per-relay attempts.
pub fn assemble_transport_publish_relay_event_network_with_attempts(
    payload: Option<Value>,
    attempts: &[RelayPublishAttempt],
    elapsed_ms: u64,
) -> EngineInvokeResult {
    let parsed = match parse_transport_publish_relay_event_payload(payload) {
        Ok(parsed) => parsed,
        Err(result) => return result,
    };
    let relay_urls = normalize_transport_relay_urls(&parsed.relay_urls);
    let runtime = match open_protocol_runtime_for_transport_publish() {
        Ok(runtime) => runtime,
        Err(message) => return err("db_error", message),
    };
    let publish_result = runtime.publish_with_quorum_attempts(
        &parsed.payload,
        &relay_urls,
        attempts,
        elapsed_ms,
    );
    if !publish_result.ok {
        let message = publish_result
            .error
            .map(|error| error.message)
            .unwrap_or_else(|| "Transport publish failed.".to_string());
        return err("transport_publish_invoke_failed", message);
    }
    let report = match publish_result.value {
        Some(report) => report,
        None => {
            return err(
                "transport_publish_invoke_failed",
                "Transport publish returned no quorum report.",
            );
        }
    };
    ok(map_quorum_report_to_transport_publish_result(
        &report,
        &relay_urls,
        parsed.correlation_id,
    ))
}

/// Exported for desktop async publish command gating (W42/W45).
pub fn is_transport_host_publish_network_enabled() -> bool {
    std::env::var("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK")
        .ok()
        .as_deref()
        == Some("1")
}

fn dispatch_transport_publish_relay_event(payload: Option<Value>) -> EngineInvokeResult {
    if is_transport_host_publish_network_enabled() {
        return assemble_transport_publish_relay_event_network(payload);
    }
    assemble_transport_publish_relay_event_dry_run(payload)
}

fn open_protocol_runtime_for_transport_publish() -> Result<ProtocolRuntime, String> {
    if let Ok(path) = std::env::var("OBSCUR_PROTOCOL_DB_PATH") {
        if !path.trim().is_empty() {
            return ProtocolRuntime::new(path);
        }
    }
    let mut path = std::env::temp_dir();
    path.push(format!(
        "obscur-transport-publish-{}.sqlite3",
        unix_ms_now()
    ));
    ProtocolRuntime::new(path.to_string_lossy().to_string())
}

fn collect_headless_transport_publish_attempts(relay_urls: &[String]) -> Vec<RelayPublishAttempt> {
    relay_urls
        .iter()
        .map(|relay_url| RelayPublishAttempt {
            relay_url: relay_url.clone(),
            success: false,
            error: Some("No writable relay connection".to_string()),
        })
        .collect()
}

fn map_quorum_report_to_transport_publish_result(
    report: &QuorumPublishReport,
    relay_urls: &[String],
    correlation_id: Option<String>,
) -> TransportPublishRelayEventResult {
    let total_relays = relay_urls.len() as u32;
    let quorum_required = transport_publish_quorum_required(total_relays);
    let failure_by_relay: HashMap<String, String> = report
        .failures
        .iter()
        .map(|entry| {
            (
                entry.relay_url.clone(),
                entry
                    .error
                    .clone()
                    .unwrap_or_else(|| "Publish failed".to_string()),
            )
        })
        .collect();

    let results: Vec<TransportPublishRelayEventRelayResult> = relay_urls
        .iter()
        .map(|relay_url| {
            if let Some(error) = failure_by_relay.get(relay_url) {
                TransportPublishRelayEventRelayResult {
                    relay_url: relay_url.clone(),
                    success: false,
                    error: Some(error.clone()),
                }
            } else {
                TransportPublishRelayEventRelayResult {
                    relay_url: relay_url.clone(),
                    success: true,
                    error: None,
                }
            }
        })
        .collect();

    let failures: Vec<TransportPublishRelayEventRelayResult> = results
        .iter()
        .filter(|entry| !entry.success)
        .cloned()
        .collect();

    let met_quorum = report.met_quorum;
    let success_count = report.success_count as u32;
    let overall_error = if met_quorum {
        None
    } else {
        Some(format!(
            "Quorum not met ({success_count}/{total_relays})."
        ))
    };

    TransportPublishRelayEventResult {
        success: met_quorum,
        success_count,
        total_relays,
        quorum_required,
        met_quorum,
        results,
        failures,
        overall_error,
        correlation_id,
    }
}

fn assemble_transport_publish_relay_event_dry_run(payload: Option<Value>) -> EngineInvokeResult {
    let parsed = match parse_transport_publish_relay_event_payload(payload) {
        Ok(parsed) => parsed,
        Err(result) => return result,
    };
    let relay_urls = normalize_transport_relay_urls(&parsed.relay_urls);
    let total_relays = relay_urls.len() as u32;
    let quorum_required = transport_publish_quorum_required(total_relays);
    let dry_run_message = format!("{TRANSPORT_PUBLISH_DRY_RUN_ERROR}: no network I/O");
    let results: Vec<TransportPublishRelayEventRelayResult> = relay_urls
        .iter()
        .map(|relay_url| TransportPublishRelayEventRelayResult {
            relay_url: relay_url.clone(),
            success: false,
            error: Some(dry_run_message.clone()),
        })
        .collect();
    let failures = results.clone();

    ok(TransportPublishRelayEventResult {
        success: false,
        success_count: 0,
        total_relays,
        quorum_required,
        met_quorum: false,
        results,
        failures,
        overall_error: Some(format!("Quorum not met (0/{total_relays}).")),
        correlation_id: parsed.correlation_id,
    })
}

fn dispatch_transport(
    db: &Database,
    method: &str,
    scope: &EngineScope,
    payload: Option<Value>,
) -> EngineInvokeResult {
    match method {
        "listRelayCheckpoints" => match db.get_relay_checkpoints(&scope.profile_id) {
            Ok(rows) => ok(rows),
            Err(e) => err("db_error", e.to_string()),
        },
        "listConfiguredRelayUrls" => {
            let mut urls: Vec<String> = Vec::new();
            let mut seen = std::collections::HashSet::new();
            match db.get_groups(&scope.profile_id) {
                Ok(groups) => {
                    for group in groups {
                        let url = group.relay_url.trim();
                        if !url.is_empty() && seen.insert(url.to_string()) {
                            urls.push(url.to_string());
                        }
                    }
                }
                Err(e) => return err("db_error", e.to_string()),
            }
            match db.get_relay_checkpoints(&scope.profile_id) {
                Ok(checkpoints) => {
                    for checkpoint in checkpoints {
                        let url = checkpoint.relay_url.trim();
                        if !url.is_empty() && seen.insert(url.to_string()) {
                            urls.push(url.to_string());
                        }
                    }
                }
                Err(e) => return err("db_error", e.to_string()),
            }
            ok(urls)
        }
        "publishRelayEvent" => dispatch_transport_publish_relay_event(payload),
        other => err("invalid_method", format!("unknown transport method: {other}")),
    }
}

/// Single owner for typed engine requests against an open SQLite database.
pub fn dispatch(db: &Database, request: &EngineInvokeRequest) -> EngineInvokeResult {
    if request.scope.profile_id.trim().is_empty() {
        return err("invalid_scope", "profileId is required");
    }

    match request.engine.as_str() {
        "dm" => dispatch_dm(db, &request.method, &request.scope, request.payload.clone()),
        "workspace" => dispatch_workspace(db, &request.method, &request.scope),
        "transport" => dispatch_transport(db, &request.method, &request.scope, request.payload.clone()),
        "auth" => err(
            "invalid_engine",
            "auth engine uses auth_boot_snapshot command — not engine_invoke",
        ),
        other => err("invalid_engine", format!("engine not implemented: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repositories::{ConversationRecord, GroupRecord, RelayCheckpointRecord};

    fn transport_publish_network_env_lock() -> std::sync::MutexGuard<'static, ()> {
        static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        LOCK.lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn seed_conversation(db: &Database, profile_id: &str, conversation_id: &str) {
        db.ensure_profile_slot(profile_id, "seed-pubkey").unwrap();
        db.upsert_conversation(&ConversationRecord {
            id: conversation_id.to_string(),
            profile_id: profile_id.to_string(),
            peer_pubkey: "peer".to_string(),
            last_event_id: None,
            last_message_at: Some(1),
            last_plaintext_preview: Some("hi".to_string()),
            unread_count: 0,
        })
        .unwrap();
    }

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

    #[test]
    fn dm_list_conversations_returns_rows() {
        let db = Database::new(None).unwrap();
        seed_conversation(&db, "p", "dm:a:b");
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "dm".to_string(),
                method: "listConversations".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: None,
            },
        );
        assert!(result.ok);
        let data = result.data.unwrap();
        let rows: Vec<ConversationRecord> = serde_json::from_value(data).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, "dm:a:b");
    }

    #[test]
    fn workspace_list_groups_returns_rows() {
        let db = Database::new(None).unwrap();
        db.ensure_profile_slot("p", "seed-pubkey").unwrap();
        db.upsert_group(&GroupRecord {
            id: "g1".to_string(),
            profile_id: "p".to_string(),
            name: "team".to_string(),
            relay_url: "wss://relay".to_string(),
            kind: "sealed".to_string(),
            joined_at: 1,
        })
        .unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "workspace".to_string(),
                method: "listGroups".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: None,
            },
        );
        assert!(result.ok);
        let rows: Vec<GroupRecord> = serde_json::from_value(result.data.unwrap()).unwrap();
        assert_eq!(rows.len(), 1);
    }

    #[test]
    fn rejects_empty_profile_id() {
        let db = Database::new(None).unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "dm".to_string(),
                method: "listConversations".to_string(),
                scope: EngineScope {
                    profile_id: "  ".to_string(),
                    window_label: None,
                },
                payload: None,
            },
        );
        assert!(!result.ok);
        assert_eq!(result.error_code.as_deref(), Some("invalid_scope"));
    }

    #[test]
    fn transport_list_relay_checkpoints_returns_rows() {
        let db = Database::new(None).unwrap();
        db.ensure_profile_slot("p", "seed-pubkey").unwrap();
        db.upsert_relay_checkpoint(&RelayCheckpointRecord {
            profile_id: "p".to_string(),
            relay_url: "wss://team.relay".to_string(),
            last_event_at: 1_700_000_000,
        })
        .unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "transport".to_string(),
                method: "listRelayCheckpoints".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: None,
            },
        );
        assert!(result.ok);
        let rows: Vec<RelayCheckpointRecord> = serde_json::from_value(result.data.unwrap()).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].relay_url, "wss://team.relay");
    }

    #[test]
    fn transport_list_configured_relay_urls_merges_groups_and_checkpoints() {
        let db = Database::new(None).unwrap();
        db.ensure_profile_slot("p", "seed-pubkey").unwrap();
        db.upsert_group(&GroupRecord {
            id: "g1".to_string(),
            profile_id: "p".to_string(),
            name: "team".to_string(),
            relay_url: "wss://team.relay".to_string(),
            kind: "sealed".to_string(),
            joined_at: 1,
        })
        .unwrap();
        db.upsert_relay_checkpoint(&RelayCheckpointRecord {
            profile_id: "p".to_string(),
            relay_url: "wss://backup.relay".to_string(),
            last_event_at: 1,
        })
        .unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "transport".to_string(),
                method: "listConfiguredRelayUrls".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: None,
            },
        );
        assert!(result.ok);
        let urls: Vec<String> = serde_json::from_value(result.data.unwrap()).unwrap();
        assert_eq!(urls.len(), 2);
        assert!(urls.contains(&"wss://team.relay".to_string()));
        assert!(urls.contains(&"wss://backup.relay".to_string()));
    }

    #[test]
    fn transport_publish_relay_event_rejects_missing_payload() {
        let _env_lock = transport_publish_network_env_lock();
        std::env::remove_var("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK");
        let db = Database::new(None).unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "transport".to_string(),
                method: "publishRelayEvent".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: None,
            },
        );
        assert!(!result.ok);
        assert_eq!(result.error_code.as_deref(), Some("invalid_payload"));
    }

    #[test]
    fn transport_publish_relay_event_rejects_empty_relay_urls() {
        let db = Database::new(None).unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "transport".to_string(),
                method: "publishRelayEvent".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: Some(serde_json::json!({
                    "relayUrls": ["  ", ""],
                    "payload": "[\"EVENT\",{\"id\":\"abc\"}]"
                })),
            },
        );
        assert!(!result.ok);
        assert_eq!(result.error_code.as_deref(), Some("invalid_payload"));
    }

    #[test]
    fn transport_publish_relay_event_rejects_empty_event_payload() {
        let db = Database::new(None).unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "transport".to_string(),
                method: "publishRelayEvent".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: Some(serde_json::json!({
                    "relayUrls": ["wss://relay.example"],
                    "payload": "   "
                })),
            },
        );
        assert!(!result.ok);
        assert_eq!(result.error_code.as_deref(), Some("invalid_payload"));
    }

    #[test]
    fn transport_publish_relay_event_returns_protocol_network_assembly_when_lab_gate_enabled() {
        let _env_lock = transport_publish_network_env_lock();
        std::env::set_var("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK", "1");
        let db = Database::new(None).unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "transport".to_string(),
                method: "publishRelayEvent".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: Some(serde_json::json!({
                    "relayUrls": ["wss://relay.example", "wss://relay.two"],
                    "payload": "[\"EVENT\",{\"id\":\"abc\"}]",
                    "correlationId": "corr-w43"
                })),
            },
        );
        std::env::remove_var("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK");
        assert!(result.ok);
        let data = result.data.expect("network protocol publish result");
        assert_eq!(data["success"], false);
        assert_eq!(data["successCount"], 0);
        assert_eq!(data["totalRelays"], 2);
        assert_eq!(data["metQuorum"], false);
        assert_eq!(data["correlationId"], "corr-w43");
        let failures = data["failures"].as_array().expect("failures");
        assert_eq!(failures.len(), 2);
        assert_eq!(
            failures[0]["error"].as_str(),
            Some("No writable relay connection"),
        );
    }

    #[test]
    fn transport_publish_relay_event_returns_dry_run_assembly() {
        let _env_lock = transport_publish_network_env_lock();
        std::env::remove_var("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK");
        let db = Database::new(None).unwrap();
        let result = dispatch(
            &db,
            &EngineInvokeRequest {
                engine: "transport".to_string(),
                method: "publishRelayEvent".to_string(),
                scope: EngineScope {
                    profile_id: "p".to_string(),
                    window_label: None,
                },
                payload: Some(serde_json::json!({
                    "relayUrls": [" wss://relay.one ", "wss://relay.two", "wss://relay.one"],
                    "payload": "[\"EVENT\",{\"id\":\"abc\"}]",
                    "correlationId": "corr-w37"
                })),
            },
        );
        assert!(result.ok);
        let data = result.data.expect("dry-run publish result");
        assert_eq!(data["success"], false);
        assert_eq!(data["successCount"], 0);
        assert_eq!(data["totalRelays"], 2);
        assert_eq!(data["quorumRequired"], 1);
        assert_eq!(data["metQuorum"], false);
        assert_eq!(data["correlationId"], "corr-w37");
        let failures = data["failures"].as_array().expect("failures array");
        assert_eq!(failures.len(), 2);
        assert!(failures[0]["error"]
            .as_str()
            .unwrap_or("")
            .contains(TRANSPORT_PUBLISH_DRY_RUN_ERROR));
    }
}
