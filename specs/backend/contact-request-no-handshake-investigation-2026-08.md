# Investigation: Contact Request Auto-Trust — No Two-Way Handshake

**Date:** 2026-08-18  
**Tag:** v1.9.16  
**Band:** Connection Request Flow  
**Status:** Root cause confirmed — fix designed  
**Symptom:** Sending a connection request immediately shows the recipient as **TRUSTED** in All People, without the other party accepting.

---

## Symptom

After sending a connection request via Discovery → Add, the target peer appears in the sender's Network → All People list with the **TRUSTED** badge immediately. No acceptance event has been received.

## Root Cause

### Path 1 — `extractAcceptedPeersFromPersistedChatState` trusts all `createdConnections`

```
apps/pwa/app/features/network/hooks/use-peer-trust.ts:137-141
```

```ts
const acceptedFromConnections: ReadonlyArray<PublicKeyHex> = (persisted.createdConnections ?? [])
  .map((connection) => normalizePublicKeyHex(connection.pubkey))
  .filter((peer): peer is PublicKeyHex => peer !== null);

return Array.from(new Set([...acceptedFromRequests, ...acceptedFromConnections]));
```

Every entry in `createdConnections` (from `connectionStore.getAllConnections()`) is treated as accepted/trusted. There is **no status guard**.

### Path 2 — `connectionStore.addConnection()` called on accept (correct), but `createdConnections` is loaded unconditionally

`use-conversations.ts:19-20` hydrates `createdConnections` from `connectionStore.getAllConnections()` on mount. All connections in IndexedDB, regardless of how they were created, surface as trusted peers.

### Path 3 — Legacy `inviteRequestStateBridge` may create a connection entry without a real accept handshake

`invite-manager.acceptConnectionRequest()` (line 800) calls `connectionStore.addConnection()` only on explicit accept. However, `inviteRequestStateBridge.accept()` (line 770) is a delegated bridge whose behavior depends on caller context — in the main-shell it routes through `request-transport-service.acceptIncomingRequest`, which does the right thing. The IndexedDB path is correct when properly exercised.

### Real problem: missing `handshakeStatus` on `Connection`

The `Connection` type in `connection-store` has `trustLevel: 'neutral' | 'trusted' | 'blocked'` but **no `handshakeStatus`** field. There is no way to distinguish:

- A connection created from a completed two-way handshake (sender sent, receiver accepted)
- A connection imported manually
- A connection whose request is still pending

`extractAcceptedPeersFromPersistedChatState` therefore has no signal to gate on — so it gates on existence alone, which is wrong.

---

## Correct Handshake Model

```
Sender (A)                           Receiver (B)
─────────────────────────────────────────────────
A sends connection-request ──────►  B inbox: pending_incoming
A state: pending_outgoing            B sees Invitations badge

                                     B taps Accept
                                     B sends connection-accept ──────►
                                     B state: accepted (TRUSTED)
                                     B: connectionStore.addConnection()

A receives connection-accept ◄──────
A state: accepted (TRUSTED)
A: connectionStore.addConnection()
```

Key invariants:
- **A** must NOT be trusted until `connection-accept` is received and processed
- **B** is trusted only after explicitly calling `acceptIncomingRequest`
- `connectionStore` entry must be created **only** at the completion of the handshake on each side

---

## Fix Design

### Option A (minimal, correct) — Guard `acceptedFromConnections` on `handshakeCompleted`

Add `handshakeCompleted: boolean` to the `Connection` type.  
Set it `true` only in `acceptConnectionRequest` (B side) and when A receives `connection-accept`.  
Change `extractAcceptedPeersFromPersistedChatState` to filter on `handshakeCompleted`.

**Pros:** Minimal diff. Backward-compatible (existing entries without flag default to `false` — they re-trust only on next accept event). Backward migration path: if a `connectionRequests` entry has `status === "accepted"` for the same pubkey, set `handshakeCompleted = true` at hydration time.  
**Cons:** Requires schema migration for existing IndexedDB data.

### Option B — Remove `acceptedFromConnections` from trust derivation entirely

Trust is derived exclusively from `acceptedFromRequests` (where `status === "accepted"`) and the explicit `acceptedPeers` localStorage list. `connectionStore` becomes a pure address book, not a trust signal.

**Pros:** Single owner for trust. Simpler. Eliminates the conflation.  
**Cons:** Existing users with trusted connections stored only in IndexedDB will lose trust state until they re-accept. Requires a one-time migration that promotes existing connections to `acceptedPeers` storage.

### Decision: Option B (subtract the faulty signal, promote existing data)

Option B aligns with the project's "fix by subtraction" principle. `createdConnections` → trust is an accidental coupling, not a design intent. The `connectionRequests` path already correctly gates on `status === "accepted"`.

Migration: on load, any existing `createdConnections` entry whose pubkey also appears in `localStorage acceptedPeers` OR in a `connectionRequests.status === "accepted"` record is preserved. Others drop to "address book only" — they appear in the DM list but not in All People as TRUSTED.

---

## Files to Change

| File | Change |
|------|--------|
| `apps/pwa/app/features/network/hooks/use-peer-trust.ts` | Remove `acceptedFromConnections` leg from `extractAcceptedPeersFromPersistedChatState` |
| `apps/pwa/app/features/network/hooks/use-peer-trust.test.ts` | Update / add tests for the corrected derivation |
| `apps/pwa/app/features/network/components/network-dashboard.tsx` | Verify "All People" list only shows accepted peers (should already be filtered via `isAccepted`) |
| `docs/handoffs/current-session.md` | Checkpoint |
| `docs/assets/demo/v2.0.0/segment-d-discovery-add-contact-v1.9.16.md` | Update brief — demo must use the fixed build |

## Out of Scope (this slice)

- Group chat two-way invite handshake (separate band, COM-RUN-01 adjacent)
- Message history cleanup after removing a pending contact (separate)
- Full `Connection.handshakeStatus` schema migration (Option A — deferred)

---

## Proof Plan

- **L1:** Unit test `extractAcceptedPeersFromPersistedChatState` — `createdConnections` alone must NOT produce accepted peers
- **L1:** Unit test — `connectionRequests[].status === "accepted"` still produces accepted peers
- **L1:** Unit test `use-peer-trust` — sending a request does not make peer accepted
- **L2:** `pnpm verify:engine-lab` green
