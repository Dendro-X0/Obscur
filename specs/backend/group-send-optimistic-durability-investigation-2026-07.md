# Investigation — Group send durability gated on relay publish

**Status:** Complete — design next  
**Date:** 2026-07-31 (UTC)  
**Symptom:** U2 L3 re-soak saw UI message text but `workspace.listGroupMessages` lacked the marker until harness called `insertGroupMessage`  
**Handoff:** B — Optimistic group-send durability (maintainer sequence B → C → E)

---

## Session gate

```text
NEXT ATOMIC STEP:     B — Optimistic group-send durability
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION
CANONICAL OWNER:      sendWorkspaceKernelGroupMessage + commitSealedGroupMessages
PROOF BEFORE DONE:    L1 write-port / append · U2 without engine-insert bridge when possible
OUT OF SCOPE:         UUID-only SQLite rows · second persist owner · COM-RUN-01 · public Nostr redesign (E)
```

---

## Reproduce (U2 re-soak 2026-07-31)

1. Rejoin NewTest 2 · send via UI (`sendSliceCL3GroupMessage`).
2. `getByText(marker)` visible.
3. `workspace.listGroupMessages` — no marker within 20s (`count` may be >0 from older rows).
4. Harness `insertGroupMessage` → reload Pass (`engineInsertOk=true`).

---

## Owner map

```text
UI Enter
  → use-chat-actions / sendWorkspaceKernelGroupMessage
      → GroupService.sendSealedMessage  → signed NostrEvent (64-hex id)
      → publishSealedEvent (relay)      → FAIL ⇒ return error, NO commit
      → commitSealedGroupMessages(id=event.id)
          → appendGroupThreadMessage
              → suspend if missing id OR UUID-shaped id
              → else insertWorkspaceGroupMessageRecord (workspace-engine)
```

### Facts

| Fact | Evidence |
|------|----------|
| Sealed send already has **nostr event id after sign** | `cryptoService.signEvent` → `event.id` |
| SQLite commit runs **only after** successful publish | `workspace-kernel-write-port.ts` order: publish then commit |
| UUID suspend in `appendGroupThreadMessage` is intentional for DM-style optimistic rows | `group-thread-append.test.ts` · DM `message-persistence-service` |
| Product group path should not hit UUID suspend when using `event.id` | Kernel write uses `event.id` |

### Root class

**Client durability gap:** local sealed group durability is coupled to relay publish success. When publish is slow/fails (or UI visibility is not proof of commit), reload loses the send. Not a second owner — reorder existing owner.

Provider-down public relays are out of scope for B (charter E / Wave A probe).

---

## Non-goals

- Persist UUID-only placeholders into SQLite (keeps DM REL invariant).
- Claim public Nostr fixed.
- Production community un-pause.

---

## Design direction

1. After successful **sign**, always `commitSealedGroupMessages` with nostr `event.id` (before or regardless of publish outcome).
2. Publish remains required for network delivery; failure returns honest `ok:false` / queued status but **does not erase** local SQLite row.
3. Legacy `use-chat-actions` non-kernel branch: same order.
4. Keep UUID suspend in `appendGroupThreadMessage`.
5. U2: prefer product path; remove engine-insert bridge when L3 Pass without it.
