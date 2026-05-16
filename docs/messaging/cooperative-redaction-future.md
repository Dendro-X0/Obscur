# Cooperative Message Redaction (Future — v1.6+)

**Status:** Design target — **not** v1.5.0 ship scope.  
**Replaces:** “Delete for everyone” as a false centralized-delete promise.

---

## What we can honestly ship on this stack

Nostr relays store **immutable signed events**. No client can guarantee global erasure. What **is** feasible:

| Property | Feasible? | Mechanism |
|----------|-----------|-----------|
| Hide on cooperating Obscur clients | **Yes** | Single canonical message id + display gate + projection `DM_REMOVED` |
| Hide after restore | **Yes** | Account event log redaction + restore materialization contract |
| Prevent non-cooperating clients from ever seeing content | **No** | They can fetch events before redaction |
| Single id across sender/receiver | **Yes** (required) | Rumor id (NIP-17) written at send **and** projection ingest |

This is **cooperative redaction** (sender-initiated hide), not deletion.

---

## v1.5.0 decision

- UI **“Delete for everyone”** disabled (`DM_DELETE_FOR_EVERYONE_UI_ENABLED = false`).
- Experimental code paths remain for engineering (`dm-redaction-display-gate`, receive pipeline).
- See [redaction-v1.5-deferred.md](./redaction-v1.5-deferred.md) and [deletion-roster-limitations.md](./deletion-roster-limitations.md).

---

## v1.6+ canonical design (minimal, shippable)

### 1. One message identity contract

At **send** and **receive**:

- `message.canonicalId` = NIP-17 rumor event id (or NIP-04 event id for legacy).
- Gift-wrap outer id = `relayPublishedEventId` only — never `message.id` in projection.

### 2. One redaction command contract

```text
__dweb_cmd__delete:{ "type":"message_delete_v1", "targetMessageIdentityIds":["<canonicalId>"], ... }
```

- `e` tags on gift wrap = same canonical ids only.
- No legacy JSON `{"type":"delete"}` in production.

### 3. One read path

```
relay delete event → expand ids (thread gather + derive) → display gate Set → projection DM_REMOVED → ChatView filter
```

**Single owner:** `applyCooperativeRedaction()` — no parallel bus/controller/filter paths.

### 4. One UI rule

- Menu: “Remove for everyone” (honest copy).
- Success = row hidden locally **and** delete command published with relay evidence.
- Never claim recipient proof in UI.

### 5. Optional enhancement (later)

- **Content fingerprint** fallback: hash(sender, createdAt, contentPrefix) for rows that predate id contract.
- **Relay hint list** in profile metadata (non-authoritative).

---

## Test gate (before re-enabling UI)

1. Two clients, NIP-17 DM, wait for `eventId` on sender.
2. Sender redacts; B must hide within one projection replay cycle.
3. B restart + restore — message must not resurrect.
4. `pnpm verify:dm-redaction` + manual A/B checklist in [dm-redaction-action-plan.md](./dm-redaction-action-plan.md).

---

## References

- [investigation-delete-for-everyone.md](./investigation-delete-for-everyone.md) — why v1.5 patches failed
- [encyclopedia/17-dm-delete-restore-divergence-incident.md](../encyclopedia/17-dm-delete-restore-divergence-incident.md)
- [gateway/client-unified-gateway.md](../gateway/client-unified-gateway.md) — ClientGateway must own redaction apply
