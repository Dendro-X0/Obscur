# Design — `relay-publish` L1 clarify (heuristic allowlist)

**Status:** Implemented (L1) · 2026-07-30  
**Study:** [relay-publish-dual-owner-integration-study-2026-07.md](./relay-publish-dual-owner-integration-study-2026-07.md)  
**Charter:** [rust-module-refactor-queue-2026-07.md](./rust-module-refactor-queue-2026-07.md)  
**Pattern:** [r-scope-slice2-design-2026-07.md](./r-scope-slice2-design-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — relay-publish L1 clarify
PAUSED / CANCELLED:   community · COM-RUN-* · AUTH-SESSION-1 · Dev Lab
                      (relay mutate beyond clarify still PAUSED)
CANONICAL OWNER (native): transport-kernel publish port
PROOF BEFORE DONE:    L1 relay-publish-owner.contract.test.ts
OUT OF SCOPE:         Deleting legacy standalone · community groups/** · conduit-mesh/relay-gateway · UI-kit
```

---

## Verdict

CodaCtrl “22 writers” is mostly path-heuristic noise + freeze packages. This slice **documents + CI-guards** buckets only — no path deletes.

| Bucket | Paths (representative) | Action |
|--------|------------------------|--------|
| A Freeze | `packages/obscur-conduit-mesh/**`, `apps/relay-gateway/**` | Out of keep-set — do not mutate |
| B Noise | pool hooks/types/ports, publish-scope/copy, hydration | Not EVENT publishers |
| C Kernel | `transport-kernel/transport-kernel-publish-port.ts` (+ standalone publish modules under transport-kernel) | Canonical native gate |
| D Legacy | `relays/hooks/relay-standalone-publish-port*.ts` | Documented parallel — quarantine later |
| E Community | `groups/**` local-workspace / sealed retry / writable pool | PAUSED — list only |

---

## Implement slice

1. L1 contract under `apps/pwa/app/features/relays/services/relay-publish-owner.contract.test.ts` (or transport-kernel):
   - Assert `isTransportKernelPublishOwner` export exists on publish-port
   - Assert freeze packages are not imported as production EVENT owners from pwa keep-set (optional light check)
   - Document bucket comments in test header referencing study
2. Ownership comment on `transport-kernel-publish-port.ts`
3. **No deletes** of legacy or community files

---

## Claim language

| May say | When |
|---------|------|
| Clarified (heuristic) | L1 green |
| Implemented (legacy quarantine) | Later slice |
| Fixed (publish dual-owner) | L3 OK on parity after quarantine |
