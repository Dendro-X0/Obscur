# Design — Group send: persist after sign (nostr id), not after publish

**Status:** Ready to implement  
**Date:** 2026-07-31 (UTC)  
**Investigation:** [group-send-optimistic-durability-investigation-2026-07.md](./group-send-optimistic-durability-investigation-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  B — Optimistic group-send durability
CANONICAL OWNER:      sendWorkspaceKernelGroupMessage (+ legacy use-chat-actions branch)
PROOF:                L1 write-port persists when publish throws · append still suspends UUID · U2 L3 when fixtures allow
```

---

## Invariants

1. One SQLite write owner: `appendGroupThreadMessage` → workspace-engine.
2. Never persist UUID-only event ids.
3. Sealed group outbound uses signed nostr `event.id` (≥64 hex from sign).
4. Local durability ≠ network truth: UI may show queued/failed publish while SQLite has the row.

---

## Change

### 1. `sendWorkspaceKernelGroupMessage`

Order:

1. `sendSealedMessage` (sign)  
2. `commitSealedGroupMessages` with `event.id`  
3. `publishSealedEvent`  

If publish throws: still return `{ ok: false, errorMessage }` **after** commit, or `{ ok: true, message, publishOk: false }` — prefer **fail publish with durable local**:

```typescript
await commitSealedGroupMessages(...);
try {
  await params.publishSealedEvent(...);
} catch (error) {
  // local row exists; surface publish failure
  return { ok: false, errorMessage: ..., message }; // or ok:true + publishFailed
}
return { ok: true, message };
```

**Chosen:** return `{ ok: true, message, relayPublished: boolean }` so UI can toast soft “queued / relay failed” without wiping the thread. If existing callers only check `ok`, keep `ok: true` when commit succeeded and set `relayPublished: false` on publish failure (honest delivery).

Minimal compatibility: extend result with optional `relayPublished?: boolean` (default true on success path). On publish failure after commit: `{ ok: true, message, relayPublished: false }`.

### 2. Legacy branch in `use-chat-actions`

Same order: sign → commit → publish. On publish failure after commit: toast warn, do not restore input wipe of already-emitted message.

### 3. Unchanged

- `appendGroupThreadMessage` UUID suspend  
- DM persistence policy  

### 4. U2 soak (follow-up)

Poll product path first; keep engine-insert only as documented fallback if relay/sign broken — prefer Pass without bridge after B.

---

## Tests (L1)

| Case | Expect |
|------|--------|
| Write-port: publish throws after sign | `commitSealedGroupMessages` called; result `ok: true`, `relayPublished: false` |
| Write-port: publish ok | `relayPublished: true` |
| Append: UUID still suspended | unchanged |
| Append: 64-hex persists | unchanged |

---

## Desktop / L3 note

Product B lands at L1 in this slice. Full U2 without engine-insert bridge requires a desktop shell rebuilt with this write-port change. Sequence **C** covers Wave A transport desktop evidence; re-run `pnpm verify:u2-l3` after rebuild when claiming B L3 without harness bridge.

1. User sends in NewTest 2; room key present; local relay down.  
2. Sign succeeds → SQLite insert with nostr id.  
3. Publish fails → toast soft; message remains in thread + SQLite.  
4. Reload → `listGroupMessages` includes plaintext.  
5. Neighbors: DM UUID path untouched; no second insert owner.
