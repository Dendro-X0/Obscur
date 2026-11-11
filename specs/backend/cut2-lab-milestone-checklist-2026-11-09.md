# Cut 2.4 — Lab milestone checklist (private-trust product face)

**Date:** 2026-11-09  
**Status:** documented + headless product-face soak · **≠ Soft L3 Fixed** · **≠ Tor Verified** · **≠ Matrix promote**  
**Parent:** [cut2-private-trust-product-face-design-2026-11-09.md](./cut2-private-trust-product-face-design-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 2.4 lab checklist — desktop L2 compose on new path
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass
CANONICAL OWNER:     ENGINE-LAB / desktop private-trust lab
PROOF:               checklist below · L1 green for 2.1–2.3 · soak script ≠ Soft L3
```

## Goal

Operator soaks **Cut 2 private-trust product face** on desktop: with an H-dc session configured, the shell defaults to `private_dc`, compose chrome is H-dc/T3 (not relay quorum), send is T3 envelope, and giftwrap invites honestly require Obscur-Nostr.

Builds on Cut 1 authority (CRM · SQLite messages · kernel outbox · chat-state demotion).

## Product face (required)

| Concern | Owner |
|---------|--------|
| Default protocol | `resolveActiveProtocolId` → `private_dc` when native + H-dc session (explicit LS wins) |
| Composer chrome | H-dc · T3 label; Private DC chips (not “Nostr”) |
| Send | `ProtocolAdaptationLayer.sendDm` → T3; `sendDmWithRetry` refuses silent Nostr |
| Invites | Giftwrap = Obscur-Nostr module; private_dc/matrix → honest refuse + dialog banner |
| Durability / CRM | Still Cut 1 owners (relationship_edge · SQLite messages) |

## Kill list (Cut 2)

| Kill ID | Residue | Native rule |
|---------|---------|-------------|
| **K-DEFAULT-NOSTR** | Missing preference → always Nostr | Prefer `private_dc` when H-dc session on native |
| **K-COMPOSE-RELAY** | Relay quorum as primary chrome on private_dc | H-dc · T3 primary |
| **K-SEND-FALLBACK** | Silent Nostr retry/send when private_dc active | Refuse (`private_dc_silent_nostr_fallback_refused`) |
| **K-INVITE-NOSTR** | Throw / stranded UI on private_dc invite | SendResult + honesty banner |

## Preconditions

- [ ] Cut 1 L1 / headless soak green (`node scripts/cut1-lab-new-path-soak.mjs`)
- [ ] Desktop build with libobscur SCHEMA_V6+ and Cut 0 spine
- [ ] Local thin H-dc lab on loopback; Private DC session configured in Settings → Protocols
- [ ] Soft L3 contact Pass remains **paused** (B4)

## Soak steps (L2 — desktop)

| # | Step | Expect | Not claim |
|---|------|--------|-----------|
| 1 | Unlock profile (PDK) | Shell ready; SQLite open | Continuity |
| 2 | Configure H-dc Private DC session (loopback) | Session present; no explicit Nostr preference | Soft L3 Fixed |
| 3 | Open composer / Protocols chips | Active face **Private DC**; status **H-dc · T3** (not relay primary) | Tor Verified |
| 4 | Send DM to lab peer | T3 envelope → home **accepted** ≠ delivered | Read receipt · Soft L3 |
| 5 | Re-open thread after restart | Message from SQLite; chat-state bodies not authority | IDB MessageQueue |
| 6 | Attempt connection invite while private_dc | Honesty banner; send disabled / toast with Obscur-Nostr require | Soft L3 invite Pass |
| 7 | Switch to Obscur-Nostr (explicit) then invite | Giftwrap path allowed (module selected) | Matrix promote |
| 8 | Dual-profile optional | Profile isolation for edges/messages | Soft L3 dual CDP |

## L1 evidence already landed (2.1–2.3)

| Slice | Proof |
|-------|-------|
| 2.1 | `preferences.cut2-default` · `cut2-default-protocol.owner-uniqueness` |
| 2.2 | `cut2-compose-honesty` · `private-trust-compose-policy` · chips · `dm-send-with-retry.cut2` |
| 2.3 | `private-trust-invite-policy` · `cut2-invite-policy.owner-uniqueness` |
| Wire | Cut 0/1 H-dc soak (`cut0-lab-hdc-t3-soak.mjs`) |

### Headless command (L1 gate + H-dc wire)

```bash
node scripts/cut2-lab-product-face-soak.mjs
```

Runs Cut 2.1–2.3 vitests, then Cut 1 new-path soak (includes H-dc). **≠ Soft L3 Fixed.**

## Forbidden claims after soak

- Soft L3 Fixed / contact Pass  
- Tor Verified · Matrix promote · Continuity Pass  
- “Product private-trust done” from headless alone (desktop L2 steps 1–8 still operator)  
- Vite UI migrate complete (Cut UI — separate charter)  

## NEXT after 2.4

Maintainer may charter next NARROW cut (Cut UI Vite · packaged L4 · optional desktop L2 operator soaks). Soft L3 remains paused until separately resumed.
