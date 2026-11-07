# Investigation — Contact delete / block leaves reconnect residue (2026-11-06)

```text
HANDOFF ATOMIC STEP: operator cold-run Exact Match + Decline/reconnect on packaged face
PAUSED: Soft L3 · Tor · Matrix · Continuity promote
CANONICAL OWNER: network-profile-view · use-requests-inbox · peer-trust · account-event-reducer · contact-request-incoming-lifecycle · search-page-client
PROOF: L1 reducer/inbox/ignore · L2 DemoUser remove Tester1 → Connect delivers → Tester1 sees pending
```

## Operator evidence

- Discovery Recent Searches has no clear control.
- DemoUser views Tester1 as **STRANGER** with **Connect** after delete, but cannot successfully resend a contact request.
- Suspected residual placeholder relationships after delete/block.

## Residue map (owners)

| Residue | Owner | Effect |
|---------|-------|--------|
| `confirmRemove` → `unacceptPeer` then `requestsInbox.remove` | network-profile-view | Remove emits `CONTACT_REMOVED` then often `CONTACT_CANCELED`/`CONTACT_DECLINED` |
| Projection keeps non-`none` contacts as inbox rows | `selectProjectionRequestsInboxItems` | `canceled`/`declined` rows stay visible as placeholders |
| `requestsInbox.remove` early-return when `!shouldWriteLegacyContacts` | use-requests-inbox | Skips local item delete + evidence clear on projection-write path |
| Incoming `connection-cancel` does **not** `unacceptPeer` | contact-request-incoming-lifecycle | Peer stays TRUSTED after remote cancel/remove notify |
| `shouldIgnoreIncomingForExistingRequest` ignores when `accepted` | use-requests-inbox | Fresh `connection-request` dropped if peer still trusts you |
| Remove does not notify peer / does not purge DM row | network-profile-view | Remote trust + local chat stub survive |
| Dual blocklists (`obscur.blocklist.v1.*` vs `dweb.nostr.pwa.blocklist.*`) | network + messaging hooks | Block state can diverge across surfaces |
| Recent searches write-only | search-page-client | No clear affordance |

## Root causes (reconnect)

1. **Local remove is not a bilateral handshake reset.** DemoUser becomes STRANGER; Tester1 can remain accepted. New invites are ignored as duplicates against accepted.
2. **Cancel/remove wire path does not demote trust** on the receiver (`connection-cancel` skips `unacceptPeer`).
3. **Projection placeholder:** `CONTACT_CANCELED` after `CONTACT_REMOVED` recreates a non-`none` contact row.
4. **Inbox remove incomplete** on legacy-writes-disabled path.

## Discovery clear history

Recent searches live in scoped `localStorage` (`recent_searches` / legacy key). UI lists them with no clear control — product gap, not a trust bug.

## Out of scope this cut

- Merging dual blocklist stores into one owner (document only; fix if blocking Connect for DemoUser).
- Soft L3 / Tor / Matrix.
