# Investigation — Public Nostr always-on (no Docker required)

**Date (UTC):** 2026-08-08  
**Status:** Investigation complete · verify **BLOCKED on this host** (outbound)  
**Maintainer ask:** Relays must stay available via public Nostr when Docker is absent; production has no Docker.  
**Parents:** Tor R4 PAUSED ([tor-r4-host-bootstrap-feasibility-2026-08.md](./tor-r4-host-bootstrap-feasibility-2026-08.md)) · DM thin-refactor Pass

```text
HANDOFF:              Public Nostr always-on — product contract OK; host outbound blocked
PAUSED / CANCELLED:   Tor R4 verify · Community · AUTH-SESSION
CANONICAL OWNER:      use-relay-list / PRODUCT_BOOT_TRANSPORT_PRESET · resolveActivePoolRelayUrls · useConduitMeshRelayPool
PROOF BEFORE DONE:    L3 desktop: Tor OFF · no Docker · ≥1 public wss open · DM send OK
OUT OF SCOPE:         Tor reopen · Community · requiring Docker for prod
```

## Product contract (already in tree)

| Rule | Owner |
|------|--------|
| Cold/reset boot = **Default Stable** public pack (`nos.lol`, `primal`, `damus`) | `PRODUCT_BOOT_TRANSPORT_PRESET` / `DEFAULT_RELAYS` |
| Local Dev Mesh = optional pack, not boot | `LOCAL_DEV_MESH_PRESET` |
| Loopback-only stored lists merge public boot rows | `mergePublicBootIntoLoopbackOnlyList` |
| When remotes enabled, demote `ws://localhost:7000` from active dial | `shouldDemoteLocalLabFromActivePool` |
| Publish prefers open remotes over offline Docker | `resolveScopedPublishRelayUrls` |

**Conclusion:** Production does **not** require Docker in the intended design. Docker is lab/optional.

## Maintainer evidence (screenshot 2026-08-08)

- Public cards present; **nos.lol** = primary; primal/damus standby “Not in the active transport pool.”
- Footer: **Publish-ready 1 of 3 · Open sockets 0 of 3** (ghost publish-ready class).
- `ws://localhost:7008` **DISABLED** + `websocket_error` (not the canonical `:7000` lab URL).
- Banner “Relay window quiet” claims sockets may be open while open count is 0 — honesty debt.

## Agent probe (same host, 2026-08-08)

| Target | Result |
|--------|--------|
| DNS `nos.lol` | Resolves (A + AAAA) |
| ICMP `1.1.1.1` | OK (~170ms) |
| HTTPS `https://example.com` | **200** |
| HTTPS `https://1.1.1.1` | **timeout** |
| HTTPS / WS upgrade `https://nos.lol` | **timeout** (~8s) |
| HTTPS `https://relay.primal.net` | **timeout** |

**Root class on this machine:** selective outbound filter / path failure to many public endpoints (including Default Stable hosts). Same environment class as Tor stuck at bootstrap ~5%.

This is **not** “app still requires Docker.” Public relays are selected; sockets never open because TCP to those hosts fails.

## Gap analysis (code vs ask)

| Ask | Gap |
|-----|-----|
| Always use public when no Docker | Intent exists; demote only matches **`:7000`**, not other loopback (e.g. `:7008`) |
| Users never need Docker knowledge | Copy still mentions `pnpm dev:relay:docker` in some failure strings — OK for lab, must not gate prod UX |
| Always available | **Cannot guarantee** on hosts that block public Nostr/Tor — need honest “unreachable” UI + optional user-added reachable relay |
| Screenshot: open=0 | Dial/connect failure to public WSS — env; also basic-mode under-dial can leave standbys “not in pool” while primary is dead |

## Outcomes (rules/11)

### A — Product polish (when clearnet works) — recommended next code band

1. Treat **all loopback WS** as lab for demotion (not only `:7000`).
2. When any public/VPS remote is enabled and open sockets = 0 for >N seconds: dial **all** enabled remotes up to redundancy max (do not strand on dead primary alone).
3. Relays UI: if remotes enabled and all remote dials fail, copy = “Public relays unreachable on this network” — **not** “start Docker.”
4. Keep Tor OFF for this band.

### B — Host network prerequisite (required for L3 on this PC)

Unblock outbound WSS to at least one Default Stable host (firewall/VPN/different network). Until then: **do not claim Verified** for always-on public Nostr on this host.

### C — Infeasible “always available on every network”

Cannot promise global reachability of third-party public relays. Product promise = **prefer public defaults without Docker**; honesty when they fail.

## Decision

- **Goal retained:** production path = public Nostr, Docker optional for labs only.  
- **This host:** verify **BLOCKED** until outbound WSS to a public relay succeeds.  
- **Next code (optional, A):** loopback demotion widen + dead-primary redial + Docker-free failure copy — only after maintainer wants the polish slice; L3 verify elsewhere or after network opens.

## Do not

- Fake open/publish-ready when sockets are closed.  
- Reopen Tor R4 to “fix” clearnet.  
- Tell users Docker is required for production messaging.
