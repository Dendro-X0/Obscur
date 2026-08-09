# Design — Adaptive public Nostr (average-user first)

**Date (UTC):** 2026-08-08  
**Status:** Design · Slice A implement  
**Parents:** [public-nostr-restore-charter-2026-08.md](./public-nostr-restore-charter-2026-08.md) · [public-nostr-always-on-investigation-2026-08.md](./public-nostr-always-on-investigation-2026-08.md)

```text
HANDOFF:              Adaptive public Nostr — Docker optional, multi-relay default
PAUSED / CANCELLED:   Tor R4 verify · Community · AUTH-SESSION
CANONICAL OWNER:      resolveDmTransportRelayUrls · relay-local-lab-adapt · workspace-dev-relay-bootstrap
PROOF BEFORE DONE:    L1 unit · Relays: with remotes enabled, dead loopback not in dial pool
OUT OF SCOPE:         Tor · forcing Docker knowledge · public Nostr SLA on blocked networks
```

## Product contract (what the user asked for)

1. **If local Docker / loopback lab is not running → use public Nostr.** No Docker knowledge required.  
2. **Connect to multiple public relays at once** (Default Stable redundancy — already the boot mode).  
3. **Average-user path:** public pool just works; lab packs stay optional/advanced.  
4. Honesty: never Ready/Active without open sockets (prior H1).

## Gap vs current code

| Intent | Today |
|--------|--------|
| Demote dead Docker from dial | Only `ws://localhost:7000` |
| `http://127.0.0.1:8788` | Still appended into DM pool when enabled → refuse spam |
| Multi public dial | Redundancy max 3 — OK when remotes are the pool |
| UX complexity | Transport packs / workspace / Docker copy still front-and-center |

## Slice A (this change)

1. **Dial pool:** when any non-loopback remote is enabled, DM pool = remotes only (do not append `:7000` / `:8788`).  
2. **Active-pool demote:** treat loopback WS + loopback HTTP mesh as lab when remotes enabled.  
3. **Prune:** extend unreachable prune so dead `:8788` is disabled like `:7000` when probed down (best-effort).  
4. Tests for demote + DM URL resolve.

## Slice B (later — UX)

Collapse Settings Relays for consumers: default view = “Network: Connected to N relays”; packs/Docker under Advanced. Not in Slice A.

## Proof

| Layer | Command / check |
|-------|-----------------|
| L1 | vitest local-lab-adapt + transport-scope + workspace bootstrap |
| L3 | Relays list with publics enabled · 8788/7000 down · no mesh health spam · open sockets only from publics (when network allows) |

## Non-claims

- Does not unblock TCP to public Nostr on a filtered host.  
- Does not cancel Tor as a future opt-in.
