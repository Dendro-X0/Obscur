# Design — R1 DM hydrate shrink (dm-kernel sole product read)

**Status:** Done · 2026-07-31  
**Proof:** vitest r1-dm-hydrate-shrink + native owner + use-thread-messages **11 Pass**.

---

## Session gate

```text
HANDOFF ATOMIC STEP:  R1 hydrate shrink
PAUSED / CANCELLED:   community full band · COM-RUN-01/02
CANONICAL OWNER:      useThreadMessages → useDmKernelThread → loadDmKernelThread → fetchDmThreadRows
PROOF BEFORE DONE:    vitest r1-dm-hydrate-shrink + native-dm-conversation-hydrate-owner
OUT OF SCOPE:         Delete legacy hydrate files · group thread · UI
```

---

## Facts

| Path | Role today |
|------|------------|
| Product ChatView | `useThreadMessages` → **dm-kernel** when `isDmKernelAuthority()` (desktop default) |
| Legacy hydrate | Only `OBSCUR_ALLOW_LEGACY=1` && !kernel |
| `runLegacyNativeDmConversationHistoryHydrate` | Still runnable; still calls thick pipeline via `messagingClientOperations` |

**Gap:** Accidental call of legacy native hydrate under dm-kernel could still exercise the interim assembler stack.

---

## Change (subtract)

1. At start of `runLegacyNativeDmConversationHistoryHydrate`: if `isDmKernelAuthority()`, log + return empty / refused diagnostic — **do not** call hydrate pipeline.  
2. L1 contract: product routing + refuse gate + legacy opt-in formula.  
3. Truth map: R1 interim = legacy residue only; product owner = dm-kernel.

**Non-goals (superseded):** UI hook deletion moved to [r1-legacy-hydrate-tree-deletion-design-2026-07.md](./r1-legacy-hydrate-tree-deletion-design-2026-07.md). Pipeline/adapter Wave 2 remains.

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/r1-dm-hydrate-shrink.contract.test.ts \
  app/features/messaging/services/native-dm-conversation-hydrate-owner.test.ts \
  app/features/messaging/hooks/use-thread-messages.test.ts
```

---

## Claim language

| May say | When |
|---------|------|
| R1 product path sole dm-engine | Contracts Pass + refuse gate |
| R1 legacy deleted | Files gone — not this slice |
