//! R-RELAY-RUST-1d L3 lab soak — in-process Nostr WS mock (no Docker / no damus).
//! Proves: mesh configure → healthy snapshot → EVENT+OK publish · public URL escape rejected.

use crate::mesh::descriptor::{
    ConduitCapability, ConduitDescriptor, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
};
use crate::mesh::publish::{
    build_publish_outcome, resolve_mesh_publish_urls, BuildPublishOutcomeParams,
};
use crate::mesh::runtime::{MeshConnectAttempt, MeshRuntimeState};
use crate::mesh::snapshot::MeshPhase;
use crate::mesh::tor_policy::MeshTorRuntimeState;
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, connect_async, tungstenite::Message};

async fn spawn_nostr_ok_mock() -> (String, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock relay");
    let addr = listener.local_addr().expect("local addr");
    let url = format!("ws://{addr}");

    let handle = tokio::spawn(async move {
        let Ok((stream, _)) = listener.accept().await else {
            return;
        };
        let Ok(mut ws) = accept_async(stream).await else {
            return;
        };
        while let Some(Ok(msg)) = ws.next().await {
            let Message::Text(text) = msg else {
                continue;
            };
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else {
                continue;
            };
            let Some(arr) = value.as_array() else {
                continue;
            };
            if arr.first().and_then(|v| v.as_str()) != Some("EVENT") {
                continue;
            }
            let event_id = arr
                .get(1)
                .and_then(|e| e.get("id"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let ok = serde_json::json!(["OK", event_id, true, ""]);
            let _ = ws.send(Message::Text(ok.to_string().into())).await;
        }
    });

    (url, handle)
}

fn local_descriptor(url: &str) -> ConduitDescriptor {
    ConduitDescriptor {
        conduit_id: "local-l3".into(),
        dialect: ConduitDialect::NostrWs,
        endpoints: vec![url.into()],
        capabilities: vec![ConduitCapability::Publish, ConduitCapability::Subscribe],
        network_policy: ConduitNetworkPolicy::Clearnet,
        trust_tier: ConduitTrustTier::UserConfigured,
        enabled: true,
        priority: 10,
        label: Some("L3 local mock".into()),
        underlay: None,
        ssh_tunnel: None,
    }
}

#[tokio::test]
async fn l3_lab_mesh_configure_snapshot_publish_without_public_nostr() {
    let (url, mock) = spawn_nostr_ok_mock().await;

    // 1) Configure mesh — local only
    let runtime = MeshRuntimeState::new();
    let outcome = runtime.configure_and_select(
        "profile-l3",
        vec![local_descriptor(&url)],
        MeshTorRuntimeState::OFF,
        Some(1),
    );
    assert!(outcome.ok);
    assert!(outcome.mesh_scheduler_owns_failover);
    assert_eq!(outcome.active_endpoint_urls, vec![url.clone()]);

    // 2) Simulate successful dial (native connect would open same URL)
    runtime.apply_connect_attempts(
        "profile-l3",
        &[MeshConnectAttempt {
            endpoint_url: url.clone(),
            success: true,
            error: None,
        }],
    );
    let snap = runtime.get_snapshot("profile-l3");
    assert_eq!(snap.phase, MeshPhase::Healthy);
    assert!(snap.writable_conduit_count >= 1);
    assert!(snap.mesh_scheduler_owns_failover);
    assert!(!snap
        .enabled_endpoint_urls
        .iter()
        .any(|u| u.contains("damus") || u.contains("primal")));

    // 3) Wire publish EVENT → OK (same contract as publishMeshEnvelope / RelayPool ACK)
    let (mut socket, _) = connect_async(&url).await.expect("connect mock relay");
    let event_id = "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";
    let event = serde_json::json!({
        "id": event_id,
        "pubkey": "11".repeat(32),
        "created_at": 1_700_000_000,
        "kind": 4,
        "tags": [],
        "content": "l3-mesh-soak",
        "sig": "22".repeat(64),
    });
    let frame = serde_json::json!(["EVENT", event]);
    socket
        .send(Message::Text(frame.to_string().into()))
        .await
        .expect("send EVENT");

    let reply = tokio::time::timeout(std::time::Duration::from_secs(2), socket.next())
        .await
        .expect("OK timeout")
        .expect("stream")
        .expect("ws message");
    let Message::Text(text) = reply else {
        panic!("expected text OK");
    };
    let ok_frame: serde_json::Value = serde_json::from_str(&text).expect("ok json");
    assert_eq!(ok_frame[0], "OK");
    assert_eq!(ok_frame[1], event_id);
    assert_eq!(ok_frame[2], true);

    let publish = build_publish_outcome(BuildPublishOutcomeParams {
        envelope_id: "env-l3-1",
        at_unix_ms: 1,
        attempts: &[(url.clone(), true, None)],
    });
    assert!(publish.accepted);
    assert!(publish
        .evidence
        .iter()
        .any(|e| e.kind == "evidence_class_satisfied"));

    // 4) Negative — cannot escape to public Nostr outside mesh set
    let err = resolve_mesh_publish_urls(
        &outcome.active_endpoint_urls,
        Some(&["wss://relay.damus.io".to_string()]),
    )
    .expect_err("public escape must fail");
    assert!(err.contains("not_in_mesh_active_set"));

    mock.abort();
}
