# Design — TI-3 Tor Security / Relays UX copy

**Date (UTC):** 2026-08-08  
**Status:** Design Ready · **Implemented (L1)** · L3 UI Pass pending  
**Parents:** [tor-ti0-lifecycle-design-2026-08.md](./tor-ti0-lifecycle-design-2026-08.md) §4 · [tor-integration-redesign-charter-2026-08.md](./tor-integration-redesign-charter-2026-08.md) TI-3

```text
HANDOFF ATOMIC STEP:  TI-3 Security UX copy
PAUSED / CANCELLED:   Community · AUTH-SESSION
CANONICAL OWNER:      resolveTorLifecycleUxPhase · AutoLockSettingsPanel · Relays settings honesty
PROOF BEFORE DONE:    L1 unit · L3 UI Pass (maintainer) — not Tor Verified
OUT OF SCOPE:         TI-4 badge duplex · UI SOCKS · onion ops
```

## Goal

Make Security and Relays copy match TI-1 dial phases. Stop claiming “WS still clearnet until later” and stop implying Tor is Connected when dials are still clearnet.

## Phase → copy (from TI-0)

| UX phase | Dial phase | Copy |
|----------|------------|------|
| `off` | `clearnet` | Existing Tor-off / disabled strings |
| `warming` | `warming` | Tor is starting — clearnet relays still in use until bootstrap finishes. |
| `ready` | `tor_armed` | Tor ready — dialing Tor-viable relays only. |
| `degraded` | `degraded` | Tor gateway unavailable — temporarily using clearnet. Restart Tor or check gateway. |

**Subtract:** `relay WS still clearnet until later` (and any R4 note that implies WS never uses Tor).

## Owners

| Surface | Change |
|---------|--------|
| `tor-lifecycle-ux.ts` | Map dial-policy inputs → UX phase + default English strings / i18n keys |
| Security Tor card | Phase banner · honest gateway note · no stale defaultValue |
| Relays connectivity | Warming/Degraded honesty line · empty-pool honesty only when `ready`/`tor_armed` |
| Pool counts | Count Tor-viable only when armed (`torArmed`), not on preference alone |

## Non-goals

- Redesign Security layout / purple accent redesign  
- DISABLED DISABLED (TI-4)  
- Changing dial policy behavior (TI-1 done)

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | `pnpm exec vitest run` on `tor-lifecycle-ux` + `relay-tor-dial-policy` + `relay-transport-scope-copy` |
| L3 | Maintainer: Warming shows clearnet honesty · Ready shows Tor-viable · Degraded shows restore · stale string gone |
