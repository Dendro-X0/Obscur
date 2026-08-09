//! Async transport invoke — RelayPool publish (W45) + mesh configure (RUST-1b).

use crate::commands::db::DbState;
use crate::data_root::workspace_exports_dir;
use crate::mesh::descriptor::ConduitDescriptor;
use crate::mesh::dialect::nostr_ws::NostrWsDialect;
use crate::mesh::dialect::DialectPublishRequest;
use crate::mesh::offline::{
    export_offline_pack, import_offline_pack, persist_imported_to_dm, resolve_export_path,
    ExportOfflinePackPayload, ImportOfflinePackPayload,
};
use crate::mesh::publish::{
    build_publish_outcome, BuildPublishOutcomeParams, MeshPublishOutcome,
};
use crate::mesh::runtime::{MeshConfigureOutcome, MeshConnectAttempt, MeshRuntimeState};
use crate::mesh::snapshot::MeshSnapshotJson;
use crate::mesh::tor_policy::MeshTorRuntimeState;
use crate::net::NativeNetworkRuntime;
use crate::protocol::{normalize_relay_urls, parse_event_payload};
use crate::commands::tor_gateway_client;
use crate::models::tor::TorState;
use crate::relay::{connect_relay_internal, RelayPool};
use libobscur::engine_invoke::{
    assemble_transport_publish_relay_event_network_with_attempts, dispatch,
    is_transport_host_publish_network_enabled, EngineInvokeRequest, EngineInvokeResult,
};
use libobscur::protocol::types::RelayPublishAttempt;
use serde::Deserialize;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State, WebviewWindow};

const DEFAULT_PUBLISH_ACK_TIMEOUT_MS: u64 = 12_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishRelayEventInvokePayload {
    relay_urls: Vec<String>,
    payload: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishMeshEnvelopePayload {
    /// Opaque envelope id for evidence correlation.
    envelope_id: String,
    /// Nostr event JSON (or EVENT frame) — 1d nostr_ws bridge.
    #[serde(alias = "payload", alias = "nostrEventJson")]
    event_payload: String,
    #[serde(default)]
    relay_urls: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigureMeshConduitsPayload {
    #[serde(default)]
    conduits: Vec<ConduitDescriptor>,
    #[serde(default)]
    max_redundancy: Option<usize>,
    #[serde(default)]
    tor_ready: Option<bool>,
    #[serde(default)]
    tor_configured: Option<bool>,
    /// When false, only register+schedule (unit-friendly). Default true on desktop.
    #[serde(default = "default_true")]
    connect: bool,
}

fn default_true() -> bool {
    true
}

fn should_route_relay_pool_publish(request: &EngineInvokeRequest) -> bool {
    request.engine == "transport"
        && request.method == "publishRelayEvent"
        && is_transport_host_publish_network_enabled()
}

fn should_route_configure_mesh(request: &EngineInvokeRequest) -> bool {
    request.engine == "transport" && request.method == "configureMeshConduits"
}

fn should_route_get_mesh_snapshot(request: &EngineInvokeRequest) -> bool {
    request.engine == "transport" && request.method == "getMeshSnapshot"
}

fn should_route_publish_mesh_envelope(request: &EngineInvokeRequest) -> bool {
    request.engine == "transport" && request.method == "publishMeshEnvelope"
}

fn should_route_export_offline_pack(request: &EngineInvokeRequest) -> bool {
    request.engine == "transport" && request.method == "exportOfflinePack"
}

fn should_route_import_offline_pack(request: &EngineInvokeRequest) -> bool {
    request.engine == "transport" && request.method == "importOfflinePack"
}

fn emit_mesh_snapshot_changed(
    window: &WebviewWindow,
    profile_id: &str,
    snapshot: &MeshSnapshotJson,
) {
    let _ = window.emit(
        "mesh-snapshot-changed",
        serde_json::json!({
            "profileId": profile_id,
            "revision": snapshot.revision,
            "snapshot": snapshot,
            "meshSchedulerOwnsFailover": snapshot.mesh_scheduler_owns_failover,
        }),
    );
}

fn assemble_ok(data: impl serde::Serialize) -> EngineInvokeResult {
    match serde_json::to_value(data) {
        Ok(value) => EngineInvokeResult {
            ok: true,
            data: Some(value),
            error_code: None,
            error_message: None,
        },
        Err(e) => EngineInvokeResult {
            ok: false,
            data: None,
            error_code: Some("serialize_error".into()),
            error_message: Some(e.to_string()),
        },
    }
}

fn assemble_err(code: &str, message: impl Into<String>) -> EngineInvokeResult {
    EngineInvokeResult {
        ok: false,
        data: None,
        error_code: Some(code.to_string()),
        error_message: Some(message.into()),
    }
}

#[tauri::command]
pub async fn engine_invoke_transport_publish_relay_event(
    window: WebviewWindow,
    db_state: State<'_, DbState>,
    relay_pool: State<'_, RelayPool>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    if !should_route_relay_pool_publish(&request) {
        return db_state.with_db(|db| Ok(dispatch(db, &request)));
    }

    let payload_value = match request.payload.clone() {
        Some(value) => value,
        None => return db_state.with_db(|db| Ok(dispatch(db, &request))),
    };

    let invoke_payload: PublishRelayEventInvokePayload =
        match serde_json::from_value(payload_value.clone()) {
            Ok(parsed) => parsed,
            Err(_) => {
                return Ok(assemble_transport_publish_relay_event_network_with_attempts(
                    Some(payload_value),
                    &[],
                    0,
                ));
            }
        };

    let event = match parse_event_payload(&invoke_payload.payload) {
        Ok(event) => event,
        Err(_) => {
            return Ok(assemble_transport_publish_relay_event_network_with_attempts(
                Some(payload_value),
                &[],
                0,
            ));
        }
    };

    let relay_urls = normalize_relay_urls(&invoke_payload.relay_urls);
    if relay_urls.is_empty() {
        return Ok(assemble_transport_publish_relay_event_network_with_attempts(
            Some(payload_value),
            &[],
            0,
        ));
    }

    let started = Instant::now();
    let mut attempts = Vec::<RelayPublishAttempt>::with_capacity(relay_urls.len());
    let window_label = window.label().to_string();

    for relay_url in &relay_urls {
        match relay_pool
            .publish_event_with_ack(
                &window_label,
                relay_url,
                event.clone(),
                Duration::from_millis(DEFAULT_PUBLISH_ACK_TIMEOUT_MS),
            )
            .await
        {
            Ok(_) => attempts.push(RelayPublishAttempt {
                relay_url: relay_url.clone(),
                success: true,
                error: None,
            }),
            Err(error) => attempts.push(RelayPublishAttempt {
                relay_url: relay_url.clone(),
                success: false,
                error: Some(error),
            }),
        }
    }

    let elapsed_ms = started.elapsed().as_millis() as u64;
    Ok(assemble_transport_publish_relay_event_network_with_attempts(
        Some(payload_value),
        &attempts,
        elapsed_ms,
    ))
}

/// R-RELAY-RUST-1b — register descriptors, schedule active set, optionally dial via RelayPool.
#[tauri::command]
pub async fn engine_invoke_transport_configure_mesh_conduits(
    app: AppHandle,
    window: WebviewWindow,
    db_state: State<'_, DbState>,
    mesh: State<'_, MeshRuntimeState>,
    relay_pool: State<'_, RelayPool>,
    net_runtime: State<'_, NativeNetworkRuntime>,
    tor_state: State<'_, TorState>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    if !should_route_configure_mesh(&request) {
        return db_state.with_db(|db| Ok(dispatch(db, &request)));
    }

    let payload_value = match request.payload.clone() {
        Some(value) => value,
        None => {
            return Ok(assemble_err(
                "invalid_payload",
                "configureMeshConduits requires payload",
            ));
        }
    };

    let parsed: ConfigureMeshConduitsPayload = match serde_json::from_value(payload_value) {
        Ok(value) => value,
        Err(error) => {
            return Ok(assemble_err(
                "invalid_payload",
                format!("invalid configureMeshConduits payload: {error}"),
            ));
        }
    };

    let profile_id = request.scope.profile_id.trim();
    if profile_id.is_empty() {
        return Ok(assemble_err(
            "invalid_scope",
            "scope.profileId is required",
        ));
    }

    let tor_preference = tor_state
        .settings
        .lock()
        .map(|s| s.enable_tor)
        .unwrap_or(false);
    // R4/4b: "ready" = gateway bootstrap, not UI SOCKS arm (`net_runtime` stays false).
    let tor_lifecycle_ready = if tor_preference {
        tor_gateway_client::status()
            .await
            .map(|gw| gw.bootstrap_ready)
            .unwrap_or(false)
    } else {
        false
    };
    let tor = MeshTorRuntimeState {
        configured: parsed.tor_configured.unwrap_or(tor_preference),
        ready: parsed.tor_ready.unwrap_or(tor_lifecycle_ready),
    };

    let mut outcome: MeshConfigureOutcome = mesh.configure_and_select(
        profile_id,
        parsed.conduits,
        tor,
        parsed.max_redundancy,
    );

    if parsed.connect && !outcome.active_endpoint_urls.is_empty() {
        let window_label = window.label().to_string();
        let mut attempts = Vec::with_capacity(outcome.active_endpoint_urls.len());
        for url in &outcome.active_endpoint_urls {
            match connect_relay_internal(
                app.clone(),
                window_label.clone(),
                url.clone(),
                relay_pool.clone(),
                net_runtime.clone(),
                tor_state.clone(),
            )
            .await
            {
                Ok(_) => attempts.push(MeshConnectAttempt {
                    endpoint_url: url.clone(),
                    success: true,
                    error: None,
                }),
                Err(error) => attempts.push(MeshConnectAttempt {
                    endpoint_url: url.clone(),
                    success: false,
                    error: Some(error),
                }),
            }
        }
        outcome.connect_attempts = attempts;
        mesh.apply_connect_attempts(profile_id, &outcome.connect_attempts);
        let snapshot = mesh.get_snapshot(profile_id);
        emit_mesh_snapshot_changed(&window, profile_id, &snapshot);
        outcome.snapshot = Some(snapshot);
    } else if let Some(ref snapshot) = outcome.snapshot {
        emit_mesh_snapshot_changed(&window, profile_id, snapshot);
    }

    Ok(assemble_ok(outcome))
}

/// R-RELAY-RUST-1c — read current mesh snapshot for a profile.
#[tauri::command]
pub async fn engine_invoke_transport_get_mesh_snapshot(
    window: WebviewWindow,
    db_state: State<'_, DbState>,
    mesh: State<'_, MeshRuntimeState>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    if !should_route_get_mesh_snapshot(&request) {
        return db_state.with_db(|db| Ok(dispatch(db, &request)));
    }

    let profile_id = request.scope.profile_id.trim();
    if profile_id.is_empty() {
        return Ok(assemble_err(
            "invalid_scope",
            "scope.profileId is required",
        ));
    }

    let snapshot = mesh.get_snapshot(profile_id);
    emit_mesh_snapshot_changed(&window, profile_id, &snapshot);
    Ok(assemble_ok(snapshot))
}

/// R-RELAY-RUST-1d/3 — publish via `nostr_ws` dialect to mesh-active endpoints only
/// (prefer private trust; no public escape outside active set).
#[tauri::command]
pub async fn engine_invoke_transport_publish_mesh_envelope(
    window: WebviewWindow,
    db_state: State<'_, DbState>,
    mesh: State<'_, MeshRuntimeState>,
    relay_pool: State<'_, RelayPool>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    if !should_route_publish_mesh_envelope(&request) {
        return db_state.with_db(|db| Ok(dispatch(db, &request)));
    }

    let profile_id = request.scope.profile_id.trim();
    if profile_id.is_empty() {
        return Ok(assemble_err(
            "invalid_scope",
            "scope.profileId is required",
        ));
    }

    let payload_value = match request.payload.clone() {
        Some(value) => value,
        None => {
            return Ok(assemble_err(
                "invalid_payload",
                "publishMeshEnvelope requires payload",
            ));
        }
    };

    let parsed: PublishMeshEnvelopePayload = match serde_json::from_value(payload_value) {
        Ok(value) => value,
        Err(error) => {
            return Ok(assemble_err(
                "invalid_payload",
                format!("invalid publishMeshEnvelope payload: {error}"),
            ));
        }
    };

    if parsed.envelope_id.trim().is_empty() {
        return Ok(assemble_err(
            "invalid_payload",
            "envelopeId is required",
        ));
    }

    let event = match parse_event_payload(&parsed.event_payload) {
        Ok(event) => event,
        Err(error) => {
            return Ok(assemble_err("invalid_payload", error));
        }
    };

    // RUST-3: nostr_ws dialect orders private trust before public_untrusted;
    // still rejects URLs outside the mesh-active set (no public escape).
    let dialect = NostrWsDialect::new();
    let mesh_urls = mesh.active_endpoint_urls(profile_id);
    let entries = mesh.registry_entries(profile_id);
    let targets = match NostrWsDialect::order_publish_urls(
        &mesh_urls,
        &entries,
        parsed.relay_urls.as_deref(),
    ) {
        Ok(urls) => urls,
        Err(error) => {
            let outcome = MeshPublishOutcome {
                envelope_id: parsed.envelope_id.clone(),
                accepted: false,
                evidence: vec![],
                error_message: Some(error.clone()),
                relay_urls_attempted: vec![],
                success_count: 0,
            };
            return Ok(assemble_ok(outcome));
        }
    };

    let window_label = window.label().to_string();
    let dialect_result = dialect
        .publish_via_pool(
            &relay_pool,
            &window_label,
            DialectPublishRequest {
                envelope_id: parsed.envelope_id.trim().to_string(),
                event,
                relay_urls: targets,
            },
            Duration::from_millis(DEFAULT_PUBLISH_ACK_TIMEOUT_MS),
        )
        .await;

    let attempts: Vec<(String, bool, Option<String>)> = dialect_result
        .attempts
        .into_iter()
        .map(|a| (a.relay_url, a.success, a.error))
        .collect();

    let at_unix_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let outcome = build_publish_outcome(BuildPublishOutcomeParams {
        envelope_id: parsed.envelope_id.trim(),
        at_unix_ms,
        attempts: &attempts,
    });

    let snapshot = mesh.get_snapshot(profile_id);
    emit_mesh_snapshot_changed(&window, profile_id, &snapshot);

    Ok(assemble_ok(outcome))
}

/// R-RELAY-RUST-6b — write offline pack file (ciphertext envelopes + MAC).
#[tauri::command]
pub async fn engine_invoke_transport_export_offline_pack(
    app: AppHandle,
    db_state: State<'_, DbState>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    if !should_route_export_offline_pack(&request) {
        return db_state.with_db(|db| Ok(dispatch(db, &request)));
    }

    let profile_id = request.scope.profile_id.trim();
    if profile_id.is_empty() {
        return Ok(assemble_err(
            "invalid_scope",
            "scope.profileId is required",
        ));
    }

    let payload_value = match request.payload.clone() {
        Some(value) => value,
        None => {
            return Ok(assemble_err(
                "invalid_payload",
                "exportOfflinePack requires payload",
            ));
        }
    };

    let parsed: ExportOfflinePackPayload = match serde_json::from_value(payload_value) {
        Ok(value) => value,
        Err(error) => {
            return Ok(assemble_err(
                "invalid_payload",
                format!("invalid exportOfflinePack payload: {error}"),
            ));
        }
    };

    let outcome = export_offline_pack(profile_id, parsed, |payload| {
        let exports = workspace_exports_dir(&app).ok();
        resolve_export_path(
            payload.file_path.as_deref(),
            payload.file_name.as_deref(),
            exports.as_deref(),
        )
    });
    Ok(assemble_ok(outcome))
}

/// R-RELAY-RUST-6b — read + verify offline pack; evidence imported / rejected.
#[tauri::command]
pub async fn engine_invoke_transport_import_offline_pack(
    db_state: State<'_, DbState>,
    request: EngineInvokeRequest,
) -> Result<EngineInvokeResult, String> {
    if !should_route_import_offline_pack(&request) {
        return db_state.with_db(|db| Ok(dispatch(db, &request)));
    }

    let profile_id = request.scope.profile_id.trim();
    if profile_id.is_empty() {
        return Ok(assemble_err(
            "invalid_scope",
            "scope.profileId is required",
        ));
    }

    let payload_value = match request.payload.clone() {
        Some(value) => value,
        None => {
            return Ok(assemble_err(
                "invalid_payload",
                "importOfflinePack requires payload",
            ));
        }
    };

    let parsed: ImportOfflinePackPayload = match serde_json::from_value(payload_value) {
        Ok(value) => value,
        Err(error) => {
            return Ok(assemble_err(
                "invalid_payload",
                format!("invalid importOfflinePack payload: {error}"),
            ));
        }
    };

    let persist_to_dm = parsed.persist_to_dm;
    let mut outcome = import_offline_pack(profile_id, parsed);
    if outcome.ok && persist_to_dm {
        match db_state.with_db(|db| persist_imported_to_dm(db, profile_id, &outcome.envelopes)) {
            Ok(count) => {
                outcome.persisted_count = Some(count as u32);
            }
            Err(error) => {
                return Ok(assemble_err(
                    "persist_failed",
                    format!("import verified but dm persist failed: {error}"),
                ));
            }
        }
    }
    Ok(assemble_ok(outcome))
}
