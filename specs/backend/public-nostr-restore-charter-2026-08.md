# Charter — Restore public Nostr (not abandon)

**Date (UTC):** 2026-08-08  
**Maintainer:** Historical remote friend DMs on public Nostr worked; current failure must not be treated as goal cancellation.  
**Parents:** [public-nostr-always-on-investigation-2026-08.md](./public-nostr-always-on-investigation-2026-08.md) · [shell-relay-status-honesty-investigation-2026-08.md](./shell-relay-status-honesty-investigation-2026-08.md)

```text
GOAL:                 Public Nostr DM path works again (friend-reachable) — ACTIVE
NOT CANCELLED:        Max-anonymity Tor opt-in (verify band PAUSED only — env)
FORBIDDEN:            Equating Tor PAUSE with deleting public Nostr · fake Ready/Active
```

## Distinction (so pause ≠ delete)

| Band | Status | Meaning |
|------|--------|---------|
| Tor R4 **verify** | PAUSED | This host cannot bootstrap Tor circuits; stop Tor patch loops |
| Public Nostr / clearnet DMs | **ACTIVE** | Product path that already worked; restore until Verified |
| Community / AUTH-SESSION | PAUSED / CANCELLED | Unchanged |

## Settled facts (2026-08-08)

1. App dials Default Stable (`nos` / primal / damus); Tor off in NativeRelay logs.  
2. This machine: TCP/HTTPS to those hosts **timeout**; `example.com` OK — current outbound path blocks many Nostr hosts.  
3. Relays UI showed **Ready / Active transport** with **no latency samples** while dials fail — caused by mesh `publishReady` inventing UI `open` (`resolveRelayUiConnection`). That is a product honesty bug, not proof that relays work.  
4. Historical maintainer success with a friend proves the feature class is feasible when the network path exists.

## Forward plan (push, do not park forever)

| Step | Work | Exit |
|------|------|------|
| **H1** | Remove fake Ready/Active from publish-ready overlay | L1 tests green · cards show Disconnected when sockets closed |
| **H2** | Maintainer: network path that reaches ≥1 public `wss` (VPN / other net / allowlist) | TCP 443 to that host succeeds |
| **H3** | Desktop: open sockets ≥1 · send DM · friend receive | L3 Pass — public Nostr restored |
| **H4** | Optional: reduce dial/toast storm when all remotes fail | Honesty copy: “unreachable on this network” |

If H2 stays impossible on this PC forever, document **host infeasible for public Nostr** and continue H3 on a reachable network — **goal remains**; only the verify surface moves.

## Claim language

| May say | When |
|---------|------|
| Honesty Implemented (L1) | H1 tests |
| Public Nostr Verified | H3 friend/path evidence |
| Goal cancelled | **Never** from Tor PAUSE or this charter alone |
