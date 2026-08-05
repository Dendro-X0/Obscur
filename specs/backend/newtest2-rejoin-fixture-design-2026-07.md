# Design — NewTest 2 rejoin (Slice C fixture hygiene)

**Status:** Done · 2026-07-31  
**Parent handoff:** U5 Done · optional rejoin NewTest 2

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Optional: rejoin NewTest 2 for Slice C
PAUSED / CANCELLED:   Full community · COM-RUN-* · U6 · Dev Lab as validation
CANONICAL OWNER:      joinManagedWorkspaceMembership (product) + coordination join/wrap
PROOF BEFORE DONE:    Tester1 ledger status joined for b93f53…627b
OUT OF SCOPE:         U6 · claim Slice C L3 Pass without re-run · full un-pause
```

---

## Why

U4 L3 leave set NewTest 2 to `left` + tombstone. Slice C L3 send fixture requires **joined**.

---

## Investigation (2026-07-31 CDP fail)

CDP reached Join confirm but ledger stayed `left` (`test-results/newtest2-rejoin-2026-07-31.json`).

| Hypothesis | Evidence | Verdict |
|------------|----------|---------|
| Join UI never ran | Spec reached wait loop; loose `/^join( community)?$/` may re-click Network Join | Partial |
| `GroupJoinDialog` null under kernel | Legacy sealed hook disabled; mount-once state has no metadata → `return null` | **Bug** |
| Room-key inject ignored | Harness wrote `{ roomKeyHex }` only; `roomKeyStore.readPersistedMap` requires `record.groupId` | **Bug** |
| `runtime_join_confirmed` after leave | Upsert → merge → terminal **left beats joined** | **Bug** |
| Explicit rejoin path exists | Coordinator uses `explicit_rejoin` + replace; mutation owner clears leave gates only for that reason | Owner already correct — port must use it |

**Product fix (smallest):** kernel preview metadata in `GroupJoinDialog`; `joinManagedWorkspaceMembership` persists `explicit_rejoin` when prior ledger is terminal; harness writes full `RoomKeyRecord`.

---

## Steps

1. Resolve room key from existing coordination wraps (Tester1 self-wrap); do not invent a new community key if wraps exist.  
2. Publish coordination **join** delta for Tester1 (force — community head may already exist after leave).  
3. Desktop CDP: clear NewTest 2 tombstone → inject room key (full record) → Network Join `groupId@ws://localhost:7000` → confirm.  
4. Assert ledger `status: "joined"`.

---

## Proof

```bash
pnpm rejoin:newtest2
# Evidence: test-results/newtest2-rejoin-2026-07-31.json
```

**Do not claim:** Slice C L3 Pass until `pnpm verify:slice-c-l3` is re-run.
