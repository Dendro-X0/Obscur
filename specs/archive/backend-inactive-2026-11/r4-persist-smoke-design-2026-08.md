# Design — R4 persist smoke harness

**Date (UTC):** 2026-08-02  
**Investigation:** [r4-persist-smoke-investigation-2026-08.md](./r4-persist-smoke-investigation-2026-08.md)

---

## Script

`scripts/r4-persist-smoke-desktop.mjs` · `pnpm verify:r4-persist-smoke`

### Pass

```
pass ⇔ before ∧ after ∧ !devLabSynthetic
seed ⇔ freshComposeSend ∨ (today Soft L3 report with l3.pass ∧ fAck ∧ marker)
```

Fresh compose preferred. Soft L3 marker corroboration covers CDP compose detach flakes (same honesty pattern as R3).

Exit `0` Pass · `1` Fail · `2` Blocked.

### Claim

R4 Pass ≠ Soft L3 re-claim ≠ O-2 VERIFIED cold restart ≠ public Nostr SLA.

### Proof

| Layer | Command |
|-------|---------|
| L3 smoke | `pnpm verify:r4-persist-smoke` with `pnpm dev:desktop:online` + CDP |
| Report | `test-results/r4-persist-smoke-YYYY-MM-DD.json` |

---

## Status

**Pass (L3 smoke)** — 2026-08-02 · `S-POOL-L3-msbmmy68` before∧after WebView reload · `seedSource=soft_l3_corroboration` · not O-2 cold process.
