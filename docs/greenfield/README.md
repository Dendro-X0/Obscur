# Greenfield product plan (concept phase)

**Status:** Implemented in successor repo — specs copied to [Greenfield](https://github.com/Dendro-X0/greenfield) (`E:\Web Projects\greenfield`)  
**Last updated:** 2026-05-22  
**Relationship to Obscur:** This folder was the **planning source**; live specs and code are in greenfield `docs/`. Obscur trunk is archived — do not execute v1.9.x program bands here.

---

## Purpose

Capture a from-scratch plan for a privacy-first, E2EE communication product that:

- Does not bind accounts to real-world identity (optional trust markers only).
- Prioritizes local-first native clients; network is async courier, not the UX source of truth.
- Never removes content or warns senders; **recipient-only** behavioral risk notices.
- Never overrides user autonomy (no automatic bans, interception, or shadow enforcement).
- Does not integrate financial trading, wallets, or laundering rails; warns recipients on financial activity in conversation context.
- Uses **behavior-based** protection (not keyword/language moderation).
- **Pragmatic encryption** — E2EE for message bodies; metadata bounded so DM, sync, and groups stay usable.
- **Limited responsibility** — we secure **our** code only; user protection is informed, not guaranteed.

---

## Read order

| # | Document | Contents |
|---|----------|----------|
| 00 | [Charter](./00-charter-sovereign-comms.md) | Principles, ranked conflicts, non-goals, positioning |
| 01 | [Phase roadmap](./01-phase-roadmap.md) | Phases 0–5, exit gates, kill criteria |
| 02 | [Warning & trust model](./02-warning-and-trust-model.md) | Behavior signals, financial alerts, invariants, rule packs |
| 03 | [Identity & anti-abuse](./03-identity-and-sybil.md) | Disposable keys, bots, WoT, rates, optional attestations |
| 04 | [Architecture sketch](./04-architecture-sketch.md) | Layers, TransportPort, courier vs federation |
| 05 | [Security & data classes](./05-security-data-classes.md) | Scorched earth, A–D classes, pragmatic encryption |
| 06 | [Scope of responsibility](./06-scope-of-responsibility.md) | Our code only, limited protection, completion definition |
| 07 | [Repository strategy](./07-repository-strategy.md) | **New repo** + controlled extract; avoid continuing in Obscur tree |
| 08 | [Extraction manifest](./08-extraction-manifest.md) | What to copy from Obscur (ui-kit, crypto, tiers) |
| 09 | [Phase 0 bootstrap](./09-phase0-bootstrap-checklist.md) | New repo day-by-day checklist |
| — | [templates/](./templates/) | README, `pnpm-workspace`, root `package.json` stubs |

---

## Obscur lessons (inputs to this plan)

| Lesson | Greenfield response |
|--------|---------------------|
| Public Nostr relays ≠ membership authority | Courier + signed directory owns roster; relays are optional event bus |
| Three competing truth sources freeze UX | One owner per lifecycle fact |
| Production ops without production team | Phase 1 needs one documented happy path (self-host or bundled demo) |
| Keyword / language moderation fails at scale | Behavior bundles + recipient-local analyzers |
| Scope bands (v1.9 → v2.0) without two-device proof | Every phase has falsifiable acceptance tests before coding |

---

## Next step (when leaving concept phase)

1. Create **new repository** per [07-repository-strategy.md](./07-repository-strategy.md).
2. Follow [09-phase0-bootstrap-checklist.md](./09-phase0-bootstrap-checklist.md) and [08-extraction-manifest.md](./08-extraction-manifest.md).
3. Copy `docs/greenfield/` and allowlisted packages (`ui-kit`, `crypto`, selected UI).
4. **This** monorepo is archived — see root [ARCHIVE.md](../ARCHIVE.md).
