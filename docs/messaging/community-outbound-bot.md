# Community outbound bot (B1)

**Milestone:** v1.8.11 · **Roadmap:** [v1.8.9-plus-managed-workspace-roadmap.md](../program/v1.8.9-plus-managed-workspace-roadmap.md) Theme 2

---

## Purpose

Managed workspaces need **announcement bots** (status, CI, steward notices) on the **same sealed relay plane** as human members — not a parallel HTTP API.

**B1 scope:** outbound publish only. The bot runner signs sealed group messages; Obscur clients display them like any other member message.

---

## Architecture

```text
Bot runner (sidecar / VPS)
  ├─ config: nsec, communityId, groupId, relay URL, room key
  ├─ publish: GroupService sealed kind 1 (announcement)
  └─ no subscribe-to-DM / no governance actions (B1)

Human clients  ←→  Operator relay  ←→  Bot runner
Descriptor       ←  botPubkeys allowlist on community metadata
```

---

## Descriptor contract

| Field | Type | Semantics |
|-------|------|-----------|
| `botPubkeys` | `string[]` (64-char hex) | Outbound-only bot identities allowed to publish on this managed workspace |

Carried in:

- Sealed `community.descriptor_updated` / `community.created` metadata (`GroupService`)
- Public kind **39000** relay hint JSON (`sendRelayMetadataHint`)

### Client behavior

- Stewards register bots in **Manage → General → Outbound bots**.
- When `botPubkeys.length > 0` on a **managed_workspace**, chat ingest accepts messages only from **active members**, **stewards**, or **listed bots** (`evaluateCommunityChatMessageIngest`).
- Empty `botPubkeys` keeps legacy permissive ingest (until bots are registered).

### Runner

**Script:** `pnpm community-outbound-bot` (see `scripts/community-outbound-bot.mjs`)

| Variable | Purpose |
|----------|---------|
| `OBSCUR_BOT_NSEC` | Bot signing key (nsec or hex) |
| `OBSCUR_BOT_RELAY_URL` | Operator workspace relay |
| `OBSCUR_BOT_GROUP_ID` | Sealed group id |
| `OBSCUR_BOT_ROOM_KEY_HEX` | Room key from steward export |
| `OBSCUR_BOT_MESSAGE` or `--message` | Announcement text |
| `OBSCUR_BOT_ALLOWED_PUBKEYS` | Comma-separated allowlist (recommended; must match descriptor `botPubkeys`) |

```bash
OBSCUR_BOT_NSEC=nsec1… \
OBSCUR_BOT_RELAY_URL=ws://127.0.0.1:7000 \
OBSCUR_BOT_GROUP_ID=<group-id> \
OBSCUR_BOT_ROOM_KEY_HEX=<64-hex> \
OBSCUR_BOT_ALLOWED_PUBKEYS=<bot-pubkey-hex> \
pnpm community-outbound-bot --message "Deploy succeeded"
```

Use `--dry-run` to build and validate the event without publishing.

**Rate limit (default):** 6 messages/min per community — steward-configurable in B2.

---

## Safety

- No admin, expel, hide, or vote actions in B1.
- Bot messages are **visible** in chat (not silent/system channel).
- Off-relay copies follow same honesty as D1/D2 deletion docs.

---

## Verification

Manual: [v1.8.11 demo matrix](../assets/demo/v1.8.11/README.md) Test B1.

Automated (planned): contract smoke for descriptor parse + publish payload shape.

---

## Related

- [managed-workspace-relay-deletion.md](./managed-workspace-relay-deletion.md)
- Dev-only mock: `apps/pwa/app/features/dev-tools/bot-engine.ts` (not production path)
