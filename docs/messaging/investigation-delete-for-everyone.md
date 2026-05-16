# DM Delete for Everyone Investigation Findings

_Last reviewed: 2026-05-14 (baseline commit 0406143c)._

**Queue:** Ongoing product-truth status for delete/receive/DM restore lives in [`docs/program/v1.5.0-known-issues-and-investigation-queue.md`](../program/v1.5.0-known-issues-and-investigation-queue.md) (**DM-006**, **DM-007**, etc.). The unwired `dm-delete-subscription.ts` helper was **removed 2026-05-13** — it was never integrated; v2 ingress is **`dm-relay-transport.subscribeToIncomingDMs`** only.

**Investigation Date:** 2026-05-07
**Feature Status:** Broken by relay/data sync refactoring after v1.3.15
**Investigation Method:** Diagnostic instrumentation + code tracing
**Conclusion:** Feature is architecturally incompatible with current relay/sync layer

---

## Problems Discovered

### 1. Missing Recipient Tag in Delete Command Event

**Location:** `apps/pwa/app/features/messaging/controllers/v2/dm-controller.ts`

**Issue:** Delete command publish was missing the `"#p"` tag that identifies the recipient.

**Impact:** V2 relay transport subscription filter requires `"#p": [myPublicKeyHex]` to receive incoming DMs. Without this tag, recipient's subscription filter doesn't match the delete command event, so recipient receives unrelated events instead.

**Evidence:**
- Sender published event ID: `6dbb4389e5ed1859`
- Recipient received event ID: `711d6e2b8e790ad0` (different event)
- Recipient classified received event as `normal_plaintext`, not `delete_prefix`

**Attempted Fix:** Added `["p", delParams.peerPublicKeyHex]` to delete command publish customTags.

**Status:** Unknown if this fix resolves the issue, as user reports the feature is fundamentally broken by architectural changes.

---

### 2. Recipient Event Deduplication Occurred Before Decryption

**Location:** `apps/pwa/app/features/messaging/controllers/v2/dm-receive-pipeline.ts`

**Issue:** Deduplication was keyed by wrapper event ID and occurred before decryption. This caused recipient events to be skipped as "already processed" even when they were new events.

**Impact:** Recipient never processed delete command events because they were incorrectly marked as already processed.

**Attempted Fix:** Moved deduplication after successful decrypt and keyed it by decrypted canonical event/rumor ID.

**Status:** Fixed, but did not resolve the core issue.

---

### 3. Diagnostic Investigation Revealed Event ID Mismatch

**Method:** Added diagnostic logging at multiple boundaries:
- `dm_sender_plaintext_fingerprint` - logs sender plaintext before encryption
- `dm_receive_plaintext_classified` - logs recipient plaintext after decryption
- `v2_subscription_event_received` - logs raw relay events
- `dm_process_result` - logs event processing results

**Finding:** Sender IS encoding delete command correctly (`delete_prefix_present`), but recipient receives a completely different event with a different ID.

**Conclusion:** This is a relay subscription/delivery issue, not an encoding issue.

---

### 4. Multiple Parallel Delete Paths Exist

**Locations:**
- `apps/pwa/app/features/main-shell/hooks/use-chat-actions.ts` - Legacy UI delete path
- `apps/pwa/app/features/messaging/controllers/v2/dm-controller.ts` - V2 controller delete path
- `apps/pwa/app/features/messaging/deletion/message-deletion-coordinator.ts` - New deletion coordinator
- Legacy `dm-delete-pipeline.ts` (not fully explored)
- Legacy message tombstone suppression (not fully explored)

**Issue:** Multiple code paths for deletion, unclear which is canonical.

**Impact:** Confusion about which path is actually used by UI, difficulty in debugging.

---

### 5. V2 Relay Transport Subscription Filters May Not Cover All Event Types

**Location:** `apps/pwa/app/features/messaging/controllers/v2/dm-relay-transport.ts`

**Current Filters:**
```typescript
{
  kinds: [4, 1059],
  "#p": [myPublicKeyHex],
  limit: 50,
  since: sinceUnixSeconds,
},
{
  kinds: [4],
  authors: [myPublicKeyHex],
  limit: 50,
  since: sinceUnixSeconds,
}
```

**Issue:** Filters use `since` with 30-second skew. Events older than 30 seconds are not received. May miss delete commands if timing is off.

**Impact:** Recipient may not receive delete command if it's published outside the time window.

---

## Architectural Changes Between v1.3.15 and Current

**Unknown:** Not investigated in this session. User reports that relay and data synchronization refactoring broke the feature.

**User Statement:** "Since modifying modules like relay and data synchronization, the end-to-end delete functionality has become obsolete, only available in v1.3.15."

---

## Diagnostic Instrumentation Added

The following diagnostic channels were added to trace the delete-for-everyone flow:

- `messaging.delete_for_everyone_requested` - Sender requests delete
- `messaging.delete_for_everyone_rejected` - Delete rejected (permission, etc.)
- `messaging.delete_for_everyone_remote_result` - Multi-channel diagnostics:
  - `dm_sender_plaintext_fingerprint` - Sender plaintext before encryption
  - `dm_sender_publish` - Sender publish success
  - `v2_subscription_started` - Recipient subscription started
  - `v2_subscription_event_received` - Recipient received raw event
  - `dm_receive_plaintext_classified` - Recipient plaintext after decryption
  - `dm_receive_parse` - Recipient parsed command
  - `dm_receive_classified` - Recipient classified action
  - `dm_process_result` - Recipient event processing result
  - `coordinator_decode` - Coordinator decoded command
  - `coordinator_permission` - Coordinator permission check
  - `coordinator_store` - Coordinator stored tombstone
  - `coordinator_ingest` - Coordinator ingestion result

---

## Files Modified During Investigation

1. `apps/pwa/app/features/messaging/controllers/v2/dm-controller.ts` - Added diagnostics, added #p tag
2. `apps/pwa/app/features/messaging/controllers/v2/dm-receive-pipeline.ts` - Moved dedup after decrypt, added diagnostics
3. `apps/pwa/app/features/messaging/controllers/v2/dm-relay-transport.ts` - Added subscription diagnostics
4. `apps/pwa/app/features/messaging/deletion/message-deletion-coordinator.ts` - Added coordinator diagnostics
5. `apps/pwa/app/features/messaging/utils/commands.ts` - Updated delete command parsing
6. `apps/pwa/app/features/messaging/controllers/incoming-dm-event-handler.ts` - Added enhanced path diagnostics
7. `apps/pwa/app/features/messaging/controllers/dm-subscription-manager.ts` - Added subscription diagnostics
8. Various test files - Added regression tests

---

## Tests Added

- `dm-receive-pipeline.test.ts` - Test for decrypt failure not poisoning dedup cache
- `dm-receive-pipeline.test.ts` - Test for versioned delete command parsing
- `incoming-dm-event-handler.test.ts` - Test for versioned delete commands being applied
- `message-deletion-coordinator.test.ts` - Updated for explicit local-public-key contract

All tests pass, but feature still fails in runtime.

---

## Conclusion

The DM delete-for-everyone feature is broken by architectural changes in the relay and data synchronization layers. The investigation revealed multiple issues (missing #p tag, premature deduplication, event ID mismatch), but the user reports that the feature is fundamentally incompatible with the new architecture.

**Recommendation:** Either revert to v1.3.15, disable the feature entirely, or conduct a comprehensive architectural comparison between v1.3.15 and current to understand what broke and whether it can be fixed without reverting.
