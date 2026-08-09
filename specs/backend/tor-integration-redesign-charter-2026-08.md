# Charter — Tor integration redesign (lifecycle-first)

**Date (UTC):** 2026-08-08  
**Status:** Charter **Accepted** (TI-B) · TI-0 Accepted · TI-1–TI-4 **Implemented (L1)** · next TI-5 / T5-3  


**Parents:** [tor-enable-disconnect-investigation-2026-08.md](./tor-enable-disconnect-investigation-2026-08.md) · [tor-t5-stability-latency-charter-2026-08.md](./tor-t5-stability-latency-charter-2026-08.md) · [tor-t5-tor-viable-pool-design-2026-08.md](./tor-t5-tor-viable-pool-design-2026-08.md) · [tor-r4-slice-4b-tunnel-design-2026-08.md](./tor-r4-slice-4b-tunnel-design-2026-08.md)

```text
HANDOFF ATOMIC STEP:  Tor TI-B Accepted · TI-0 Design Ready
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNERS:     apps/tor-gateway · desktop tor.rs / spawn policy · relay-provider dial gate · Security Tor UX
PROOF BEFORE DONE:    Named slices L1–L3; Tor ON does not orphan clearnet without Ready; Tor OFF unbroken
OUT OF SCOPE:         Community · AUTH-SESSION · UI SOCKS · Arti as first slice · CF-as-Tor-SLA
```

## Verdict

The Tor **integration module needs a redesign of lifecycle ownership**, not a rewrite of Nostr/mesh cryptography.

Maintainer evidence matches investigation **R1–R3**: gateway not co-started with desktop · dial policy arms on preference · fail-closed leaves zero sockets.

**Do not** “rewrite everything.” Subtract the broken coupling; add one lifecycle owner; gate dial subtraction on Ready.

## Product goals (unchanged)

| Goal | Meaning |
|------|---------|
| Tor until production | Preference remains the privacy path |
| Communication must not die on toggle | Enabling Tor must not orphan Mixed adapters clearnet until Tor is actually Ready **or** user explicitly chooses Tor-only |
| Fail closed when Tor Required | Once Tor path is armed and Ready, no silent clearnet cheat |
| One SOCKS owner | Gateway only — UI never dials `:9050` |

## Decision options

| ID | Approach | Verdict |
|----|----------|---------|
| **TI-A** | Keep dual-process; document “run `pnpm dev:tor-gateway`” only | **Reject** as product UX — proven failure mode |
| **TI-B** | Lifecycle-first: desktop/dev stack **owns** gateway start; dial subtract only on `lifecycleReady`; Security states Warming / Ready / Degraded | **Accepted** (maintainer 2026-08-08) |
| **TI-C** | Embed Tor (Arti) inside desktop process | **Defer** (T5-4) — not required to unblock TI-B |
| **TI-D** | Soft Tor: always clearnet fallback while preference ON | **Reject as default** — breaks Tor-required honesty; may exist only as explicit “Tor preferred” mode later |

**Charter decision:** **TI-B Accepted** (maintainer 2026-08-08).

## Target state machine

```text
Tor preference OFF
  → clearnet Mixed adapters / Default Stable (unchanged)
  → gateway stop best-effort

Tor preference ON
  → ensure gateway process (spawn or stack-managed)
  → state Warming (bootstrap < 100%)
       dial policy: KEEP clearnet pool (do not subtract yet)
       UI: “Tor starting…” · no fake Ready
  → state Ready (bootstrap 100% + gatewayReachable)
       dial policy: Tor-viable only (T5-2 contract)
       UI: honesty if pool empty · CTA add onion / T5-3
  → state Degraded (preference ON · gateway down after Ready or start fail)
       dial policy: restore clearnet (TI-0 D1) · honest degraded copy
       UI: never claim Connected
```

**Invariant:** `configured === true` alone must **not** empty the dial pool.

## Slice sequence

| Slice | Work | Exit |
|-------|------|------|
| **TI-0** | Design: Degraded policy (clearnet restore vs hard-block) · spawn vs stack-managed gateway · Windows process ownership · Security copy rewrite | Spec Accepted · **no large code** |
| **TI-1** | Ready-gate dial subtraction (`lifecycleReady` / gateway reachable) — fix T5-2 contract drift | L1 unit · L3: Tor ON without gateway **keeps** clearnet opens |
| **TI-2** | Co-start gateway: `dev:desktop:online` includes tor-gateway **or** desktop spawns `obscur-tor-gateway` binary | **Implemented (L1)** · L3: toggle Tor ON → bootstrap without second manual terminal |
| **TI-3** | Security UX: Warming/Ready/Degraded · remove stale “WS still clearnet” copy · Relays honesty when Warming | **Implemented (L1)** · L3 UI Pass |
| **TI-4** | DISABLED DISABLED badge/role duplication · error-code detail path | **Implemented (L1)** · L3 UI Pass |
| **TI-5** | Rejoin T5-3 onion ops once lifecycle is honest | Per T5-3 charter |

## Non-goals

- Re-arming UI SOCKS  
- Claiming CF public Tor SLA  
- Rewriting conduit-mesh / NativeRelay from scratch  
- Community / AUTH-SESSION  
- Arti migration as TI-1

## Proof language

| May say | When |
|---------|------|
| Charter Ready | This file |
| Charter Accepted | Maintainer picks TI-B (+ Degraded policy in TI-0) |
| TI-1 Implemented | Ready-gated subtract · L1 green |
| Integration Verified | L3: Tor ON Warming keeps DMs · Ready switches Tor-viable · Tor OFF clearnet OK · gateway starts with desktop path |

## Immediate next

**TI-0 Accepted · TI-1 Implemented (L1)** — Ready-gate dial subtract.  
**Next:** T5-3-A Accepted · T5-3.0 Design Ready — maintainer Accept ops design → **T5-3.1** provision.
