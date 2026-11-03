# Design — P4 second carrier spike (2026-11)

**Status:** Design + L1 spike + P4b HTTP wire landed  
**Parent:** [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)  
**Related:** [pal-port-freeze-p3-design-2026-11.md](./pal-port-freeze-p3-design-2026-11.md) · [platform-boundary-map-2026-11.md](./platform-boundary-map-2026-11.md) · [platform-p4b-private-dc-http-wire-design-2026-11.md](./platform-p4b-private-dc-http-wire-design-2026-11.md)

```text
HANDOFF ATOMIC STEP: P4 / P4b private_dc — DONE L1 (HTTP /v1 wire)
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL (`protocol-adaptation/`)
PROOF:               stub L1 + P4b client/adapter vitest Pass
SURFACE:             Settings configure + HTTPS JSON; no multi-protocol Verified claim
```

## 1. Pick (this cut)

**Second carrier = private DC / custom server (`private_dc`), not Matrix promotion.**

| Option | Why not / why yes |
|--------|-------------------|
| **Matrix lab → promote** | **Rejected for P4.** Matrix stays lab (access-token). Promote needs Olm-class design+proof; handoff PAUSED for Matrix promote. |
| **Private DC** | **Selected.** Matches charter “private-trust / own infra” face and security-law company-DC story. Proves PAL hosts a third adapter without touching Nostr leaf imports. |

Matrix adapter remains registered and selectable as **lab**; this cut does not widen Matrix claims.

## 2. Goal

Prove the frozen P3 surfaces can route a **non-Nostr, non-Matrix** carrier:

| Surface | Behavior under `private_dc` |
|---------|------------------------------|
| Canonical `listConversations` / `listMessages` / `sendMessage` | Adapter owns; HTTPS JSON `/v1/conversations` (P4b) |
| Rich `sendDm` | Layer shim → `privateDcAdapter.sendMessage` (conversation id = peer/room handle) |
| `sendDmNostrOnly` | **Unchanged** — always Nostr (delete/retry) |
| Transport (`clearnet` / `tor` / `quiet`) | Connect records preference; Tor Verified **not** claimed |

## 3. L1 spike (this impl)

1. `ProtocolId` += `"private_dc"`; `SELECTABLE_PROTOCOL_IDS` includes it.
2. `private-dc-session.ts` — profile-scoped `{ baseUrl, bearerToken?, displayName? }` (localStorage), mirror Matrix session shape.
3. `private-dc-adapter.ts` — implements `ProtocolAdapter`:
   - `capabilities`: `{ dms: true, groups: false, reactions: false, media: false }`
   - `connect` / `disconnect`: record transport; no Tor Verified
   - lists / send: P4b `private-dc-client` HTTPS JSON (fail-closed `private_dc_http_*`; no silent Nostr fallback)
4. Layer: register adapter; `setActiveProtocolId("private_dc")` requires session (like Matrix).
5. Settings → Protocols: configure base URL (+ optional token); enable select when session saved.
6. Contract: registry contains `private_dc`; features outside `protocol-adaptation/` must not import `private-dc-adapter`.

## 4. Deferred (post-P4b)

- L2 soak against a live company DC server
- E2EE / identity bind for DC accounts
- Bridging Nostr ↔ DC
- Matrix Olm / promote

## 5. Non-claims

- Not “multi-protocol shipping”
- Not Matrix promote / Soft L3 / Tor Verified
- Not production DC interoperability

## 6. Proof

| Layer | Check |
|-------|--------|
| L1 | vitest: session · P4b client/adapter mocked fetch · layer registry · import boundary |
| L2+ | Live DC HTTP soak (operator) |

## 7. Status

- Design: **written** (pick = `private_dc`)
- L1 spike: **landed** — session · adapter · layer registry · Settings configure · contracts Pass
- P4b HTTP wire: **landed** — `/v1/conversations` client · adapter · Settings copy · L1 vitest Pass
- Next: P2 daily-door L3 · or Private DC L2 soak · Matrix promote still PAUSED
