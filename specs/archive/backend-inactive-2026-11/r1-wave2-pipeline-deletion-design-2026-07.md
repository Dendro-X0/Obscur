# Design — R1 Wave 2: DM hydrate pipeline / adapter deletion

**Status:** Done · 2026-07-31  
**Proof:** vitest Wave 2 suite **78 Pass** (15 files).

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: Wave 2 pipeline/adapter deletion
PAUSED / CANCELLED:   community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab
CANONICAL OWNER:      resolveDmThreadHistoryAdapter → dmKernelThreadHistoryStub
PROOF BEFORE DONE:    vitest r1-wave2-pipeline-deletion + resolve-dm + w22/w34 + thread-history-port
OUT OF SCOPE:         Delete indexed-scan / hydrate-read-model / load-earlier / native-dm-thread-hydrate (Wave 3) · Slice C L3 · community · UI
```

---

## Facts

| Module | Role after R1-delete |
|--------|----------------------|
| `resolveDmThreadHistoryAdapter` | Still `require(dm-adapter)` when `ALLOW_LEGACY` |
| `dm-adapter` | Thick ThreadHistoryPort → pipeline + load-earlier + projection |
| `dm-conversation-hydrate-pipeline.ts` | Sole production hydrate assembler behind adapter |
| Gateway | `client-gateway-adapter` binds `resolveDmThreadHistoryAdapter()` |

Product UI no longer calls hydrate. Gateway under kernel already stubs. Remaining gap: ALLOW_LEGACY still loads thick pipeline.

---

## Change (subtract)

1. `resolveDmThreadHistoryAdapter` → **always** `dmKernelThreadHistoryStub` (drop ALLOW_LEGACY / require).
2. `dm-adapter.ts` → export stub as `dmThreadHistoryAdapter` (shape continuity; no pipeline import).
3. `resolveThreadHistoryAdapter("dm")` keeps importing `dm-adapter` (now stub).
4. Delete `dm-conversation-hydrate-pipeline.ts` + `dm-conversation-hydrate-pipeline-port.ts`.
5. Remove pipeline re-export from `dm-thread-history-legacy-port.ts`.
6. Align vitest alias `resolve-dm-thread-history-adapter.vitest.ts` with always-stub.
7. Update contracts: w22, w34, w31, w32, p4-bundle-diet, native-dm-legacy-path, truth map; add `r1-wave2-pipeline-deletion.contract.test.ts`.

### Non-goals (Wave 3)

- Delete `hydrate-indexed-scan` / `hydrate-read-model` / `materialization-*` / `native-dm-thread-hydrate` (still unit-tested helpers / native residue).

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/r1-wave2-pipeline-deletion.contract.test.ts \
  app/features/messaging/services/thread-history/thread-history-port.contract.test.ts \
  app/engine-lab/legacy-subtraction-w22.contract.test.ts \
  app/engine-lab/legacy-subtraction-w34.contract.test.ts \
  app/features/dm-kernel/p4-bundle-diet.contract.test.ts \
  app/features/messaging/services/native-dm-legacy-path.contract.test.ts \
  app/features/runtime/services/client-gateway-contract-satisfaction.test.ts
```

---

## Claim language

| May say | When |
|---------|------|
| Wave 2 pipeline deleted | Pipeline files gone; resolver always stub; L1 Pass |
| Full legacy DM materialization deleted | Wave 3 — indexed/read-model/load-earlier gone |
