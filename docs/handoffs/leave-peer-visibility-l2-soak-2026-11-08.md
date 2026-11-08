# L2 soak — Leave peer visibility Slice 2 (2026-11-08)

- **Verdict:** **Blocked** (dual CDP leave assert not completed)
- **Shell:** `OBSCUR_SKIP_RELAY=1 pnpm dev:desktop:online -- --skip-build` · stamp `shell-2026-11-07T16:07:24Z`
- **Docker relay:** **Up** — `infra-nostr-relay-1` · host `ws://localhost:7000` (page `WebSocket` opens)
- **JSON:** [`leave-peer-visibility-l2-soak-2026-11-08.json`](./leave-peer-visibility-l2-soak-2026-11-08.json)

## Progress this session

| Check | Result |
|-------|--------|
| Docker Desktop / `:7000` | Pass |
| Coordination `:8787` | Pass (after stack restart) |
| Static-dev CDP `:9230` boots | Pass |
| Tester1 shell (keychain hydrate) | Pass — observed Chats + `0/1 active relays` / Connecting |
| `obscur.relay_list.v2` includes `ws://localhost:7000` enabled | Pass (forced via page CDP evaluate) |
| Browser `WebSocket` to `:7000` | Pass |
| App pool ≥1 active long enough for group create | **Fail** — stays `0/1` / Connecting; native logs still dial public hosts under quiet_dial_cap |
| Playwright / long CDP automation | **Fail** — WebView2 CDP wedges (`Runtime.enable` / `Page.navigate` / `connectOverCDP` timeouts) after short use |
| Dual window Tester2 `:9231` | Not reached |
| A leave → B roster excludes A | **Not run** |

## Blockers

1. **Native relay pool** does not stay active on `ws://localhost:7000` despite Docker + browser WSS Pass.
2. **CDP attach** becomes unresponsive under repeated automation; requires desktop restart between short probes.

## Claim language

- May say: Docker local relay is available; leave Slice 2 L1 still Pass; L2 dual CDP still **Blocked**
- Must not say: leave Fixed · Soft L3 · packaged NSIS leave sticky verified

## Resume

1. Fix or bypass native dial so pool shows `1/1 active` on `ws://localhost:7000` (or confirm quiet_dial_cap is not starving loopback).
2. Open Tester2 via `desktop_open_profile_window({ profile_id })` once CDP is stable.
3. Create managed community on local relay → A leave → assert B `leftMemberPubkeys` / roster exclude.
