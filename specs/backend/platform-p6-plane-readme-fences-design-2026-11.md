# Design — P6 plane README fences (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-boundary-map-2026-11.md](./platform-boundary-map-2026-11.md) · [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)

```text
HANDOFF ATOMIC STEP: P6 plane README fences — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     Auth / Storage / PAL docs at feature roots
PROOF:               platform-p6-plane-readme-fences.contract.test.ts Pass
```

## 1. Goal

Make the four rewrite-band planes discoverable at the filesystem root without a mega-rename: each owner tree gets a short **owns / does not own** README (same pattern as K4 profile trees).

## 2. L1 slice

| Path | Plane |
|------|-------|
| `features/auth-kernel/README.md` | Auth (ports / session mutation) |
| `features/auth/README.md` | Auth shell UX (door UI only) |
| `features/storage/README.md` | Storage (at-rest + inbound quarantine) |
| `features/protocol-adaptation/README.md` | PAL — extend existing with plane owns |

Contract: files exist and cite `platform-boundary-map-2026-11.md`.

## 3. Deferred

- Mass folder moves / package splits
- Closing dm-controller `SendConfirmation` type leak (separate subtraction cut)

## 4. Non-claims

- Not Soft L3 / Tor Verified / Matrix promote
- Not “layout rewrite complete”
