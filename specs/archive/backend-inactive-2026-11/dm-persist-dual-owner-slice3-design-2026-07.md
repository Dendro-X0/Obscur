# Design amend — `dm-persist` #3 sole insert port

**Status:** Implemented (L1) · 2026-07-30  
**Parent:** [dm-persist-dual-owner-design-2026-07.md](./dm-persist-dual-owner-design-2026-07.md)  
**Study:** [dm-persist-dual-owner-integration-study-2026-07.md](./dm-persist-dual-owner-integration-study-2026-07.md) §Subtract #3

---

## Session gate

```text
NEXT ATOMIC STEP:     Dual-owner subtract — dm-persist #3 sole insert port
PAUSED / CANCELLED:   community · relay-publish mutate · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      dm-kernel-write-port (sole Tauri dbInsertMessage / dbUpsertConversation for bus flush)
PROOF BEFORE DONE:    L1 dm-persist-owner.contract · dm-kernel-write-port.test · message-persistence-service.test
OUT OF SCOPE:         engine_invoke (#4) · community-dm-invite / backup evidence callers · groups/**
```

---

## Change

| Before | After |
|--------|--------|
| `flushQueue` branches: `writeDmKernelMessage` **or** bare `dbInsertMessage` | Always `writeDmKernelMessage` / `writeDmKernelConversation` on Tauri |
| `writeDmKernelMessage` no-ops when `!isDmKernelWriteOwner()` | Insert whenever `isTauri()`; owner gate remains on **probe** only |

`isDmKernelWriteOwner` stays for probe / authority diagnostics — not a second insert path.

---

## L1 allowlist update

Production `dbInsertMessage(` under `app/`:

| Path | Role |
|------|------|
| `dm-kernel/dm-kernel-write-port.ts` | **Sole bus/persist insert port** |
| `account-sync/.../native-sqlite-backup-evidence.ts` | Backup probe (separate lifecycle) |
| `groups/.../community-dm-invite-pipeline.ts` | Community PAUSED neighbor — list only |

`message-persistence-service.ts` must **not** call `dbInsertMessage` / `dbUpsertConversation`.

---

## Proof

```text
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/dm-persist-owner.contract.test.ts \
  app/features/dm-kernel/dm-kernel-write-port.test.ts \
  app/features/messaging/services/message-persistence-service.test.ts \
  app/features/messaging/services/thread-history/dm-durability-contract.test.ts
```
