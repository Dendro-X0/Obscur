# Design — Public feedback release readiness (2026-11)

**Status:** A1–A5 **Pass** 2026-11-03 · ready for maintainer public feedback ask (not a Verified / Soft L3 claim)  
**Parent:** [platform-rewrite-band-milestone-closeout-2026-11.md](./platform-rewrite-band-milestone-closeout-2026-11.md) · [v2.0.0-beta.3-release.md](../../docs/releases/v2.0.0-beta.3-release.md)

```text
HANDOFF ATOMIC STEP: Public feedback ask optional — A1–A5 Pass · no git tag until explicit ask
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote · video usable
CANONICAL OWNER:     Maintainer · desktop shell + PAL honesty
PROOF:               Gates below green (2026-11-03)
```

## 1. Product claim for feedback cut

Ship **private-trust reference client** feedback on desktop (primary): passphrase daily door, Obscur-Nostr DMs, Private DC lab wire optional, Matrix **lab** optional.  
Do **not** claim: multi-protocol Verified · Tor Verified · Soft L3 Fixed · video usable · Matrix production.

## 2. Verify before public ask

| Gate | Command / action | Pass when |
|------|------------------|-----------|
| A1 PAL contracts | `pnpm exec vitest run app/features/protocol-adaptation` (apps/pwa) | **Pass 2026-11-03** — 36 files / 123 tests |
| A2 Storage sandbox | S2–S5 soak reports Pass (already landed) | **Pass** — S2–S5 + FM1 + P2 door + P4d latest.json |
| A3 Desktop smoke | Unlock → shell · send/receive DM Tor OFF · Settings Protocols labels honest | **Pass 2026-11-03** — dual-profile DM (Tester1↔Tester2) Tor OFF this session; Protocols Settings honesty defaults land with A5 |
| A4 Release pack | `pnpm release:test-pack` (or skip-preflight in CI) | **Pass 2026-11-03** — integrity + typecheck + focused vitest 102 files / 580 Pass; preflight with `--allow-dirty` (WIP honesty copy); artifact-matrix + B1 bot crypto/descriptor OK |
| A5 Honesty copy | Settings / download notes match non-claims | **Pass 2026-11-03** — download hero §3b · Settings Privacy/Protocols honesty · /limitations feedback non-claims |

## 3. Feedback ask (honest)

Ask users for: unlock friction · DM reliability · Private DC config clarity · crash/perf · whether hide-only history feels acceptable once explained.  
Explicitly out of scope for feedback: Tor SLA · Matrix E2EE · video calls · Continuity · “Telegram-style wipe my history everywhere.”

## 3b. Deletion / history honesty (maintainer 2026-11)

Public testers (friends included) should hear this up front:

- **Obscur is not a centralized messenger.** Telegram can offer provider-controlled delete-everywhere because the provider holds the store. Public Nostr relays are not that model: there is **no technical guarantee** that one client can erase every copy of a DM for all peers/relays/clients.
- Product v1 supports **Hide on this device** (local visibility). Cooperative “recall for everyone” is **not** the feedback claim (`DM_RECALL_FOR_EVERYONE_UI_ENABLED = false`); helper copy already says relays/other clients may retain messages.
- A private/self-hosted relay or VPS can tighten *where* ciphertext lives; it still does not invent a universal erase button across the ecosystem.
- **Invariant regardless of carrier (Obscur-Nostr, Private DC lab, Matrix lab):** payloads remain **E2EE** — honesty about storage geography must never imply provider-readable plaintext.

Shipped in download hero · Settings Privacy/Protocols · `/limitations` (2026-11-03). Do not market “delete chat history forever” for decentralized paths.

**Tradeoff to say out loud:** a mistaken send may stay visible to the peer (and on relays) even after you hide it locally — that can frustrate honest users. The same permanence makes it harder for scammers to scrub evidence by “deleting for everyone.” Prefer honest permanence over fake erase.

**B2B / private team workspaces (separate lane):** orgs may need to retire wrong announcements inside a **sealed managed workspace**. That is not the public-Nostr DM claim. Obscur already scopes **Remove from this workspace** to strict managed-workspace chats (relay-scoped suppress + kind 5 / operator compaction — see `docs/messaging/managed-workspace-relay-deletion.md`). Stronger steward delete of outdated content belongs on the **operator-controlled relay plane**, still E2EE to the provider, and must not be marketed as open-network erase-everywhere. Feedback cut: DMs stay hide-local; workspace remove is the B2B-shaped control.

## 4. Remaining polish (non-blocking for feedback)

- Further Obscur-Nostr package orchestration extract (P7d+)
- Production company-DC soak (optional)
- Mass path renames
- A5 surface copy landed 2026-11-03 — further locale translation sync (non-en) optional
