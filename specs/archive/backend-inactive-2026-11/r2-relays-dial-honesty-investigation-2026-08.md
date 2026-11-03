# Investigation — R2 relays dial honesty (dual profile)

**Date (UTC):** 2026-08-02  
**Handoff:** R2 · Relays dial honesty  
**Parent:** [production-truth-release-recovery-2026-08.md](../../docs/program/production-truth-release-recovery-2026-08.md)  
**Prior:** Soft L3 Pass (`S-POOL-L3-msbmmy68`) · E2d/E2c dial pad · [relay-basic-local-primary-starves-remotes-investigation-2026-08.md](./relay-basic-local-primary-starves-remotes-investigation-2026-08.md)

---

## Session header

```text
NEXT ATOMIC STEP:     R2 · Relays dial honesty
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION
CANONICAL OWNER:      scripts/r2-relays-dial-honesty-desktop.mjs · obscurRelayRuntime
PROOF BEFORE DONE:    Dual CDP report · public remote open on A and B · not local-only trap
OUT OF SCOPE:         Public Nostr SLA · COM-RUN · claiming Soft L3 again
```

---

## Pass contract (recovery R2)

| Check | Pass |
|-------|------|
| Both profiles | CDP `:9230` + `:9231` (or documented Edge fallback) |
| Public dial | Each profile has ≥1 **open** clearnet remote among nos / primal / damus |
| Local-only trap | Fail if remotes enabled but only localhost open (classic basic+local starvation) |
| Writable | Each profile `writableRelayCount ≥ 1` |

Soft L3 Row A already showed Tester1 publish path `nos.lol, primal` and Tester2 `writable=3` — R2 makes that a **named dual-profile claim** without re-sending DMs.

---

## Gaps in existing harness

| Script | Gap for R2 |
|--------|------------|
| `verify:e2-public-dial-l3` | Single CDP · defaults `:3340` · Pass = writable≥1 (local alone can Pass) |
| Soft L3 | Dual CDP but claim is delivery+ACK, not dial-honesty product row |

---

## Fix direction

1. New agent script: attach both CDPs, UI-shell accept (native rehydrate), Relays surface optional, snapshot open URLs.  
2. Pass = A∧B publicOpen≥1 ∧ !localOnlyTrap ∧ writable≥1.  
3. `failClass: F-DIAL` when trap or missing public open.  
4. Prefer `:1430` via `resolvePlaywrightAppBase`.

**No product dial-pad change** unless probe Fails with F-DIAL evidence.
