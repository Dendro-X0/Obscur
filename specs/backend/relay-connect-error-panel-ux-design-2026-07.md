# Design — Softer non-stacking relay connect warnings

**Status:** Implemented · L1 Pass · 2026-07-30  
**Investigation:** [relay-connect-error-panel-ux-investigation-2026-07.md](./relay-connect-error-panel-ux-investigation-2026-07.md)

---

## Target

1. **Store:** `RELAY_CONNECT_FAILED` always merges into a single visible entry (ignore 60s window for this code). Keep `occurrenceCount`.
2. **Emit:** User `message` = short host-level sentence. Probe / raw IO stay in optional `detail` (and existing runtime logs) — not the primary line.
3. **Panel:** Relay codes use amber/warning chrome (not destructive red). Title human (“Relay connection issue”), not `Error: RELAY_CONNECT_FAILED`. Show `detail` collapsed. Cap visible non-relay errors unchanged (≤6); at most one connect card.

## Forbidden

- New toast library path beside `ErrorPanel`
- R-RELAY transport / failover rewrite
- Hiding failures entirely (still show one soft warning + Retry)

## Proof

| Layer | Command |
|-------|---------|
| L1 | `pnpm exec vitest run app/features/native/lib/native-error-store.test.ts` (+ panel helper if added) |

## Claim

Implemented ≠ network fixed. Only presentation/dedupe.
