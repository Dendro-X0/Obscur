# Investigation — Basic mode + live local primary starves public remotes

- Date (UTC): 2026-08-01
- Trigger: Maintainer — Tester2 Relays UI shows only `ws://localhost:7000` ACTIVE TRANSPORT; `nos.lol` / `damus.io` DISCONNECTED STANDBY (“Not in the active transport pool”) while network can open public WSS
- Parent: [public-nostr-pool-unused-investigation-2026-07.md](./public-nostr-pool-unused-investigation-2026-07.md) · [relay-pool-delivery-strategy-design-2026-08.md](./relay-pool-delivery-strategy-design-2026-08.md)

## Session gate

```text
HANDOFF ATOMIC STEP: Soft L3 two-profile delivery Fail — pool/publish honesty
PAUSED / CANCELLED:  COM-RUN-* · AUTH-SESSION · Dev Lab as validation
CANONICAL OWNER:     resolveActivePoolRelayUrls (relay-primary-selector.ts)
PROOF:               Live browser dials · CDP snapshot · L1 selector tests · Soft L3 later
OUT OF SCOPE:        Claiming public Nostr SLA · COM-RUN · AUTH-SESSION
```

## Live evidence (this host · 2026-08-01)

| Probe | Result |
|-------|--------|
| Browser `WebSocket` `wss://nos.lol` | **OPEN** (~900ms) |
| Browser `WebSocket` `wss://relay.primal.net` | **OPEN** (~900ms) |
| Browser `WebSocket` `wss://relay.damus.io` | **FAIL** (provider/path) |
| Browser `WebSocket` `ws://localhost:7000` | **OPEN** (~20ms) |
| Tester1 CDP `obscurRelayRuntime` | `phase=healthy` · `writable=2` · enabled includes nos + local + primal |

Maintainer Relays screenshot (Tester2): localhost **Quiet / ACTIVE TRANSPORT**; damus + nos **DISCONNECTED / STANDBY** with copy “Not in the active transport pool.”

## Causal chain

```text
Product default transport mode = basic
  → primary promoted to open local (lab) when public primary was dead
  → resolveActivePoolRelayUrls(basic): if primaryLive → return [primary] only
  → dial set = [ws://localhost:7000]
  → enabled remotes never receive sockets
  → UI: STANDBY + “Not in the active transport pool.”
```

This is **not** “Nostr invisible.” Relays are listed and toggled on; they are **never dialed** once a live local primary short-circuits basic membership.

`ensureRemoteDialMembership` already prevents local-only pools in **redundancy** mode. Basic mode’s early `primaryLive` return skipped that guarantee.

## Fix slice (smallest)

In `resolveActivePoolRelayUrls` basic branch: when primary is live **and** local, pad enabled remotes into the dial set (cap 3), same intent as E2c.

Do **not** claim public Nostr fixed until a public-open Soft L3 / E2 public-only row shows writable on `wss://` without relying on local alone.

## Claim language

| May say | When |
|---------|------|
| Investigated | This doc + dial table |
| Implemented | Selector change + L1 tests green |
| Public pool fixed | **No** until desktop proof with open public socket on Tester2 Relays UI |
