# Design — Dev Lab Phase 3 deletion

**Status:** Done · 2026-07-31  

**Parent:** [dev-lab-product-quarantine-design-2026-07.md](./dev-lab-product-quarantine-design-2026-07.md) · [production-rewrite-and-devlab-tombstone-2026-07.md](./production-rewrite-and-devlab-tombstone-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: Dev Lab Phase 3 delete
PAUSED / CANCELLED:   community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab as validation
CANONICAL OWNER:      engine-lab/dev-lab-tombstone-policy (always-false gate)
PROOF BEFORE DONE:    vitest quarantine+policy · verify:dev-lab · trust matrix relocated · no features/dev-lab imports
OUT OF SCOPE:         Slice C L3 CDP · community · rewrite all archive docs
```

---

## Facts

| Surface | Role |
|---------|------|
| `features/dev-lab/**` | Dead tree; product bridges already unmounted |
| `isDevLabEnabled` | Still imported by `transport-kernel-publish-port` |
| Trust matrix/fixtures | Live in `features/dev-lab` but pure dm-kernel assessment wrappers |
| E2E CDP | Imports `DEV_LAB_ACCOUNTS`; second test calls `window.obscurDevLab` |
| Scripts | Entry scripts already `dev-lab-tombstone.mjs` |

---

## Change (subtract + relocate)

1. Add `apps/pwa/app/engine-lab/dev-lab-tombstone-policy.ts` — `isDevLabEnabled` → false; tombstone constants.
2. Point transport publish port (+ contracts) at engine-lab policy.
3. Move `dev-lab-trust-matrix` + `dev-lab-trust-fixtures` (+ tests) → `features/dm-kernel/` (keep export names this wave).
4. Update `verify:trust-v1.9.5` paths; move quarantine+policy tests under `engine-lab/`.
5. E2E: use `TESTER2` pubkey from `dev-test-accounts`; skip/remove `obscurDevLab` repair smoke (API deleted).
6. Drop contracts that assert lab install/bridge source text.
7. Delete `apps/pwa/app/features/dev-lab/**`.
8. Keep `scripts/dev-lab-tombstone.mjs` + package scripts that call it. Optionally leave other `scripts/dev-lab-*.mjs` as dead (or delete if only tombstone-adjacent).

---

## Proof

```bash
pnpm verify:dev-lab
pnpm -C apps/pwa exec vitest run \
  app/engine-lab/dev-lab-tombstone-policy.test.ts \
  app/engine-lab/dev-lab-product-quarantine.contract.test.ts \
  app/features/dm-kernel/dev-lab-trust-matrix.test.ts \
  app/features/relays/services/product-publish-inject.contract.test.ts
# expect: no file under apps/pwa/app/features/dev-lab
```

---

## Claim language

| May say | When |
|---------|------|
| Dev Lab deleted | `features/dev-lab` gone + L1 Pass |
| Dev Lab validation restored | Never — tombstone remains |

---

## Closeout evidence (2026-07-31)

- `features/dev-lab/**` deleted; policy at `engine-lab/dev-lab-tombstone-policy.ts`
- Trust matrix/fixtures at `features/dm-kernel/dev-lab-trust-*`
- `pnpm verify:dev-lab` Pass · Phase 3 vitest **41 Pass** (8 files)
- Scripts under `scripts/dev-lab-*.mjs` / `scripts/lib/dev-lab-*` kept as dead (except entry → tombstone); not claimed deleted
- **Not claimed:** Slice C L3 · Dev Lab as validation restored
