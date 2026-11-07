# Investigation — Reconnect invitation skips Requests tab (2026-11-07)

```text
HANDOFF ATOMIC STEP: PLATFORM REWRITE BAND — delete/reconnect L2 landed; Partial Requests card follow-up
PAUSED: Soft L3 · Tor · Matrix promote · Continuity promote
CANONICAL OWNER: connection-handshake-machine · use-requests-inbox (merge) · contact-request-incoming-lifecycle · dm-controller contact_sandbox
PROOF: L1 handshake + merge + lifecycle unit · L2 optional re-soak Requests pending card
```

## Operator evidence (L2 soak)

Source: `docs/handoffs/contact-delete-reconnect-l2-soak-2026-11-07.{md,json}`

| Observation | Result |
|-------------|--------|
| Remove → peer cancel notify | Pass — Network 0 · "Connection removed" |
| Reconnect Send Invitation | Pass — "Invitation delivered" |
| Peer thread | Pass — second Hello appears in **existing DM thread** |
| Peer Requests / Invitations | **Partial** — empty ("No open requests") |

Actors: Tester1 remover ↔ Tester2 peer · projection-read authority on (static-dev).

## Residue map

| Residue | Owner | Effect |
|---------|-------|--------|
| `transitionHandshake(accepted, CANCEL)` is a no-op | `connection-handshake-machine` | Remote remove notify cannot demote legacy inbox from `accepted` |
| Cancel path calls `setStatus(canceled)` | `contact-request-incoming-lifecycle` | No-op while legacy is `accepted`; leaves sticky accepted mirror |
| `CONTACT_REMOVED` deletes projection only | account-event-reducer | Projection empty after cancel; legacy mirror untouched |
| `upsertIncoming` early-returns when `!shouldWriteLegacyContacts` | `use-requests-inbox` | Live reconnect cannot rewrite legacy via inbox upsert |
| Merge prefers legacy `accepted` over projection `pending` | `use-requests-inbox` state merge | After `CONTACT_REQUEST_RECEIVED`, Accept card suppressed |
| Merge prefers legacy outgoing open (`canceled`) over projection pending | same | Even if cancel stub exists, reconnect shows wrong/terminal row |

## Causal chain (peer after Remove → reconnect)

1. Peer had legacy `accepted` (they accepted the first invite).
2. `connection-cancel` → `unacceptPeer` (trust cleared) + `setStatus(canceled)` **fails to change** legacy (accepted terminal except `RESET`).
3. `CONTACT_REMOVED` drops projection contact → Requests projection rows gone.
4. Reconnect `connection-request` → message appended to existing DM conversation (Hello visible).
5. `CONTACT_REQUEST_RECEIVED` recreates projection `pending` / incoming.
6. `upsertIncoming` no-ops under projection-write policy.
7. Merge: legacy `accepted` sticky wins → merged status `accepted` → **not** a Requests-tab item → empty panel.
8. Operator sees Hello in thread + empty Requests — exact Partial.

Reducer unit already allows `REMOVED → REQUEST_RECEIVED → pending`. Failure is **legacy sticky + merge**, not the reducer.

## Non-causes (ruled out this cut)

- `shouldIgnoreIncomingForExistingRequest` for `canceled` — correctly reopens (`shouldProcessAsNewRequest`).
- Missing `connection-request` tag on send — Invitation delivered + Hello with request copy.
- Soft L3 / Tor / Matrix.

## Smallest fix direction (design next)

1. Allow `accepted → CANCEL` in handshake machine (remote remove is bilateral reset).
2. Prefer projection **incoming pending** over legacy accepted/canceled stubs in inbox merge.
3. Cancel lifecycle: clear peer via inbox `remove` (or equivalent) so legacy mirror matches `CONTACT_REMOVED`, not a fake outgoing canceled stub.

## Out of scope

- Packaged NSIS re-soak (optional after L1).
- Soft L3 / Tor / Matrix.
- Dual blocklist merge.
