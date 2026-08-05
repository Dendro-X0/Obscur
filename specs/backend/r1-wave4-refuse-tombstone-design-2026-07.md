# Design — R1 Wave 4: refuse-tombstone + type alias shrink

**Status:** Designed · Implemented · Verified (L1) · 2026-07-31  
**Parents:** [r1-wave3-helpers-deletion-design-2026-07.md](./r1-wave3-helpers-deletion-design-2026-07.md) (deferred refuse tombstone) · R1 shrink / tree-delete

---

## Session gate

```text
HANDOFF ATOMIC STEP:  R1 Wave 4 Done — refuse tombstone + type alias shrink
PAUSED / CANCELLED:   community · COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab
CANONICAL OWNER:      dm-kernel thread reads · ThreadHistoryPort remains for group adapters
PROOF BEFORE DONE:    vitest r1-wave4-refuse-tombstone + w25/w35 + shrink/delete/legacy-path
OUT OF SCOPE:         Delete ThreadHistoryPort / hydrate-*-types · group adapters · community · Slice C L3
```

**Charter:** Maintainer selected **R1 Wave 4** after group `db_*` IPC tombstone Done.

**Closeout (2026-07-31):** Refuse owner/port deleted; `DmConversationMaterializationPort` alias removed; L1 contracts Pass.

---

## Facts

Wave 3 left a **refuse-only** native hydrate owner so contracts could prove “no pipeline.” Product never calls it. `shouldNativeDmSkipHydrateRetryTrigger` has no production importers.

| Keep | Delete |
|------|--------|
| `ThreadHistoryPort` + hydrate/load-earlier/projection **types** (group adapter) | `native-dm-conversation-hydrate-owner.ts` |
| `dmKernelThreadHistoryStub` / `dm-adapter` stub | `native-dm-conversation-hydrate-port.ts` |
| `read-model.ts` finalize helpers | Owner unit test + refuse call sites in contracts |
| | Deprecated alias `DmConversationMaterializationPort` (use `ThreadHistoryPort`) |

---

## Change (subtract)

1. Delete refuse tombstone files + `native-dm-conversation-hydrate-owner.test.ts`.
2. Update contracts: assert files **absent**; remove `runLegacyNativeDmConversationHistoryHydrate` invocations from shrink/delete suites.
3. `messaging-client-operations` + `thread-history/index` / `port`: drop `DmConversationMaterializationPort`.
4. Add `r1-wave4-refuse-tombstone.contract.test.ts`.
5. Update Wave 3 design non-goals → Wave 4 Done pointer.

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/r1-wave4-refuse-tombstone.contract.test.ts \
  app/features/messaging/services/r1-dm-hydrate-shrink.contract.test.ts \
  app/features/messaging/services/r1-legacy-hydrate-tree-deletion.contract.test.ts \
  app/features/messaging/services/native-dm-legacy-path.contract.test.ts \
  app/engine-lab/legacy-subtraction-w25.contract.test.ts \
  app/engine-lab/legacy-subtraction-w35.contract.test.ts
```

**Do not claim:** ThreadHistoryPort deleted · community un-paused · DM read fixed beyond L1 contracts.

---

## Claim language

| May say | When |
|---------|------|
| R1 Wave 4 Done | Refuse files gone; contracts Pass |
| Full R1 residue cleared | Wave 4 Done — refuse tombstone gone; port types remain for groups |
| Fixed DM hydrate runtime | **Never** from Wave 4 alone |
