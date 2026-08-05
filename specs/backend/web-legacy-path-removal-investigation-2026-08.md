# Investigation — Web-legacy path removal (Tauri-only production)

**Date (UTC):** 2026-08-04  
**Maintainer direction:** Web is **dev harness only**; production = Tauri; old web DB/paths conflict with SQLite — remove old patterns.  
**Handoff prior:** Maintainer choose W64 vs residual · pool dual-path taxonomy already Closed

---

## Session header

```text
NEXT ATOMIC STEP:     Web-legacy path removal (browser-pool EVENT subtract)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      transport-kernel standalone publish · useConduitMeshRelayPool (DM)
PROOF BEFORE DONE:    Design · flip legacy gate · L1 · Soft L3 optional
OUT OF SCOPE:         W66 mechanical file deletion (breaks invites → blocked) · groups/** · AUTH-SESSION
```

---

## Facts

| Surface | Policy |
|---------|--------|
| Production web | Disabled (`NativeRuntimeGate`) |
| Tauri desktop/mobile | SQLite authority ([obscur-native-sqlite-policy.md](../../docs/program/obscur-native-sqlite-policy.md)) |
| Browser localhost | Dev harness only |

### Dual paths still live

| Path | Role today | Conflict |
|------|------------|----------|
| `shouldUseLegacyStandaloneRelayPublish = !hasNativeRuntime()` | Web still EVENT-publishes via **browser-pool** sockets | Second transport + old ephemeral state vs mesh/SQLite world |
| `relay-browser-pool-runtime` standalone exports | Backing that web path | Same |
| W64/W66 thin port → blocked | Deletes kernel legacy; native standalone → **fail-closed** | Would break `invite-manager` `publishToUrlsStandalone` on Tauri |
| IndexedDB / chat-state | Already non-authority on native | Keep as web harness; do not revive on native |

### Soft L3 / DM

Uses `pool.publishToUrls` (conduit mesh) — **not** browser-pool standalone. Gate flip does not change Soft L3 owner.

---

## Verdict

1. **This slice:** retire browser-pool as EVENT publish owner — `shouldUseLegacyStandaloneRelayPublish → always false`. All standalone callers (incl. invites) use transport-kernel path.  
2. **Not this slice:** W66 physical deletion / thin-port fail-closed until invites are retargeted to mesh pool.  
3. Production web stays disabled; localhost may still run for harness UI but must not open a second EVENT owner.

---

## Status

**Complete** → design
