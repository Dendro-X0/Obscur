# Design — P6 / E3 probe-rank for public clearnet dial preference

- Date (UTC): 2026-08-01
- Research: [relay-latency-stability-research-2026-07.md](./relay-latency-stability-research-2026-07.md) · **P6**
- Prior: [public-nostr-relay-pool-module-design-2026-07.md](./public-nostr-relay-pool-module-design-2026-07.md) · E3 backlog
- Depends on: E1 static pack order · E2/E2c dial pad · P1 latency samples in hints

## Session gate

```text
NEXT ATOMIC STEP: Hold — P3→P4 done; maintainer pick P6
PAUSED / CANCELLED: COM-RUN-* · AUTH-SESSION · Dev Lab
CANONICAL OWNER: relay-primary-selector · buildRelayHealthHints (latency already on hints)
PROOF: L1 relay-primary-selector.test.ts
OUT OF SCOPE: Rewriting Settings relay list · geo-IP · public SLA · COM-RUN
```

## Problem

E1 fixed **catalog** order (nos → primal → damus). At runtime, cold remote pad / basic standby pad still walks **list order**, so a flaky first remote can be dialed before a probe-healthy standby even when `scoreRelayUrl` already prefers the healthy host for pool scoring.

## Contract

| Concern | Owner |
|---------|--------|
| Settings list order | User / Apply pack — **unchanged** by this slice |
| Dial membership preference | `rankEnabledRelayUrlsForDial` + `collectRemoteDialUrls` / basic pad / redundancy cold pad |
| Scores | Existing `scoreRelayUrl` (open, writable, latency, success, position) |

**Rule:** Prefer currently healthier clearnet hosts (from health hints: open/probe + latency) when choosing **which enabled URL to dial next**, without mutating stored presets.

## Slice

1. Export pure `rankEnabledRelayUrlsForDial(orderedEnabledUrls, hints)`.
2. `collectRemoteDialUrls` returns remotes in that rank order.
3. Basic `nextStandby` uses `pickBestRelayUrl` among pad candidates (not first-in-list).
4. Redundancy cold-pad iterates ranked order (then `ensureRemoteDialMembership` still enforces E2c).
5. L1: damus-first list + healthier nos/primal hints → remotes dial nos/primal before damus.

## Non-goals

- Periodic rewrite of `localStorage` relay list
- Changing E1 catalog defaults again
- Claiming public Nostr “fixed”

## Claim

- After L1: probe-rank dial preference **implemented**.
- Verified only with desktop evidence that flaky-first lists still dial healthier remotes when probes/samples exist.
