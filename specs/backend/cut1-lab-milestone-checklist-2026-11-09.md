# Cut 1.6 — Lab milestone checklist (replacement authority)

**Date:** 2026-11-09  
**Status:** documented + headless new-path soak · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut1-replacement-authority-design-2026-11-09.md](./cut1-replacement-authority-design-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 1.6 lab checklist — desktop L2 on new path only
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     ENGINE-LAB / desktop private-trust lab
PROOF:               checklist below · L1 green for 1.0–1.5 · soak script ≠ Soft L3
```

## Goal

Operator soaks **Cut 1 replacement authority** on desktop against the **new path only**. Old dual owners are removed or fail-closed — do not keep LS/IDB authority to satisfy Soft L3 scripts.

## New path (required)

| Concern | Owner |
|---------|--------|
| Sticky CRM | SQLite `relationship_edge` via `privateTrust` / `relationship-edge-authority` |
| DM durability | SQLite `messages` via dm / privateTrust engine |
| Outbox / retry | Kernel `outbox` + `prepareT3Outbound` / home ACK |
| Private-trust send | T3 envelope → H-dc `sendEnvelope` → `completeT3HomeAck` (`accepted` ≠ delivered) |
| Chat-state | UI cache only (pinned/hidden/unread/sidebar) — **not** CRM or message bodies |

## Old path removed / banned on native

| Kill ID | Old owner | Native rule |
|---------|-----------|-------------|
| **K-CRM** | peer-trust `localStorage` as TRUSTED authority | Non-authoritative; kernel write path only |
| **K-MSG-DUR** | IndexedDB `MessageQueue` / `openMessageDb` | Fail-closed / unused |
| **K-OUTBOX-LS** | `dm_message_queue_v1` | Never read/write; scrub residual |
| **K-SEND-FACE / K-PROTO-PLAIN** | `private_dc` plaintext `body` send | Refused when T3 wire required |
| **K-CHATSTATE-AUTH** | chat-state `connectionRequests` / message maps as authority | CRM+message I/O suppressed; social/send import boundary |

Browser remains **degraded** (may still use LS/chat-state). Desktop-first.

## Preconditions

- [ ] Desktop build with libobscur SCHEMA_V6+ and Cut 0 spine
- [ ] PDK unlock opens SQLite only
- [ ] Local thin H-dc lab (`scripts/lib/private-dc-lab-server.mjs`) on loopback
- [ ] Soft L3 contact Pass remains **paused** (B4)
- [ ] Soft L3 scripts that assert peer-trust LS as authority are **quarantined / updated** — do not re-enable LS authority

## Soak steps (L2 — desktop, new path only)

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | Unlock profile (passphrase / keychain PDK) | Shell ready; SQLite open | Continuity |
| 2 | Accept / trust a lab peer via product trust UI | Edge in `relationship_edge` (`trusted`/`pending`) | Soft L3 Fixed |
| 3 | Lock → quit → re-unlock | Same sticky edge; **not** from chat-state `connectionRequests` | peer-trust LS authority |
| 4 | Send DM on `private_dc` / H-dc home | Wire = T3 envelope; plaintext body refused | Nostr default · Soft L3 |
| 5 | Home ACK | Message status **accepted** (never auto-delivered) | Read receipt |
| 6 | Restart / re-open thread | Message still in SQLite list; chat-state message maps empty/ignored | IDB MessageQueue |
| 7 | Confirm no product write to `dm_message_queue_v1` | Key absent or scrubbed after session | LS outbox secrets |
| 8 | Dual-profile optional | Profile A edges/messages invisible to B | Soft L3 dual CDP |

## L1 evidence already landed (1.0–1.5)

| Slice | Proof |
|-------|-------|
| 1.0 | Maintainer ACK in handoff · [cut1-replacement-authority-design](./cut1-replacement-authority-design-2026-11-09.md) |
| 1.1 | `relationship-edge-authority` + owner-uniqueness · `use-peer-trust` |
| 1.2 | `cut1-message-durability.owner-uniqueness` · `dm-durability-contract` · [cut1-1.2](./cut1-1.2-message-durability-design-2026-11-09.md) |
| 1.3 | `cut1-outbox-ls.owner-uniqueness` · [cut1-1.3](./cut1-1.3-outbox-ls-design-2026-11-09.md) |
| 1.4 | `cut1-private-trust-send-face` · [cut1-1.4](./cut1-1.4-private-trust-send-face-design-2026-11-09.md) |
| 1.5 | `cut1-chat-state-demotion.owner-uniqueness` · [cut1-1.5](./cut1-1.5-chat-state-demotion-design-2026-11-09.md) |
| Cut 0 wire | `scripts/cut0-lab-hdc-t3-soak.mjs` (H-dc health/envelope/poll) |

### Headless command (L1 gate + H-dc wire)

```bash
node scripts/cut1-lab-new-path-soak.mjs
```

Runs Cut 1 owner-uniqueness vitests, then reuses Cut 0 H-dc soak. **≠ Soft L3 Fixed.**

## Forbidden claims after soak

- Soft L3 Fixed / contact Pass  
- Tor Verified  
- Matrix promote  
- Continuity Pass  
- “Rewrite finished” / production private-trust Pass from lab alone  
- Keeping peer-trust LS or chat-state as CRM/message authority to make old Soft L3 scripts green  

## NEXT after 1.6

Maintainer may charter next NARROW cut (UI Vite migrate, S1 compose polish, packaged L4) — Soft L3 remains paused until separately resumed.
