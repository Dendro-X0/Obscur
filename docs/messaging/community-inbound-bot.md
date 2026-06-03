# Community inbound bot (B2)

**Milestone:** v1.8.x batch lane · **Roadmap:** [v1.8.9-plus-managed-workspace-roadmap.md](../program/v1.8.9-plus-managed-workspace-roadmap.md) Theme 2 · B1 outbound shipped in v1.8.11

---

## Purpose

Managed workspaces need **inbound bot triggers** on the same sealed relay plane as human members — keyword replies, @mention replies, and scheduled check-ins.

**B2 scope:** subscribe to sealed group chat, match steward-configured triggers, publish sealed replies. No webhooks (B3) or governance actions.

---

## Architecture

```text
Bot runner (sidecar / VPS)
  ├─ subscribe: kind 10105 sealed chat (#h group tag)
  ├─ config: triggers from descriptor botTriggers or env JSON
  ├─ match: keyword / mention / schedule
  └─ publish: sealed kind 9 reply (same path as B1 outbound)

Human clients  ←→  Operator relay  ←→  Bot runner
Descriptor       ←  botPubkeys + botTriggers on community metadata
```

---

## Descriptor contract

| Field | Type | Semantics |
|-------|------|-----------|
| `botTriggers` | array | Per-bot inbound rules (must reference a registered `botPubkeys` entry) |

Each entry:

| Field | Type | Semantics |
|-------|------|-----------|
| `botPubkey` | 64-char hex | Bot identity (must be in `botPubkeys`) |
| `enabled` | boolean | Master switch — steward disables all triggers for this bot |
| `triggers` | array | Individual rules |

Each rule:

| Field | Type | Semantics |
|-------|------|-----------|
| `kind` | `"keyword"` \| `"mention"` \| `"schedule"` | Match mode |
| `enabled` | boolean | Rule-level switch |
| `reply` | string | Reply text; supports `{{author}}` and `{{content}}` |
| `keywords` | string[] | Required for `keyword` — case-insensitive substring match |
| `intervalMinutes` | number | Required for `schedule` — 1–1440 minutes between ticks |

Carried in sealed `community.descriptor_updated` metadata and kind **39000** relay hint JSON (same as B1 `botPubkeys`).

### Client behavior

- Stewards configure triggers in **Manage → General → Inbound triggers (B2)**.
- Triggers are sanitized to registered outbound bots only.
- Disabled bots or rules are ignored by the runner.

---

## Runner

**Generate bot key** (use this instead of ad-hoc `node -e` — `@noble/curves` resolves via the PWA bundle):

```bash
pnpm community-bot:generate-key -- --nsec
```

**Script:** `pnpm community-inbound-bot`

| Variable | Purpose |
|----------|---------|
| `OBSCUR_BOT_NSEC` | Bot signing key (nsec or hex) |
| `OBSCUR_BOT_RELAY_URL` | Operator workspace relay |
| `OBSCUR_BOT_GROUP_ID` | Sealed group id |
| `OBSCUR_BOT_ROOM_KEY_HEX` | Room key from steward export |
| `OBSCUR_BOT_ALLOWED_PUBKEYS` | Comma-separated allowlist (must match descriptor `botPubkeys`) |
| `OBSCUR_BOT_INBOUND_TRIGGERS_JSON` | Optional inline triggers (else fetches kind 39000 hint) |
| `OBSCUR_BOT_RATE_LIMIT_PER_MIN` | Default **6** replies/min per community |

```bash
OBSCUR_BOT_NSEC=nsec1… \
OBSCUR_BOT_RELAY_URL=ws://127.0.0.1:7000 \
OBSCUR_BOT_GROUP_ID=<group-id> \
OBSCUR_BOT_ROOM_KEY_HEX=<64-hex> \
OBSCUR_BOT_ALLOWED_PUBKEYS=<bot-pubkey-hex> \
pnpm community-inbound-bot
```

Use `--once` to validate config and exit without subscribing.

---

## Rate limits

- **Default:** 6 sealed replies per minute per community (shared across keyword, mention, and schedule).
- When the limit is reached, the runner logs and skips the reply — it does not queue or burst.
- Stewards see the default documented in Manage → General → Inbound triggers.

---

## Safety

- Bot must appear in `botPubkeys` allowlist (same as B1).
- Runner ignores its own messages (no self-reply loops).
- No admin, expel, hide, or vote actions in B2.
- Off-relay copies follow same honesty as B1/D1/D2 deletion docs.

---

## Verification

Manual: [deferred-manual-verification-checklist.md](../program/deferred-manual-verification-checklist.md) §3 rows B-02, B-03.

Automated:

- `pnpm test:community-inbound-bot`
- `pnpm test:community-bot-descriptor` (includes `community-bot-triggers-policy.test.ts`)
- `pnpm ci:community-bot-descriptor-smoke`

---

## Related

- [community-outbound-bot.md](./community-outbound-bot.md) (B1)
- [v1.8.x-batch-implementation-lane.md](../program/v1.8.x-batch-implementation-lane.md) Wave 2
