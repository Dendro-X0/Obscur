# Charter & vision — communication kernel (draft)

_Last reviewed: 2026-05-15 (baseline commit 0797ce1c)._

**Status:** Draft concept  
**Last updated:** 2026-05-16  
**Audience:** Maintainers, future protocol designers, agent context

---

## What we are building (two layers, one product)

| Layer | Name | Role |
|-------|------|------|
| **Application** | Obscur | Deliver the program: desktop/PWA UI, profiles, teams, settings, release artifacts |
| **Infrastructure** | Communication kernel (working name) | Protocol semantics, E2E contracts, trust anchors, message lifecycle — transport-agnostic |
| **Bridge** | Transport adapters | Nostr today; team-trusted servers tomorrow; others later |

The application and kernel are **symbiotic but distinct**. The kernel does not require Obscur branding; Obscur is one client that speaks it. Nostr is **not bad** — it is **one adapter** among several.

---

## Product goals (adjusted, realistic)

We serve users who need communication that is:

1. **Convenient** — install, chat, groups, reasonable performance on desktop and web.
2. **Trustworthy in governance** — operators of *chosen* infrastructure should not need access to plaintext; users should understand what is visible where.
3. **Suitable for teams and communities** — configure trusted servers (intranet-like deployment story), not only public relay gossip.
4. **Resistant to casual surveillance** — no business model built on mining DM content for ads; structural honesty in docs and code.
5. **Censorship-resistant when needed** — optional participation in open networks (Nostr) without forcing every deployment through it.

We **do not** promise:

- Complete “user sovereignty” in one client on one protocol.
- WhatsApp-grade global unsend on immutable relays.
- Control over other Nostr clients’ behavior.
- Erasure of all historical copies on the internet.

---

## Bar for the Nostr client (v1.5.x)

**Success = a decent Nostr client** that:

- Keeps E2E DMs and communities usable on Web + Desktop.
- Uses **honest language** (hide vs delete, cooperative recall vs erase).
- Converges behavior through **ClientGateway** and explicit profile scope.
- Documents known limitations instead of marketing past them.

Improvement is incremental. The kernel charter matures **in parallel**, fed by fixes and failures in the Nostr client — not instead of them.

---

## Nostr — long-term role

| Aspect | Position |
|--------|----------|
| Timeline | Keep Nostr for the long term; do not plan a full replacement in v1.5.x |
| Architecture | `@dweb/nostr` and relay pool = **adapter**, not the kernel |
| Honesty | Relay retention, dedup, multi-client semantics, and cooperative hide limits must stay in user-facing and maintainer docs |
| Future | Even a perfected experimental kernel should retain a Nostr adapter for open-network scenarios |

---

## Kernel principles (target, not yet implemented)

1. **One write path, one read model** per profile for message visibility.
2. **Explicit trust anchor** — home server, team server, or public adapter config.
3. **Separate semantics** — `hide_local`, `recall_cooperative`, `purge_local` — never one word “delete”.
4. **Transport port** — `publish` / `subscribe` / `delete_command` behind an interface; Nostr implements a subset.
5. **Evidence-based sync** — account backup and restore cannot silently override tombstones.

---

## Inspiration shelf

Ideas captured here may later inform:

- Team-configurable relay / homeserver deployment.
- Stronger NIP-17-first DM path with NIP-04 as legacy read.
- Federation between private teams and public Nostr.

See [02-assets-from-obscur.md](./02-assets-from-obscur.md) for what the current monorepo already provides.
