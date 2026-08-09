# Design — TI-0 Tor lifecycle contracts (Ready-gate · Degraded · co-start)

**Date (UTC):** 2026-08-08  
**Status:** Design **Accepted** · TI-1–TI-4 **Implemented (L1)** · next TI-5 / T5-3  

**Charter:** [tor-integration-redesign-charter-2026-08.md](./tor-integration-redesign-charter-2026-08.md) — **TI-B Accepted**  
**Parents:** [tor-enable-disconnect-investigation-2026-08.md](./tor-enable-disconnect-investigation-2026-08.md) · [tor-t5-tor-viable-pool-design-2026-08.md](./tor-t5-tor-viable-pool-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  Tor TI-0 design (lifecycle contracts)
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      resolveTorDialPolicyPhase · relay-provider · tor.rs / gateway spawn · Security copy
PROOF BEFORE DONE:    Spec accepted · L1 named for TI-1 (Ready-gate) — no large code in TI-0
OUT OF SCOPE:         Spawning gateway in this slice · Arti · Community · UI SOCKS
```

## Goal

Lock the contracts TI-1…TI-3 implement so Tor preference ON cannot orphan Mixed adapters clearnet before Tor is Ready, and Degraded/Warming behave honestly.

## 1. Dial policy phase (single owner)

### Predicate

```text
resolveTorDialPolicyPhase(snapshot) →
  | "clearnet"     — preference OFF
  | "warming"      — preference ON ∧ ¬lifecycleReady
  | "tor_armed"    — preference ON ∧ lifecycleReady ∧ gatewayReachable
  | "degraded"     — preference ON ∧ was Ready or start failed ∧ ¬lifecycleReady
                     (see §2 for dial behavior)
```

`lifecycleReady` = gateway reports Bootstrapped 100% (existing field).  
`configured` / preference ON alone must **never** select Tor-viable subtraction.

### Pool wiring (replaces T5-2 drift)

| Phase | NativeRelay / DM dial pool |
|-------|----------------------------|
| `clearnet` | `resolveDmTransportRelayUrls` / Mixed adapters (unchanged) |
| `warming` | **Same as clearnet** — keep opens |
| `tor_armed` | `resolveTorViableDmRelayUrls` (T5-2) |
| `degraded` | **Restore clearnet** (decision D1 below) |

Provider must key off phase, not `configured`.

### L1 (TI-1)

Pure helper + provider unit/matrix:

- preference OFF → clearnet  
- preference ON · not Ready → warming → clearnet URLs  
- preference ON · Ready → tor_armed → CF subtracted  
- preference ON · Ready then gateway down → degraded → clearnet restored  

## 2. Degraded policy — **D1 Accept (recommended)**

| ID | Behavior | Verdict |
|----|----------|---------|
| **D1** | Degraded → restore clearnet dials · UI shows Tor degraded + CTA restart gateway | **Accept** |
| **D2** | Degraded → hard-block (0 dials) until gateway returns | Reject for default product path |

**Rationale:** Charter goal “communication must not die on toggle” and maintainer Pass on Mixed adapters. Hard-block without a live onion is a dead app. Honesty copy must say Tor is **not** protecting traffic while degraded.

Once `tor_armed` again, re-apply Tor-viable subtraction (no dual parallel dialers).

## 3. Gateway co-start — **ownership split**

| Surface | Owner | Mechanism |
|---------|--------|-----------|
| Dev online stack | `scripts/dev-workspace-stack.mjs` | Spawn `pnpm`/`cargo` tor-gateway on `:17950`/`:17951` when `--online` (TI-2) |
| Desktop product / preference ON | `apps/desktop` tor lifecycle | If `health()` false → spawn **`obscur-tor-gateway` binary** as child (not `tor.exe`) · then `POST /v1/tor/start` (TI-2) |
| SOCKS / tor.exe | `obscur-tor-gateway` only | Unchanged R4 |

**Invariant preserved:** UI process never dials SocksPort; never spawns `tor.exe`.

Windows: use same `bash -c` / cargo-run pattern as `pnpm dev:tor-gateway` for lab; packaged builds ship `obscur-tor-gateway.exe` beside the app (path resolution in TI-2 design detail).

## 4. Security / Relays copy (TI-3 contracts)

| State | User-visible meaning |
|-------|----------------------|
| Warming | “Tor is starting — clearnet relays still in use until bootstrap finishes.” |
| Ready / tor_armed | “Tor ready — dialing Tor-viable relays only.” (+ empty-pool honesty if needed) |
| Degraded | “Tor gateway unavailable — temporarily using clearnet. Restart Tor or check gateway.” |
| OFF | Existing clearnet copy |

**Subtract** stale string: “relay WS still clearnet until later.”

## 5. Relays UI (TI-4 contracts)

- When `!enabled`: show **one** Disabled chip (badge **or** role — not both “DISABLED DISABLED”).  
- Machine codes (`websocket_error`) always pass through `translateRelayNodeDetail`.

## 6. Mental simulation

**Toggle Tor ON, gateway was down**

1. Preference saved → phase `warming` (or immediate spawn attempt).  
2. Clearnet sockets stay open / re-dial.  
3. Gateway comes up → bootstrap → `tor_armed` → subtract CF → Tor-viable (may empty → honesty).  
4. User not stuck at 0 opens solely because preference flipped.

**Toggle Tor OFF**

1. Phase `clearnet` · gateway stop best-effort · Mixed adapters path restored.

## 7. Slice order after TI-0 accept

1. **TI-1** Ready-gate (highest leverage, small)  
2. **TI-2** Co-start (stack + desktop spawn)  
3. **TI-3** Security/Relays copy  
4. **TI-4** DISABLED duplication  
5. **TI-5** / T5-3 onion ops

## Claim language

| May say | When |
|---------|------|
| TI-0 Design Ready | This file |
| TI-0 Accepted | Maintainer accepts D1 + co-start split |
| TI-1 Implemented | Ready-gate L1 green |

## Accept → next

Maintainer accept this design (**D1** Degraded→clearnet restore · co-start split above) → **TI-1** Ready-gate implementation only.
