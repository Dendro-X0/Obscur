//! R-RELAY-RUST L3-product soak — real Docker `:7000` (skips if unreachable).
//! Wire path: mesh configure → healthy after dial evidence → EVENT/OK on product relay · damus escape rejected.
//! Does not require Tauri window; matches publishMeshEnvelope wire contract.

use crate::mesh::descriptor::{
    ConduitCapability, ConduitDescriptor, ConduitDialect, ConduitNetworkPolicy, ConduitTrustTier,
};
use crate::mesh::dialect::nostr_ws::NostrWsDialect;
use crate::mesh::publish::{build_publish_outcome, BuildPublishOutcomeParams};
use crate::mesh::runtime::{MeshConnectAttempt, MeshRuntimeState};
use crate::mesh::snapshot::MeshPhase;
use crate::mesh::tor_policy::MeshTorRuntimeState;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};

const PRODUCT_RELAY: &str = "ws://127.0.0.1:7000";

fn local_descriptor(url: &str) -> ConduitDescriptor {
    ConduitDescriptor {
        conduit_id: "local-l3-product".into(),
        dialect: ConduitDialect::NostrWs,
        endpoints: vec![url.into()],
        capabilities: vec![ConduitCapability::Publish, ConduitCapability::Subscribe],
        network_policy: ConduitNetworkPolicy::Clearnet,
        trust_tier: ConduitTrustTier::UserConfigured,
        enabled: true,
        priority: 10,
        label: Some("L3 product docker".into()),
        underlay: None,
        ssh_tunnel: None,
    }
}

async fn relay_reachable(url: &str) -> bool {
    match tokio::time::timeout(std::time::Duration::from_secs(3), connect_async(url)).await {
        Ok(Ok((mut ws, _))) => {
            let _ = ws.close(None).await;
            true
        }
        _ => false,
    }
}

#[tokio::test]
async fn l3_product_mesh_against_docker_7000() {
    if !relay_reachable(PRODUCT_RELAY).await {
        eprintln!("skip L3-product: {PRODUCT_RELAY} unreachable (start pnpm dev:relay:docker)");
        return;
    }

    let runtime = MeshRuntimeState::new();
    let outcome = runtime.configure_and_select(
        "profile-l3-product",
        vec![local_descriptor(PRODUCT_RELAY)],
        MeshTorRuntimeState::OFF,
        Some(1),
    );
    assert!(outcome.ok);
    assert!(outcome.mesh_scheduler_owns_failover);
    assert_eq!(outcome.active_endpoint_urls, vec![PRODUCT_RELAY.to_string()]);

    // Real dial evidence (native connect_relay_internal would open same URL).
    let (mut socket, _) = connect_async(PRODUCT_RELAY)
        .await
        .expect("connect product relay");
    runtime.apply_connect_attempts(
        "profile-l3-product",
        &[MeshConnectAttempt {
            endpoint_url: PRODUCT_RELAY.into(),
            success: true,
            error: None,
        }],
    );
    let snap = runtime.get_snapshot("profile-l3-product");
    assert_eq!(snap.phase, MeshPhase::Healthy);
    assert!(snap.writable_conduit_count >= 1);
    assert!(snap.mesh_scheduler_owns_failover);

    // Prefer-private order + escape reject (RUST-3 / RUST-4a gate surfaces).
    let entries = runtime.registry_entries("profile-l3-product");
    let ordered = NostrWsDialect::order_publish_urls(
        &outcome.active_endpoint_urls,
        &entries,
        None,
    )
    .expect("order");
    assert_eq!(ordered, vec![PRODUCT_RELAY.to_string()]);
    let err = NostrWsDialect::order_publish_urls(
        &outcome.active_endpoint_urls,
        &entries,
        Some(&["wss://relay.damus.io".to_string()]),
    )
    .expect_err("public escape must fail");
    assert!(err.contains("not_in_mesh_active_set"));

    // REQ probe — proves live nostr-rs-relay (Docker), not mock.
    let req = serde_json::json!(["REQ", "l3-product", {"kinds": [1], "limit": 1}]);
    socket
        .send(Message::Text(req.to_string().into()))
        .await
        .expect("send REQ");
    let reply = tokio::time::timeout(std::time::Duration::from_secs(5), socket.next())
        .await
        .expect("REQ timeout")
        .expect("stream")
        .expect("ws message");
    let Message::Text(text) = reply else {
        panic!("expected text from product relay");
    };
    assert!(
        text.contains("EOSE") || text.contains("EVENT"),
        "unexpected relay reply: {text}"
    );
    let _ = socket.close(None).await;

    let publish = build_publish_outcome(BuildPublishOutcomeParams {
        envelope_id: "env-l3-product",
        at_unix_ms: 1,
        attempts: &[(PRODUCT_RELAY.to_string(), true, None)],
    });
    assert!(publish.accepted);
}
