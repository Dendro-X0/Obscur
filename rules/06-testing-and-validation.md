# 06 — Testing and Validation

## Delivery order (maintainer policy, 2026-06-01)

**Implement broader functionality first; manual testing in batches later** — not incremental manual gates between slices.

| Phase | Gate |
|-------|------|
| Implementation | Automated: unit/integration tests, typecheck, `pnpm release:test-pack` |
| Manual verification | Deferred checklist + demo matrices — run when a milestone is code-complete or before tag |
| Release tag | Optional manual Pass columns per gate doc — not required to start the next code row |

Canonical: [v1.8.x-batch-implementation-lane.md](../docs/program/v1.8.x-batch-implementation-lane.md) § Maintainer delivery order.

---

1. **Validate at the narrowest useful level first.**
   - unit test,
   - focused integration test,
   - typecheck,
   - then runtime/manual instructions.

2. **Every fix in critical paths should leave behind one of:**
   - a typed contract,
   - a diagnostics surface,
   - an owner-map / rules update,
   - or a doc update explaining the gate/risk.

   Unit tests alone are insufficient for **navigation performance** — use the manual rapid-nav gate in [`docs/program/navigation-performance-contract.md`](../docs/program/navigation-performance-contract.md) **at milestone batch verification**, not as a per-slice implementation blocker.

3. **Core communication work is not done without two-user reasoning.**
   - For identity, request, DM, relay, and multi-profile work, always reason about sender and receiver states separately.

**Docs:** encyclopedia **06**, `docs/trust/`
