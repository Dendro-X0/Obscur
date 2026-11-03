# Design — P4b private_dc HTTP wire (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-p4-second-carrier-design-2026-11.md](./platform-p4-second-carrier-design-2026-11.md)  
**Handoff:** P4b private_dc HTTP wire

```text
HANDOFF ATOMIC STEP: P4b private_dc HTTP wire — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL · private-dc-client / private-dc-adapter
PROOF:               L1 vitest Pass (client + adapter + P4 contract + migration-hints)
```

## 1. Goal

Replace L1 fail-closed stub send/list with a **minimal HTTPS JSON wire** against the configured `baseUrl`, so `private_dc` exercises real adapter I/O behind P3 ports.

## 2. Wire contract (Obscur private DC v0)

All paths relative to session `baseUrl` (no trailing slash). Optional `Authorization: Bearer {token}`.

| Method | Path | Body / query | 2xx JSON |
|--------|------|--------------|----------|
| `GET` | `/v1/conversations` | — | `{ "conversations": [ { "id", "title" } ] }` |
| `GET` | `/v1/conversations/{id}/messages` | `?limit=` optional | `{ "messages": [ { "id", "conversationId", "body", "sentAtUnixMs", "direction", "status?" } ] }` |
| `POST` | `/v1/conversations/{id}/messages` | `{ "body": string }` | `{ "message": { …CanonicalMessage fields } }` |

**Fail-closed:** non-2xx, invalid JSON, or missing required fields → throw `private_dc_http_*` (no Nostr fallback).

**Out of scope:** E2EE, groups, media, Tor Verified, Matrix promote, identity bind.

## 3. Impl slice

1. `private-dc-client.ts` — `fetch` helpers + DTO normalize → canonical types.
2. `private-dc-adapter.ts` — `listConversations` / `listMessages` / `sendMessage` call client; keep connect/disconnect transport latch.
3. Vitest: mock `fetch` happy path + 401/malformed fail-closed.
4. Update P4 parent status; Settings copy may note “HTTP wire L1”.

## 4. Proof

| Layer | Check |
|-------|--------|
| L1 | client + adapter tests Pass · P4 import boundary still Pass |
| L2 | **Lab Pass (P4c)** — local `/v1` server + client live-fetch · company DC operator soak still optional |

## 5. Non-claims

- Not production DC interoperability / multi-protocol done
- Not Soft L3 / Tor Verified / Matrix promote
