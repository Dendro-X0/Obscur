# Investigation — Why Obscur does not use the public Nostr relay pool

**Status:** Investigation complete · 2026-07-31  
**Evidence:** Maintainer screenshot (Tester2 · Relays ALL) · Node WSS probe · prior R-RELAY / Wave A / E1 docs  
**Handoff context:** Hold after B→C→E1 · this doc answers “why public pool unused / why early versions worked”

---

## Session gate

```text
NEXT ATOMIC STEP:     Hold (B→C→E1 closed) — this is investigation only
PAUSED / CANCELLED:   COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNER:      resolveActivePoolRelayUrls + merge custom nodes + useConduitMeshRelayPool + NativeRelay
PROOF THIS DOC:       Screenshot map · probe · owner chain · historical delta
OUT OF SCOPE:         Product diffs · claiming public Nostr fixed · community un-pause
```

---

## 1. What the screenshot shows (Tester2)

| Endpoint | UI role | Socket | Meaning |
|----------|---------|--------|---------|
| `wss://relay.damus.io` | **Active transport** | DISCONNECTED | Sole basic-mode primary; no live socket |
| `wss://nos.lol` | Standby | DISCONNECTED | Copy: *not in the active transport pool* → **never dialed** |
| `ws://localhost:7000` | Standby | **CONNECTED** | Open via custom/community merge, **not** promoted to active/primary |
| Banner | — | — | *Relay transport is offline… sends are queued* → supervisor `writableRelayCount === 0` |

This is **not** “Nostr is impossible.” It is “membership + readiness owners are ignoring live standbys / local while clinging to a dead public primary.”

---

## 2. Fresh probe (same machine · 2026-07-31)

| URL | Result |
|-----|--------|
| `wss://relay.damus.io` | **ERR** `Unexpected server response: 503` |
| `wss://nos.lol` | **OPEN** |
| `wss://relay.primal.net` | **OPEN** |
| `ws://127.0.0.1:7000` | **OPEN** |

So: damus is **upstream/provider** failure (503). nos/primal and local are reachable from this host. An honest pool would dial nos (or local) and leave the offline banner.

---

## 3. Why early Obscur versions “just used Nostr”

Early product path was closer to a **classic Nostr client pool**:

1. **Browser `WebSocket` to every enabled `wss://` URL** (or a small fixed fallback list).
2. **Little or no basic/redundancy split** — multiple sockets were normal.
3. **Writable ≈ socket open** — readiness followed connection state, not a separate mesh “publishReady” score.
4. **Public defaults were the product identity** — damus/nos/primal were the intended WAN path.

That worked when public relays answered and when the UI dialed more than one URL.

---

## 4. Factors that prevent public-pool use now (stacked)

These compound. Fixing only one often looks like “still broken.”

### A. Upstream / path (not an app bug)

- `relay.damus.io` returns **503** on WSS from this network (probe above).
- Historical TLS flakes on the same host are documented in Wave A / public-connect investigations.
- **Cannot be fixed in Obscur.** Must demote/failover away from dead hosts.

### B. Active-pool membership (basic mode starves standbys)

Owner: `resolveActivePoolRelayUrls` (`relay-primary-selector.ts`).

- **basic:** dial set is **only the primary** unless Wave A finds another URL already `isOpen`/`isWritable` in hints.
- Screenshot copy on nos (“not in the active transport pool”) is exactly this mode.
- Cold standbys **never get sockets**, so failover never sees them open → chicken-and-egg (chartered as **E2** dial-pad; not shipped).
- **redundancy** (R-RELAY-1) pads up to 3 enabled URLs so nos would dial — but this profile’s UI behavior matches **basic** (single Active transport), and/or the list was never re-Applied after E1.

### C. Stale primary selection (damus remains ACTIVE)

- Role label **Active transport** comes from `selection.primaryUrl` / `role === "primary"`, not “which socket is open.”
- Damus stays primary while dead; nos stays Standby; local stays Standby even when CONNECTED.
- Auto health reconcile was **removed** from the primary-selection hook (render-depth / dual-owner history). Failover must go through `attemptPrimaryFailover` / mesh scheduler — easy to miss when `writableRelayCount` stays 0 for other reasons, or when `meshSchedulerOwnsFailover` disables the TS path.

### D. Dual connection truth (RUST-4c mesh cutover)

Owner: `useConduitMeshRelayPool` + `mapMeshSnapshotToRelayActivitySnapshot`.

| Signal | Source | Screenshot |
|--------|--------|------------|
| Card CONNECTED | Thin WS client `connections` (`conduit-mesh-nostr-ws-client`) | Local green |
| Banner offline / writable | Mesh activity `publishReadyCount` / `publishReadyRelayUrls` preferred for writability | Offline |

Local can show **CONNECTED** while supervisor readiness stays **offline** if mesh publish-ready for the DM scope is still 0, or if writable snapshot is scoped to the **active** (damus-only) set. Wave A L3-lite Pass on Tester1 proved local *can* count; Tester2 screenshot shows the dual-truth failure still possible when primary/active membership stays damus-centric.

### E. Native public dial path vs early browser WS

Owner: `createRelayWebSocket` → **NativeRelay** for non-local URLs on Tauri.

- Public `wss://` uses the Rust `connect_relay` path; localhost uses WebView `WebSocket`.
- Extra failure modes: native probe, Tor proxy left on, timeouts, 503 mapping to DISCONNECTED with soft toast.
- Early web-first builds dialed public relays with the same browser stack as local — fewer layers.

### F. Product boot / identity pivot (intentional)

- Product boot preset is **`local_dev_mesh`**, not public Nostr (RUST-2).
- Public packs are **best-effort clearnet**, not the default trust path.
- E1 only **reorders** catalog defaults (nos → primal → damus); it does **not** rewrite an already-stored Tester2 list or force redundancy on an old profile until the user **Applies** a pack.

### G. Exact-URL health hints

Owner: `buildRelayHealthHints` — `connections.find(entry => entry.url === url)` (string equality).

- `ws://localhost:7000` vs `ws://127.0.0.1:7000` mismatch → hint `isOpen=false` → Wave A promote does not fire even if a sibling URL is open.
- Screenshot shows `localhost:7000` consistently, but this remains a landmine for hybrid configs.

---

## 5. Causal chain for this screenshot

```text
Profile in basic mode (or effective single-primary dial)
  → active pool = [damus]
  → damus WSS 503 → DISCONNECTED
  → nos never dialed → STANDBY / “not in active pool”
  → localhost dialed via custom-node merge → CONNECTED but role STANDBY
  → writable/publishReady for readiness still 0 (active/mesh scope)
  → banner: transport offline · sends queued
```

**Early versions skipped most of this chain** by dialing multiple public WSS with browser sockets and treating open ≈ online.

---

## 6. Operator mitigations (no code)

1. Settings → transport packs → **Apply Default Stable** (or High Redundancy) so mode = **redundancy** and list prefers nos/primal (E1 order after rebuild).
2. Or manually set **primary** to `nos.lol` / reorder above damus → Retry.
3. Or disable damus; keep local for lab soak (not a public fix).
4. Confirm Tor is off for clearnet public packs.
5. Soft-reload / rebuild if the shell predates Wave A / E1 modules.

---

## 7. Engineering follow-ons (charter only)

| ID | Slice | Why |
|----|-------|-----|
| **E2** | Basic dial-pad: when primary not live, include next enabled URL in dial set | Fixes nos cold-start without requiring redundancy |
| **E2b** | Hint matching via `workspaceRelayUrlsMatch` | Fixes localhost/127 promote misses |
| **E3** | Writable honesty: open WS in pool URLs must count even if mesh publishReady lags | Fixes CONNECTED + offline banner dual truth |
| **Ops** | Re-apply public pack on Tester2 after rebuild | Profile storage, not code |

Do **not** claim “public Nostr fixed” until a **public-only** desktop L3 (no local) shows writable≥1 with nos/primal when probe OPEN.

---

## 8. Claim language

| May say | |
|---------|---|
| Investigated | Yes — membership + upstream 503 + mesh readiness dual-path |
| Why early worked | Multi-dial browser pool; open ≈ writable; public-first identity |
| Why now fails here | Dead primary + basic starve + stale primary role + dual readiness |
| Fixed / Verified | **No** |

---

## References

- [public-relay-connect-fail-investigation-2026-07.md](./public-relay-connect-fail-investigation-2026-07.md)
- [public-nostr-relay-pool-module-investigation-2026-07.md](./public-nostr-relay-pool-module-investigation-2026-07.md)
- [public-nostr-relay-pool-module-design-2026-07.md](./public-nostr-relay-pool-module-design-2026-07.md) (E1 Done · E2 pending)
- [relay-transport-offline-local-connected-design-2026-07.md](./relay-transport-offline-local-connected-design-2026-07.md) (Wave A)
- [r-relay-1-failover-pool-design-2026-07.md](./r-relay-1-failover-pool-design-2026-07.md)
