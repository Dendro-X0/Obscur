# Design — PB2 opt-in link safety (URL reputation)

**Date (UTC):** 2026-10-13  
**Status:** Implemented · **L1 Pass** (2026-10-13) · maintainer **continue** = outbound accept  
**Parents:** [pre-b2b-capability-design-2026-10.md](./pre-b2b-capability-design-2026-10.md) §7 · [pre-b2b-capability-and-media-roadmap-2026-10.md](../../docs/program/pre-b2b-capability-and-media-roadmap-2026-10.md) §3 · ASE M4 ([antisocial-engineering-contract.md](../../docs/program/antisocial-engineering-contract.md) §4.4)

```text
HANDOFF ATOMIC STEP: PB2-B/C settings toggle + labeled consent + URLHaus URL-only fetch
PAUSED / CANCELLED:  Shell-lag until end · M1–M3 · dialects · ASE-2 · SF-B · NIM until P0 · PB1-D A
CANONICAL OWNER:     link-safety-policy · reputation-client · useGuardedExternalLinkOpen · AutoLockSettingsPanel
PROOF BEFORE DONE:   L1 vitest — policy + builder + client + hook (toggle off = no fetch)
SURFACE:             Settings Security · link open dialogs
```

---

## Gap

Guarded open already confirms before leaving the app (`useGuardedExternalLinkOpen` + dm-kernel link gate). There is **no** opt-in outbound reputation check. PB2 adds that as an explicit, labeled phone-home — never silent, never message-body upload.

## Contract (PB2-A)

```text
User taps URL (decrypt path → guarded open)
  → local confirm dialog (existing)
  → if linkSafetyOutboundCheckEnabled (default OFF)
  → second step / labeled option: "Check reputation? Query leaves this device to <provider>."
  → buildUrlReputationRequest(url) → { url } only
  → fetch (post-accept) → L1 banner or L2 confirm before open
  → user cancel → open blocked OR open unchecked (setting; default blocked)
```

| Allowed | Forbidden |
|---------|-----------|
| URL string outbound | Message body · contact graph · keys · pubkey · conversation id |
| Explicit consent copy naming provider | Silent phone-home |
| Setting default **off** | Mandatory cloud ASE |
| Strict profile may *later* default-on (ASE-2c) | ASE-2 product work in this slice |

## Slice plan

| Slice | Scope | Gate |
|-------|--------|------|
| **A** | Pure policy + request builder + L1 tests | **Done** |
| **B** | Settings toggle + consent dialog copy | **Done** (continue = accept) |
| **C** | URLHaus adapter + URL-only fetch | **Done** (no API key required) |
| **PB2-B** | Surface result as ASE L1/L2 only | Result dialog = L1 banner; L2 still local confirm |

## Canonical owners

| Module | Role |
|--------|------|
| `link-safety-policy.ts` | Enablement · consent · cancel-open policy |
| `link-safety-request-builder.ts` | URL-only request shape; strips forbidden fields |
| `useGuardedExternalLinkOpen` | Existing open gate (unchanged in A) |
| `dm-kernel-trust-link-action-gate` | Local credential/lookalike (unchanged; not outbound) |

## Non-goals

- ASE-2 locale packs / step-up (paused)  
- Flowsint / OSINT enrichers  
- Auto-open after reputation  
- Network I/O in slice A  

## Proof

- **L1 Pass (2026-10-13):** Policy default off · URL-only builder · URLHaus client form body · hook (toggle off = no fetch; toggle on = consent → result → open) · settings toggle in AutoLockSettingsPanel · **17** vitest  
- **L3 (when shell usable):** Toggle off = zero reputation network; toggle on = labeled dialog before fetch  

## Accept

Maintainer **continue** (2026-10-13) treated as yes on outbound URL-only checks.

---

_Last updated: 2026-10-13_
