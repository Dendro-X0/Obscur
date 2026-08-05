# Relay pool modes — D0 UX copy map

**Date (UTC):** 2026-08-04  
**Slice:** D0 (doc review) — **Pass**  
**Parent:** [relay-pool-auto-correction-modes-design-2026-08.md](./relay-pool-auto-correction-modes-design-2026-08.md)  
**Impl slice:** D1 **Pass** (EN i18n + L1 contract) · next D2

---

```text
NEXT ATOMIC STEP:     D0 UX copy map (then D1 Settings labels)
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      transport-preset-catalog · relays settings i18n (D1)
PROOF BEFORE DONE:    Doc review — this map accepted; D1 = L1 preset + settings contracts
OUT OF SCOPE:         D1 code · Soft L3 Docker · public Nostr SLA
```

---

## Enum ↔ product language

| Wire / code | Product UX | Default when |
|-------------|------------|--------------|
| `RelayTransportMode = "basic"` | **Single-node (auto-correct)** | Low Latency preset; toggle off |
| `RelayTransportMode = "redundancy"` | **Multi-node** | Cold boot Default Stable; High Redundancy; toggle on |
| `PRODUCT_BOOT_TRANSPORT_PRESET` | Default Stable public pool | Fresh / reset profiles |

Do **not** rename the wire enum in D1 — only user-facing strings and toggle framing.

---

## Current EN (today) → target EN (D1)

### Mode toggle (Settings Relays)

| Key | Current EN | Target EN (D1) |
|-----|------------|----------------|
| `settings.relays.redundancyModeTitle` | Redundancy pool | Multi-node pool |
| `settings.relays.redundancyModeDesc` | Connect up to three enabled relays in the active pool. Basic mode uses one primary relay only. | **On (Multi-node):** stay connected to multiple enabled relays and publish with redundancy. **Off (Single-node):** use one primary; auto-switch to another healthy enabled relay if it becomes unstable. |
| `settings.relays.redundancyModeLabel` | Use redundancy pool | Multi-node (simultaneous) |

Optional new keys (D1 may add; prefer reuse if panel layout stays a single toggle):

| Key | Target EN |
|-----|-----------|
| `settings.relays.mode.singleTitle` | Single-node (auto-correct) |
| `settings.relays.mode.singleDesc` | One primary relay for publish. If it becomes unstable, Obscur switches to another healthy relay from your enabled list. |
| `settings.relays.mode.multiTitle` | Multi-node |
| `settings.relays.mode.multiDesc` | Connect to multiple relays at once. Publish uses the pool; the status badge shows how many are publish-ready. |

### Public default pool (boot)

| Key | Current EN | Target EN (D1) — honesty |
|-----|------------|---------------------------|
| `settings.relays.presetGroup.publicNostr` | Public Nostr adapters | Public Nostr relays *(keep or minor)* |
| `settings.relays.presetGroup.publicNostrDesc` | Optional open relays for DM transport — convenient, not required. | **Default ship pool** for cold/reset profiles (Default Stable). Convenient clearnet relays — not an uptime SLA; degraded when only some are publish-ready. |
| `settings.relays.preset.defaultStableDesc` | Three public Nostr relays in a redundancy pool — failover when one endpoint fails. | Three public Nostr relays in **Multi-node** mode — the product default pool (`nos.lol`, `relay.primal.net`, `relay.damus.io`). |
| `settings.relays.preset.highRedundancyDesc` | Five public relays with redundancy pool — more failover coverage. | Five public relays in **Multi-node** — wider simultaneous coverage. |
| `settings.relays.preset.lowLatencyDesc` | Latency-biased public relay order — single primary in basic mode. | Latency-biased public order in **Single-node (auto-correct)** — one primary with automatic switch on instability. |

### Status chips (keep behavior; align wording if needed)

| Key | Role | D1 note |
|-----|------|---------|
| `settings.relays.statusPrimary` | Healthy | OK as-is or “Healthy” |
| `settings.relays.statusSwitching` | Recovering / failover in flight | Keep — matches Single-node auto-correct |
| `settings.relays.statusDegraded` | Partial pool | Keep — Multi-node honesty |
| `settings.relays.statusOffline` | Offline | Keep |

---

## Preset → mode matrix (copy must match)

| Preset id | Product pool class | Mode UX | Wire mode |
|-----------|--------------------|---------|-----------|
| `default_stable` | Public default (boot) | Multi-node | `redundancy` |
| `high_redundancy` | Public expanded | Multi-node | `redundancy` |
| `low_latency` | Public latency-biased | Single-node (auto-correct) | `basic` |
| `local_dev_mesh` / LAN / SSH / Tor templates | Lab / private | Usually Single | `basic` (except hybrid) |
| `hybrid_public_http` | Mixed | Multi-node | `redundancy` |

---

## D1 binding rules (for implementer)

1. Toggle `checked === (relayTransportMode === "redundancy")` unchanged — only strings + optional helper copy.  
2. Do not invent a second mode store.  
3. Do not claim public relay SLA in any new string.  
4. Locales: EN first in D1; other locales can trail with English fallback until translated.  
5. Proof: existing `transport-preset-settings.contract.test.ts` / catalog tests + string snapshot or assert key presence.

---

## D0 acceptance checklist

- [x] Enum ↔ Single / Multi map written  
- [x] Default public pool called out as boot surface  
- [x] Target EN for mode toggle + public preset descs  
- [x] D1 binding rules (no wire rename, no SLA)  
- [x] Maintainer started D0 → treat map as accepted for D1
