# Decision — Launch face: private-trust (not Matrix, not Nostr-only)

**Date (UTC):** 2026-10-18  
**Status:** Decided (maintainer steering)  
**Parents:** [obscur-ecosystem-charter.md](../../docs/program/obscur-ecosystem-charter.md) · handoff current-session

```text
HANDOFF ATOMIC STEP: Record launch positioning — private-trust / operator infra
PAUSED / CANCELLED: Matrix launch & promotion · Matrix Olm · Soft L3 Fixed · Tor Verified
CANONICAL OWNER: ProtocolAdaptationLayer · Relays Standard paths · charter
PROOF: this decision + handoff checkpoint (no Matrix product claim in promos)
```

## Decision

1. **Scrap Matrix for public launch / promotion.** Cleartext MVP + PAUSED Olm cannot meet the E2EE bar. Adapter code may remain lab-only; do not demo or market Matrix as a peer stack until Olm (or explicit reopen).
2. **Do not position Obscur as “just another Nostr client.”** Public-relay Nostr is an optional transport, not the brand or the reason to promote.
3. **Launch face = private-trust / operator-sovereign infrastructure:** users (or their club/co-op) run relays, mesh gateways, VPN/Tor underlay, and data-center capacity they control. Ciphertext on the wire; keys on devices. Matches charter § operator-sovereign scale and Preferred promotion scenarios.

## What “decentralization” means here

| Not the claim | The claim |
|---------------|-----------|
| Gossip truth on random public Nostr relays | No SaaS landlord owns everyone’s plaintext or access rights |
| Matrix homeserver as product identity | Operator-chosen endpoints (private WS/HTTP, hybrid, optional Tor) |
| “More Nostr clients” | Reference client for encrypted comms with pluggable transports |

## Near-term product focus (for launch honesty)

1. **Relays Standard paths** — Everyday clearnet remains available; emphasize Local / Hybrid / Tor as the differentiated story.
2. **Protocols/Network** — Clearnet / Tor / Quiet as network path; Matrix login stays but is non-promoted / lab.
3. **Demo kit** — Friends’ group or small club on a private mesh / LAN relay (or hybrid), not “follow me on nos.lol.”
4. **Do not reopen** Soft L3 Fixed · Tor Verified patch-loop · Matrix Olm until a dedicated charter.

## Non-goals this decision

Delete Matrix adapter code · implement Olm · rewrite Tor gateway · public Matrix rooms in marketing

_Last updated: 2026-10-18T09:00:00Z_
