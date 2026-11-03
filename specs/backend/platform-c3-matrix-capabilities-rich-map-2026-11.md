# Design — C3 Matrix capabilities + rich map leaf (2026-11)

**Status:** Landed (L1) · **lab only — not Matrix promote**  
**Parent:** Matrix adapter (C2) · mirror of [platform-p4h-private-dc-capabilities-rich-map-2026-11.md](./platform-p4h-private-dc-capabilities-rich-map-2026-11.md)

```text
HANDOFF ATOMIC STEP: C3 Matrix capabilities + rich map — DONE L1 (lab)
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · matrix-adapter / matrix-rich-map
PROOF:               MATRIX_LAB_CAPABILITIES · rich/canonical maps · adapter thin · contract Pass
```

## 1. Goal

Symmetry with P4h: named Matrix **lab** capabilities + extracted room/timeline mappers so the adapter stays a thin HS wire owner. Does **not** promote Matrix out of lab.

## 2. Cut

1. `matrix-capabilities.ts` — `MATRIX_LAB_CAPABILITIES`
2. `matrix-rich-map.ts` — room→rich · timeline→rich · timeline→canonical
3. Adapter imports leaves; no inline capability object / local map helpers
4. Unit + contract Pass

## 3. Non-claims

- Not Matrix promote / Olm E2EE / Soft L3 / Tor Verified
- Not public “Matrix ready” marketing
