# Investigation — Friend code save hang + Discovery “No exact account resolved” (2026-11-05)

```text
HANDOFF ATOMIC STEP: RECORD DEMO FIRST — discovery P0
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER: use-conduit-mesh-relay-pool + relay-discovery-query
PROOF BEFORE DONE: L1 unit · L2 invite REQ reaches open discovery WS · optional L3 UI
SURFACE: Tauri desktop (beta.5)
```

## Operator evidence

1. Profile → Friend Code `OBSCUR-Z8V4YD` — UI shows **“This code appears available”** then **Saving…** spinner (hang / slow publish).
2. Discovery → Add Friend → search `OBSCUR-Z8V4YD` → **No exact account resolved**.
3. Diagnostics: Lookups **0** · INVITE-CODE:ON · DEEP-LINK:ON · SUGGESTIONS:ON (Safe Mode path; lookups counter is global-search only — expected noise).

## External falsification (same code)

Direct WebSocket REQ to public discovery relays:

| Relay | `kinds:[31950] #d:[OBSCUR-Z8V4YD]` (+ `#i` kind 0) |
|-------|-----------------------------------------------------|
| `wss://nos.lol` | **2 events** (31950 alias + kind 0 with `#i`/`#code`) |
| `wss://relay.primal.net` | **2 events** |
| `wss://relay.damus.io` | 0 |

App dual-filter REQ shape (`31950+#d` OR `0+#i`) also returns both events on nos.lol.

**Conclusion:** Relays are not empty. Client path fails to subscribe / receive.

## Hypotheses

| # | Hypothesis | Result |
|---|------------|--------|
| H1 | Alias never published | **Falsified** — present on nos.lol / primal |
| H2 | Invite REQ filter mix (search/`since`) | **Falsified** — current `buildFilters` is tag-only (Nov-04 fix) |
| H3 | Conduit mesh `broadcastEvent` does not send raw REQ on open Nostr WS | **Confirmed** — implements `runtime.publishToUrls([], payload)`; non-EVENT payloads go **mesh envelope**, not `socket.send(REQ)` |
| H4 | `addTransientRelay` never dials `GLOBAL_DISCOVERY_RELAY_URLS` | **Confirmed** — `addTransientRelay: () => {}` noop in `use-conduit-mesh-relay-pool.ts` |
| H5 | Quiet dial cap blocks 3rd public host | Contributing when only private relays enabled; not needed when nos/primal already open **if** REQ used sendToOpen |

## Root cause (causal)

`queryRelayProfiles` primes discovery via `addTransientRelay` (noop) then sends:

`pool.broadcastEvent(JSON.stringify(["REQ", …]))`

On product pool (conduit mesh), that is **publish**, not subscribe. Invite lookup never attaches a Nostr subscription on open sockets → empty Exact Match even when aliases exist.

Save hang is adjacent: profile publish waits on relay OK / backup refresh while discovery mirrors also use broken transient dial — UX stuck on **Saving…**.

## Product / demo honesty

- Vanity `OBSCUR-*` remains **secondary** ([durable-add-friend design](./2026-11-04-durable-add-friend-design.md)); demo should prefer QR / OB2.
- Existing GIFs: `send_a_contact_request_1.gif` · `accept_a_contact_request_1.gif` — do not re-film vanity for Launch EXIT.
- Still fix resolve so operators who use friend codes are not lied to by empty Exact Match.

## Fix (smallest)

1. Invite / community discovery REQ → `sendToOpen` (raw WS), not `broadcastEvent`.
2. Implement `addTransientRelay` like `reconnectRelay` (`setRelayUrls` union).
3. L1: regression test that invite query path calls `sendToOpen` with REQ (not publish).
4. Optional: ensure `p` tag on 31950 publish (alias on wire today often missing `p`; parser accepts content pubkey).

## Non-goals

Soft L3 · Tor · Matrix · Continuity promote · central username registry · claiming vanity always works offline.
