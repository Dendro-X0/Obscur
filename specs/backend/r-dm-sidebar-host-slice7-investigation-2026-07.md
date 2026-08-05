# Investigation — R-DM-SIDEBAR-HOST Slice 7

**Status:** Investigation · 2026-07-30  
**Prior:** Slice 6 R-DM-READ L1 Pass (dm-kernel ports sole engine)

---

## Session gate

```text
NEXT ATOMIC STEP:     Slice 7 — messaging-provider sidebar dual path
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab
CANONICAL OWNER:      loadDmKernelSidebar (already engine-only)
PROOF BEFORE DONE:    Call sites of dbGetConversations outside PAUSED/backup
OUT OF SCOPE:         account-sync backup · native-dm-sqlite-repair · groups
```

---

## Facts

| Path | Owner |
|------|--------|
| `loadDmKernelSidebar` | Sole engine read (Slice 6) |
| `messaging-provider` `loadSidebarConversations` | Fork: kernel authority → sidebar port · else `dbGetConversations` |
| Default runtime | `isDmKernelAuthority()` true (strict lab) — fork rarely hit |
| Other `dbGetConversations` | backup-evidence · native-dm-sqlite-repair — defer |

**Verdict:** Host still keeps a legacy parallel for ALLOW_LEGACY. Subtract for one product sidebar owner.

---

## Recommended keep-set

1. `loadSidebarConversations` → always `loadDmKernelSidebar`  
2. Remove `dbGetConversations` / `ConversationRecord` / `sqliteConvToRaw` from provider  
3. Update hydration-scope test mocks  
4. Contract: provider must not contain `dbGetConversations`
