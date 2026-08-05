# Design — U1: Community invite DM persist → dm-engine (narrow charter)

**Status:** Done · 2026-07-31  
**Queue (maintainer):** **U1 → U3 → R1**  
**Study:** [community-unpause-integration-study-2026-07.md](./community-unpause-integration-study-2026-07.md)  
**Proof:** vitest `dm-persist-owner` + `dm-kernel-write-port` **10 Pass** · allowlist empty.

---

## Session gate

```text
HANDOFF ATOMIC STEP:  U1 invite→dm-engine (first of U1→U3→R1)
PAUSED / CANCELLED:   Full community band still PAUSED except this narrow persist subtract
CANONICAL OWNER:      dm-kernel-write-port (writeDmKernelMessage / writeDmKernelConversation)
PROOF BEFORE DONE:    dm-persist-owner.contract allowlist empty · vitest Pass
OUT OF SCOPE:         U3 Slice C · R1 hydrate · roster UI · COM-RUN-01 · un-pause full band
```

---

## Goal

Subtract the last product `dbInsertMessage` / bare `dbUpsertConversation` from `community-dm-invite-pipeline` so invite response native persist uses the same owner as all other DM writes.

---

## Facts

| Path | Persist today |
|------|----------------|
| Outbound invite | MessageQueue + `messagePersistenceService.flushPendingNow` → already `writeDmKernel*` |
| Terminal response | `persistInviteToNativeSqlite` → **bare** `dbInsertMessage` + `dbUpsertConversation` |
| Allowlist | `dm-persist-owner.contract.test.ts` lists invite pipeline as sole offender |

---

## Change

1. Rewrite `persistInviteToNativeSqlite` to call `writeDmKernelMessage` + `writeDmKernelConversation`.  
2. Drop `@dweb/db` insert/upsert imports (keep types + `isTauri` if needed).  
3. Empty `DB_INSERT_MESSAGE_ALLOWLIST`.  
4. Update un-pause study: U1 Done; next U3.

**Non-goals:** Invite UX / COM-RUN-11 · group `db_*` · Slice C.

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/services/dm-persist-owner.contract.test.ts \
  app/features/dm-kernel/dm-kernel-write-port.test.ts
```

---

## Claim language

| May say | When |
|---------|------|
| U1 implemented | Allowlist empty + contracts Pass |
| Community un-paused | **No** — only invite DM persist owner unified |
| Invite fixed (L3) | Not this slice |
