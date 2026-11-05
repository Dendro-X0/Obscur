# Positioning: Selective friendship & depth (2026-11)

**Status:** Maintainer-facing charter — guides Discovery / Add Friend UX and demo voice  
**Parents:** [obscur-ecosystem-charter.md](./obscur-ecosystem-charter.md) · [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md) · [durable-add-friend design](../../specs/backend/2026-11-04-durable-add-friend-design.md)  
**Does not claim:** Soft L3 Fixed · Tor Verified · Matrix promote · “unbreachable” · video usable

## Insight

Mainstream social surfaces optimize for **attention throughput**: high interaction volume, low satisfaction. X is the archetype — easy to encounter hostility, scams, and low-trust strangers at scale.

Obscur’s niche is the opposite shape of “meeting people”:

| Mainstream default | Obscur intent |
|--------------------|---------------|
| Open feed, random reply surface | **Selective** introduction (token / QR / known context) |
| Maximize sessions & outrage | Maximize **trust density** of each connection |
| Strangers as content | Strangers as **optional**, gated by consent |
| Username directory / virality | Identity stays a **key**; share packets are deliberate |
| Broad social graph | **Interest / community / private-trust** graphs |

This is not “anti-social.” It is **pro-satisfaction**: fewer, better ties; hobbies, knowledge, and ideas over drive-by engagement.

## Product law (how positioning becomes UX)

1. **Friction is a feature** when adding someone — durable share (QR / contact card / OB2 / npub), not ambient stranger discovery as the hero.  
2. **Dual channel required:** **in person** (scan QR; optional short OB3) and **remote** (send link / OB2 / npub) — same selective identity, different affordances. Neither channel depends on vanity `OBSCUR-*`.  
3. **Vanity short codes** (`OBSCUR-*`) stay optional nicknames — never the promise of “always find anyone.”  
4. **Communities** remain interest / managed-workspace shaped (ecosystem charter), not global town square.  
5. **Honesty over growth copy** — do not imply infinite network search or store-grade social graph.

## Demo / copy stance

**Say**

- Selective add: share a contact QR or durable code when *you* choose.  
- Satisfaction from verified fingerprints and private-trust spaces.  
- Built for friends, clubs, and interest communities on infrastructure you control.

**Do not say**

- “Meet millions of new people on Obscur.”  
- “Friend codes always work like a username.”  
- Anything that implies Soft L3 / Tor Verified / multi-protocol done.

## Mechanism link

Positioning without mechanism is marketing. The mechanism is already sketched:

- [2026-11-04-durable-add-friend-design.md](../../specs/backend/2026-11-04-durable-add-friend-design.md) — primary = self-describing tokens; demote relay vanity.  
- Identity verification / fingerprints — out-of-band confirmation before trust.  
- Private-trust + managed workspaces — depth inside sealed rooms, not public reply wars.

## Next (product, not rewrite)

1. Discovery Share dialog dual-lane UI — [frontend-spec-discovery-dual-channel-add-friend-2026-11.md](../../specs/frontend/frontend-spec-discovery-dual-channel-add-friend-2026-11.md).  
2. Onboarding `ShareInviteCard` → durable card/OB2 QR (stop vanity `/invite/OBSCUR-*` payload).  
3. Demo segment: in-person QR **and** remote OB2/link between Tester accounts — not vanity-code roulette.
