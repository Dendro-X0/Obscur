# Investigation — Public Quiet relays never connect

**Date (UTC):** 2026-10-15  
**Status:** Fix landed · L1 + L2 proven for v2.0.0-beta showcase  
**Evidence:** Settings Relays UI · `QUIET_PUBLIC_DIAL_CAP=0` · warmup dial cap=0

---

```text
HANDOFF ATOMIC STEP: Restore capped clearnet public dials for beta showcase
PAUSED / CANCELLED: Soft L3 Fixed · remount presence/warmup stampede · uncapped Quiet fan-in
CANONICAL OWNER: NativeRelay (relay.rs) + relay-warmup-dial-cap.ts
PROOF: ≥1 public wss connects on clearnet (Tor off); unlock stays fluid; journal no heap
```

## Symptom

Enabled public relays (`wss://nos.lol`, `relay.damus.io`, `relay.primal.net`) fail to open sockets. Localhost optional Docker may also error. Product looks offline to evaluators.

## Root cause (not CDN death)

| Gate | Value | Effect |
|------|-------|--------|
| Rust `QUIET_PUBLIC_DIAL_CAP` | **0** | Every Quiet host `connect_relay` → `Err("quiet_dial_cap")` |
| JS `RELAY_WARMUP_PUBLIC_DIAL_CAP` | **0** | Warmup partition dials **zero** public URLs |
| `partitionWarmupDialUrls` + private/local in list | omits all public | localhost/8788 present → public never in immediate set |

Historical reason: L2 soaks (cap=1 sticky nos.lol) still PostMessage-flooded and heap-crashed under **pre-thin** unlock. Caps were set to 0 as quarantine.

## Why reopen now is feasible

Landed since that L2:

- Thin unlock shell (no presence/warmup/ingest stampede)
- Serial `relay_dial_gate`
- EVENT coalesce + hard cap in NativeRelay
- Engine invoke budget/coalesce
- Account-sync off unlock path

## Fix contract (subtraction of over-quarantine)

1. Raise Quiet caps to **2** (not unlimited).  
2. Rust claim = up to N distinct hosts; release host when last connection drops.  
3. Warmup partition: private/local first, then ≤cap public (not omit all).  
4. Keep Tor fail-closed when Tor preferred; clearnet when Tor off.

## Proof layers

| Layer | Command / check |
|-------|-----------------|
| L1 | Unit: caps=2 · claim/release · partition includes ≤2 public with localhost |
| L2 | Desktop unlock · ≥1 of nos/damus/primal `connected` · no freeze 10m |
| L3 | Optional later Soft L3 — not beta gate |

## Landed code (2026-10-15T12:28Z)

- `apps/desktop/src-tauri/src/relay.rs` — `QUIET_PUBLIC_DIAL_CAP=2`, multi-host HashMap claims, release on read-loop exit
- `apps/pwa/app/features/relays/services/relay-warmup-dial-cap.ts` — cap=2; partition = private then ≤cap public
- L1: `cargo test --lib quiet_public` 3/3 · vitest dial-cap 10/10

## L2 proof (2026-10-15T12:35Z)

- Shell: `shell-2026-10-15T12:17:14Z` via `pnpm dev:desktop`
- Unlock Tester1 · Tor off · Clearnet
- Journal: `quiet_dial_cap chose host=nos.lol` then `relay.primal.net`; `subscribe_relay` / `relay-event` traffic
- UI: publish-ready ≥1 · DM path nos.lol + primal; damus may stay undialed (3rd host beyond cap)

## Maintainer confirm (2026-10-15T12:43Z)

- Dual-profile DM Tester1↔Tester2 live; footer **Connected | 2/3 active relays** on both windows
- Performance OK · unlock fluid · 2/3 = Quiet cap (expected)

_Last updated: 2026-10-15T12:43:00Z_
