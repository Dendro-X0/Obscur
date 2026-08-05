# L3 Tauri UI mesh soak

**Status:** **PASS** · 2026-07-30T15:41:09.160Z  
**CDP:** `http://127.0.0.1:9230` · profile `default` · relay `ws://127.0.0.1:7000`

| Check | Result |
|-------|--------|
| unlock_or_shell | Pass — shell |
| configureMeshConduits | Pass — ownsFailover=true dataKeys=ok,revision,acceptedConduitIds,skipped,activeConduitIds,activeEndpointUrls,torBlockedConduitIds,meshSchedulerOwnsFailover,connectAttempts,snapshot |
| getMeshSnapshot | Pass — phase=healthy writable=1 |
| publishMeshEnvelope | Pass — invokeOk=true accepted=true successCount=1 err= |
| damus_escape_rejected | Pass — accepted=false err=relay_url_not_in_mesh_active_set:wss://relay.damus.io |

JSON: [`r-relay-rust-l3-tauri-ui-soak-2026-07-30.json`](./r-relay-rust-l3-tauri-ui-soak-2026-07-30.json)
