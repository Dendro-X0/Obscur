# Design — Relays UI honesty after P0–P6 smoke

- Date (UTC): 2026-08-01
- Trigger: Maintainer — continue improving UI display and latency issues
- Evidence: `test-results/p0-p6-relay-smoke-2026-08-01.json` — nos.lol **DISCONNECTED** + **ACTIVE TRANSPORT**; Avg Latency untagged mix

## Session gate

```text
NEXT ATOMIC STEP: Hold — Desktop Relays smoke Pass (P0–P6)
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: deriveRelayNodeStatus · RelayDashboard connection match · relayQuickHealth
PROOF: L1 relay-runtime-status + relay-dashboard (+ settings model helper if extracted)
OUT OF SCOPE: COM-RUN · AUTH-SESSION · Mbps · public SLA · changing ≥5 success gate
```

## Problems

| ID | Symptom | Likely cause |
|----|---------|--------------|
| **U1** | Primary card: badge Disconnected + role **Active transport** | `roleLabel` uses selection role alone; ignores socket |
| **U2** | Pool says open/writable but card Disconnected | Dashboard `connections.find` is **exact URL only**; hints already use `workspaceRelayUrlsMatch` |
| **U3** | Header **Avg Latency** mixes Connect + RTT + closed remotes | Averages all enabled `metrics.latency` without open filter / source honesty |

## Contracts

### U1 — Role label

| Condition | `roleLabel` |
|-----------|-------------|
| Primary + socket open | `Active transport` |
| Primary + not open | `Primary` |
| Active pool member + open | `Pool member` |
| Standby (unchanged) | `Standby` / `Standby (probed)` |

Badge/detail paths unchanged (Disconnected stays when no open socket).

### U2 — Connection match

`RelayDashboard` / `RelayMetricCard` resolve pool connection with `workspaceRelayUrlsMatch` (same as health hints).

### U3 — Quick Avg Latency

- Prefer metrics for **open** enabled URLs only.
- If any open sample has `latencySampleSource === "app"`, average those app samples and surface label **Avg RTT** (English + i18n key).
- Else average open connect samples → **Avg Connect**.
- If no open samples → `n/a`.

## Slice

1. `deriveRelayNodeStatus` roleLabel rules + L1 tests.
2. Dashboard connection matching.
3. Pure helper for quick-health average (used by settings model; mirror `_settings-original` if still live).
4. i18n for Avg RTT / Avg Connect defaults.

## Claim

- After L1: display honesty **implemented**.
- Desktop soft re-smoke optional to claim verified.
