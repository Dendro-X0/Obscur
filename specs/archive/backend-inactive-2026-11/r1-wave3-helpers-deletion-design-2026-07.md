# Design — R1 Wave 3: orphaned DM hydrate helpers deletion

**Status:** Done · 2026-07-31  
**Proof:** vitest Wave 3 suite **79 Pass** (16 files).

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: Wave 3 indexed/read-model/materialization helpers
PAUSED / CANCELLED:   community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab
CANONICAL OWNER:      resolveDmThreadHistoryAdapter → dmKernelThreadHistoryStub · useThreadMessages → dm-kernel
PROOF BEFORE DONE:    vitest r1-wave3-helpers-deletion + w28–w32 + w30 + dm-durability + native-dm-legacy-path
OUT OF SCOPE:         Delete ThreadHistoryPort types · group adapters · Slice C L3 · community · UI
```

---

## Facts

After Wave 2, production gateway **never** loads thick hydrate. Remaining modules:

| Module | Production importers |
|--------|----------------------|
| `native-dm-adapter.ts` | **None** (orphaned) |
| `native-dm-thread-hydrate.ts` | Only via native adapter / legacy-port |
| `hydrate-indexed-*` / `materialization-*` / `projection-*-messages.ts` / `hydrate-read-model.ts` | Only via legacy-port + unit tests |
| `*-types.ts` / `port.ts` | Still required by stub + group adapters |

---

## Change (subtract)

1. Delete orphaned implementations + dedicated unit tests:
   - `native-dm-adapter.ts`
   - `native-dm-thread-hydrate.ts` (+ test)
   - `hydrate-indexed-scan.ts`, `hydrate-indexed-map-rows.ts`, `hydrate-indexed-legacy-port.ts` (+ scan/map tests)
   - `hydrate-read-model.ts` (+ assemble test)
   - `materialization-load-earlier.ts`, `materialization-realtime.ts` (+ related tests)
   - `projection-evidence-messages.ts`, `projection-live-merge.ts` (+ tests)
   - `dm-thread-history-legacy-port.ts`
2. Keep **types** (`hydrate-*-types`, `projection-*-types`, `load-earlier-types`, `realtime-materialization-types`, `port.ts`).
3. Keep `read-model.ts` (finalize/retry policies — not the deleted assembler).
4. Update contracts w23/w25/w28–w32/w30, durability, truth map, QUARANTINE; rewrite tests that imported deleted symbols (`native-dm-read-policy`, `use-conversation-messages.test` if needed).
5. Add `r1-wave3-helpers-deletion.contract.test.ts`.

### Non-goals (Wave 3) — cleared in Wave 4

- Remove `ThreadHistoryPort` / stub shape — **kept** (group adapters); Wave 4 only deleted refuse tombstone.
- Delete `native-dm-conversation-hydrate-owner` refuse tombstone — **Done** in [r1-wave4-refuse-tombstone-design-2026-07.md](./r1-wave4-refuse-tombstone-design-2026-07.md).

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/r1-wave3-helpers-deletion.contract.test.ts \
  app/engine-lab/legacy-subtraction-w28.contract.test.ts \
  app/engine-lab/legacy-subtraction-w29.contract.test.ts \
  app/engine-lab/legacy-subtraction-w30.contract.test.ts \
  app/engine-lab/legacy-subtraction-w31.contract.test.ts \
  app/engine-lab/legacy-subtraction-w32.contract.test.ts \
  app/features/messaging/services/thread-history/dm-durability-contract.test.ts \
  app/features/messaging/services/native-dm-legacy-path.contract.test.ts
```

---

## Claim language

| May say | When |
|---------|------|
| Wave 3 helpers deleted | Implementation files gone; L1 Pass |
| Full legacy DM materialization deleted | Wave 2+3 Done — may claim with evidence |
