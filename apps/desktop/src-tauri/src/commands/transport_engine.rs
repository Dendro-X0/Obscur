//! Async transport publish invoke — injects desktop RelayPool evidence (W45).

use crate::commands::db::DbState;
use crate::protocol::{normalize_relay_urls, parse_event_payload};
use crate::relay::RelayPool;
use libobscur::engine_invoke::{
    assemble_transport_publish_relay_event_network_with_attempts, dispatch,
    is_transport_host_publish_network_enabled, EngineInvokeRequest, EngineInvokeResult,
};
use libobscur::protocol::types::RelayPublishAttempt;
use serde::Deserialize;
use std::time::{Duration, Instant};
use tauri::{State, WebviewWindow};

const DEFAULT_PUBLISH_ACK_TIMEOUT_MS: u64 = 12_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishRelayEventInvokePayload {
    relay_urls: Vec<String>,
    payload: String,
}

fn should_route_relay_pool_publish(request: &EngineInvokeRequest) -> bool {
    request.engine == "transport"
        && request.method == "publishRelayEvent"
        && is_transport_host_publish_network_enabled()
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
