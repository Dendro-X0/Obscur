# Design — Production Tor opt-in + public Nostr default (v1.9.14)

**Status:** **Aligned** with [prod-first-multi-transport-mandate-2026-08.md](./prod-first-multi-transport-mandate-2026-08.md) (2026-08-02)  
**Date:** 2026-07-28 (UTC); boot restored to public Default Stable 2026-08-02  
**Handoff:** current-session — prod-first multi-transport  
**Related:** [desktop-packaged-relay-offline-investigation-2026-07.md](./desktop-packaged-relay-offline-investigation-2026-07.md)

---

## Product contract

| Requirement | Behavior |
|-------------|----------|
| Default transport | Public Nostr — **Default Stable** (`damus`, `nos.lol`, `primal`) |
| Tor at boot | **Off** (`enable_tor: false`) |
| Tor when opted in | Sidecar starts with writable `DataDirectory` + SocksPort; Security toggle drives start/stop |
| Pack switching | Transport packs remain the canonical switch surface; Tor pack Apply stays fail-closed until ready |
| Badge honesty | Tor pack shows **Tor off** when disabled; **Tor not ready** only while enabled and bootstrapping |

---

## Owners

| Concern | Module |
|---------|--------|
| Boot relay list | `apps/pwa/app/features/relays/hooks/use-relay-list.ts` |
| Preset catalog | `apps/pwa/app/features/transport-kernel/transport-preset-catalog.ts` |
| Apply / Tor gate | `transport-preset-apply-policy.ts` · `use-relays-settings-model.ts` · catalog panel |
| Tor process | `apps/desktop/src-tauri/src/commands/tor.rs` |
| Security toggle | `use-auto-lock.ts` |

---

## Slice A — Align boot relays with Default Stable

`DEFAULT_RELAYS` enables the same three public relays as `DEFAULT_STABLE_PRESET`. Localhost / snort remain present but disabled.

## Slice B — Honest Tor gate + defense-in-depth Apply

- Badge: off vs not-ready vs ready
- `applyRelayPreset` refuses Tor packs when `!ready` (not UI-only)

## Slice C — Packaged Tor start reliability

`start_tor` writes `torrc` under app data (`DataDirectory`, `SocksPort` from settings) and launches sidecar with `-f <torrc>`.

## Out of scope this slice

- Routing only onion conduits through Tor while clearnet WS stay direct (separate Tor-scope charter)
- Claiming C13 L3 circuit soak
- Enabling Tor by default

## Proof

- L1: `transport-preset-apply-policy.test.ts` · relay-list defaults · `cargo test` if Tor unit helpers added
- L3 (maintainer): fresh install → public relays online, Tor off; Security enable Tor → status becomes ready → Tor pack Apply unblocks
