# R-RELAY-0 — Integration study (transport owners · public Nostr · dialects)

**Status:** Study Pass · 2026-07-30 — unlocks R-RELAY-1 design (still **no product code** until R-RELAY-1 design exists)  
**Charter:** [r-relay-transport-refactor-charter-2026-07.md](./r-relay-transport-refactor-charter-2026-07.md)  
**Fail capture:** [public-relay-connect-fail-investigation-2026-07.md](./public-relay-connect-fail-investigation-2026-07.md)  
**Concept:** [obscur-conduit-mesh-concept-2026-06.md](../../docs/program/obscur-conduit-mesh-concept-2026-06.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     R-RELAY-0 study → then R-RELAY-1 design (failover / pool)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER (target): relay-runtime-supervisor + resolveActivePoolRelayUrls + presets
PROOF THIS DOC:       Owner map + conflict scan + R-RELAY-1 hypothesis (evidence-backed)
OUT OF SCOPE:         Product diffs · greenfield conduit-mesh cutover in one PR
```

---

## 1. Owner map (current)

| Concern | Owner module | Notes |
|---------|--------------|--------|
| Preset packs (public / private / hybrid / Tor) | `transport-preset-catalog.ts` + apply policy | Nostr is one category among many |
| Transport mode basic vs redundancy | `relay-transport-mode.ts` | Default redundancy unless env/`localStorage` = basic |
| Primary / standby **roles** | `use-relay-primary-selection.ts` + `relay-primary-selector.ts` | Auto health reconcile **removed** from hook (render-depth) |
| **Which URLs get sockets** | `resolveActivePoolRelayUrls` → `poolRelayUrls` → `useRelayPool` | Comment on supervisor: pool often “primary only” in practice |
| Standby latency-only probes | `use-standby-latency-probe.ts` | Not full transport membership |
| Failover trigger | `relay-runtime-supervisor` → `shouldAttemptPrimaryFailover` → `attemptPrimaryFailover` in `relay-provider` | Single automatic owner (by design) |
| Native connect + soft toast | `native-relay.ts` + `native-error-store` + `ErrorPanel` | Soft UX landed; rebuild may still be needed on device |
| Transport snapshot / engine | `@obscur/transport-engine` + kernel recovery ports | Authority when `isTransportKernelAuthority` |
| Conduit mesh package | `@obscur/conduit-mesh` | Exists; UI harness `use-conduit-mesh-relay-pool` archived — **not** production owner yet |
| Legacy pool | `enhanced-relay-pool-legacy` / runtime | Still behind ports; subtract carefully |

---

## 2. Parallel paths (conflict scan)

```text
Settings URLs (DM transport)
        │
        ▼
effectiveDmTransportRelayUrls ──► primary selection (roles)
        │
        ▼
resolveActivePoolRelayUrls(mode, hints) ──► poolConnectionRelayUrls
        │
        ▼
useRelayPool(poolRelayUrls)  ◄── only these get live WS
        │
        ▼
supervisor(enabled=active pool, allEnabled=full list) ──► failover / recovery
```

| Conflict | Risk |
|----------|------|
| **Roles vs sockets** | Standby role ≠ “will connect.” UI says wait for failover while pool never opened standby sockets. |
| **score > 0 gate** | `resolveActivePoolRelayUrls` (redundancy) keeps only URLs with `scoreRelayUrl > 0`. Score is **0** when `!isOpen && !isWritable`. If primary still scores > 0 (stale/open hint) and others are cold, **pool collapses to primary-only** — matches screenshot shape. |
| **basic mode** | Pool = `[primary]` forever; standbys only probe. Preset `low_latency` sets `basic`. |
| **Failover threshold** | `shouldAttemptPrimaryFailover` needs `writableRelayCount === 0` (+ recovery reasons). If primary stays “ERROR” but writable accounting is wrong, failover never runs. |
| **Hook vs supervisor** | Re-adding auto-reconcile in `useRelayPrimarySelection` would revive render-depth — **forbidden**. |
| **Mesh vs pool** | Cutting over to `@obscur/conduit-mesh` before R-RELAY-1 Pass risks dual orchestrators — **R-RELAY-4 only**. |

**Working neighbors (must not regress):** soft `ErrorPanel` · transport-engine checkpoint IPC path · R3 publish tombstone · community PAUSED.

---

## 3. Dialect / alternative methods (preserve)

| Dialect / preset | Role |
|------------------|------|
| Public Nostr (`default_stable`, `high_redundancy`) | Convenience `nostr_ws` pool — charter goal: **usable** |
| `local_dev_mesh` (`:7000`) | Dev/soak when public WSS down |
| Private LAN / HTTP / hybrid / Tor packs | User-chosen alternatives — **must remain selectable** |
| Conduit mesh concept | Long-term one MeshPort; Nostr optional |

Obscur owns E2EE + evidence; user owns which conduits. Refactor must **not** make Nostr mandatory.

---

## 4. R-RELAY-1 hypothesis (for next design)

**Primary defect (subtract-first):** Active pool membership under redundancy excludes never-connected / zero-score standbys whenever any peer has score > 0 — so dead primary can remain sole socket while UI shows STANDBY “wait for failover.”

**Secondary:** Profile may be on `basic` mode (or basic preset) without user realizing.

**Tertiary:** Failover policy / writable count may not fire on `websocket_error` ACTIVE primary.

**Upstream:** damus/primal TLS/503 remain real; success criterion is promote-to-best-available (including local), not “make Cloudflare healthy.”

---

## 5. Mental simulation (R-RELAY-1 target)

1. User on redundancy + three public URLs.  
2. damus ERROR.  
3. Pool includes ≥1 other enabled URL (or failover promotes within N s).  
4. Publish readiness reflects evidence; Settings shows ACTIVE on a live member.  
5. User can Apply `local_dev_mesh` / private pack and leave Nostr entirely.

---

## 6. Proof plan (R-RELAY-1 — after design)

| Layer | Command / method |
|-------|------------------|
| L1 | Unit: `resolveActivePoolRelayUrls` with all-disconnected + one-error primary · failover policy · mode basic vs redundancy |
| L2 | Optional supervisor unit with mock pool |
| L3 | Parity/release: induce primary fail → standby or second pool member connects · or document public-all-down + `:7000` Pass |

---

## 7. Exit

| Gate | Result |
|------|--------|
| Owner map | Pass |
| Conflict scan | Pass |
| R-RELAY-1 hypothesis named | Pass |
| Product code | **Not started** |

**Next:** [R-RELAY-1 design](./r-relay-1-failover-pool-design-2026-07.md) (write next) → then smallest subtract impl.
