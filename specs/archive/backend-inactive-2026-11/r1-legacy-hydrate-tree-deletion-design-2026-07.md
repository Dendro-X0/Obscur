# Design — R1 legacy UI hydrate tree deletion

**Status:** Done · 2026-07-31  
**Proof:** vitest R1-delete suite **60 Pass** (12 files).

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: legacy hydrate tree deletion
PAUSED / CANCELLED:   community full band · COM-RUN-01/02 · O-2/O-4 · RIW-8 · Dev Lab
CANONICAL OWNER:      useThreadMessages → useDmKernelThread | useInertConversationMessages
PROOF BEFORE DONE:    vitest r1-legacy-hydrate-tree-deletion + use-thread-messages + verify:legacy-subtraction (affected w*)
OUT OF SCOPE:         dm-adapter / hydrate-pipeline / indexed-scan (gateway ALLOW_LEGACY residue) · Slice C L3 · UI churn · community
```

---

## Facts

| Module | Role | Callers (product) |
|--------|------|-------------------|
| `use-conversation-messages-legacy.ts` (~1.3k LOC) | Thick UI hydrate hook | Only via port from `useThreadMessages` when `ALLOW_LEGACY && !kernel` |
| `native-dm-conversation-hydrate-owner.ts` | Native path inside that hook | Hook + tests |
| `conversation-hydrate-coordinator.ts` | Coalesce hydrates | Hook only |
| `dm-conversation-hydrate-pipeline.ts` + `dm-adapter` | Gateway materialization | `resolveDmThreadHistoryAdapter` when ALLOW_LEGACY; **not** this slice |

R1 already refuses native owner under dm-kernel. Product ChatView never needs the UI hook when kernel is authority (desktop default).

QUARANTINE delete-when for `use-conversation-messages-legacy`: **`useDmKernelThread` is sole hydrate path** — met for product.

---

## Change (subtract)

### A — Product surface

1. `useThreadMessages`: remove legacy branch; DM = kernel | inert only.
2. `conversation-messages-legacy-port`: `shouldUseLegacyConversationMessagesHydrate` → always `false`; drop re-export of thick hook (tombstone comment).
3. Delete `use-conversation-messages-legacy.ts`.
4. Delete `conversation-hydrate-coordinator.ts` (+ unit test) — sole production importer gone.
5. Shrink `native-dm-conversation-hydrate-owner` to **always refuse** (no `hydrateDmThreadReadModel`) — diagnostic `legacy_hydrate_tree_deleted`. Keep port export for contract continuity this wave.

### B — Tests / contracts

6. Delete hook-only integration suites:
   - `use-conversation-messages.integration.test.ts`
   - `use-conversation-messages.monotonic-hydrate.integration.test.ts`
7. Rewrite `use-thread-messages.test.ts` (no legacy mock path).
8. Update: w35, w36, w22 (if needed), `legacy-deletion-queue`, `r1-dm-hydrate-shrink`, `native-dm-legacy-path`, `v2-slim-native-quarantine`, `dm-durability-contract`, `community-invite-display-boundary`, truth map R1 section.
9. Add `r1-legacy-hydrate-tree-deletion.contract.test.ts`.

### Non-goals (Wave 2 — Done)

- ~~Delete `dm-conversation-hydrate-pipeline.ts` / force always-stub resolver~~ → [r1-wave2-pipeline-deletion-design-2026-07.md](./r1-wave2-pipeline-deletion-design-2026-07.md)

### Non-goals (Wave 3)

- Delete indexed-scan / hydrate-read-model / materialization-* / native-dm-thread-hydrate.
---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/r1-legacy-hydrate-tree-deletion.contract.test.ts \
  app/features/messaging/hooks/use-thread-messages.test.ts \
  app/features/messaging/services/r1-dm-hydrate-shrink.contract.test.ts \
  app/features/messaging/services/native-dm-conversation-hydrate-owner.test.ts \
  app/engine-lab/legacy-subtraction-w35.contract.test.ts \
  app/engine-lab/legacy-subtraction-w36.contract.test.ts \
  app/features/dm-kernel/legacy-deletion-queue.test.ts
```

Optional: `pnpm verify:legacy-subtraction` if time permits.

---

## Claim language

| May say | When |
|---------|------|
| R1 UI hydrate tree deleted | Hook file gone; product path kernel\|inert only; L1 Pass |
| Full legacy DM materialization deleted | Wave 2 — pipeline/adapter gone — **not this slice** |
