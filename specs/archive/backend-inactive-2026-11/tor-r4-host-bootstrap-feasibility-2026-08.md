# Feasibility — Tor R4 verified onion on this host (stop patch loop)

**Date (UTC):** 2026-08-08  
**Status:** Was PAUSED (env) · **reopen authorized** 2026-08-08 — see [tor-r4-reopen-charter-2026-08.md](./tor-r4-reopen-charter-2026-08.md)  
**Maintainer decision:** **D** paused patch loop; later: clearnet DMs working again; Tor optional but must stay functional  
**Parents:** [tor-gateway-r4-design-2026-08.md](./tor-gateway-r4-design-2026-08.md) · [tor-radical-options-charter-2026-08.md](./tor-radical-options-charter-2026-08.md) · [tor-l3-postmessage-quota-investigation-2026-08.md](./tor-l3-postmessage-quota-investigation-2026-08.md)

```text
HANDOFF:              Tor R4 reopen — T0 gateway URL align (see reopen charter)
PAUSED / CANCELLED:   Community · AUTH-SESSION · Dev Lab / COM-RUN-* / O-2/O-4 / RIW-8
CANONICAL OWNER:      apps/tor-gateway (lifecycle) · desktop tor_* IPC (proxy only)
PROOF BEFORE DONE:    notice.log Bootstrapped 100% + UI interactive soak (L3) — then Gateway Verified
OUT OF SCOPE:         Fake READY from SocksPort TCP · Slice 4b before T3
```

## Decision (rules/11)

| Outcome | Choice |
|---------|--------|
| New architecture path | **Not now** — R4 gateway ownership is the architecture; further app patches will not unblock circuits |
| Infeasible / pause module goal | **PAUSED (env-blocked)** — not CANCELLED; not “remove Tor so the app works” |
| Goal abandonment | **No** — Tor opt-in / max anonymity remains a product goal |

**Claim language:** Slices 1–3, P0, Slice 4a, emit-loop fix may stay **Implemented (L1)**. Must **not** claim Gateway Verified, Tor opt-in Verified, or “Tor fully enabled.”

## Evidence (settled)

1. **Host wedge (historical):** Tor ON via in-process `tor.exe` + UI SOCKS dials → freeze / black screen / PostMessage quota; Tor OFF usable.
2. **R4 architecture progress (code):** UI must not spawn Tor or open SOCKS; `obscur-tor-gateway` owns `tor.exe` + HTTP dials; ready only on `Bootstrapped 100%`; status emit only on change.
3. **Operator path incomplete:** Settings showed **GATEWAY OFFLINE** when gateway process was down; UI also reported unreachable at `http://127.0.0.1:11468` while design bind is `127.0.0.1:17950` — preference ON ≠ gateway up ≠ Tor ready.
4. **Network ceiling (this host):** With gateway up and start issued, Tor reaches **Bootstrapped 5% (conn)** then stalls; prior runs logged `WSAETIMEDOUT` to public relays. Same class as archived CONDUIT-MESH-C13 L3 **BLOCKED** (circuits / TLS handshake failures; SocksPort up ≠ ready).
5. **≥3 substantial iterations** on Tor enablement without Verified L3 on this host → patch loop must stop (`rules/11`).

## What is feasible vs not (here)

| Claim | Feasible now? |
|-------|----------------|
| Ship clearnet DMs / Relays with Tor preference OFF | **Yes** (prior DM thin-refactor L3 Pass) |
| Keep R4 code siloed; honest UI when gateway down / not bootstrapped | **Yes** |
| Verified in-app Tor (bootstrap 100% + interactive soak) on **this** network | **No** until outbound Tor (or bridges) works |
| Fake READY when SocksPort accepts TCP | **Forbidden** — hides the real blocker |

## Prerequisites to reopen Tor R4 verify band

All of the following:

1. On the target host: `notice.log` shows **Bootstrapped 100%** (or documented bridge path that reaches 100%).
2. Gateway reachable at the URL the desktop build actually uses (align env / default; no silent port drift).
3. Reopen charter in handoff: L3 soak = preference ON · lifecycle ready · UI stays interactive · no SOCKS in UI process.
4. Optional later: Slice **4b** (WS/NativeRelay via gateway) — only after HTTP path Verified.

Until then: agents **refuse** Tor enablement patches, dial “fixes,” and READY shortcuts.

## Product posture while PAUSED

- Default / recommended: Tor toggle **OFF** for daily work.
- Copy already states gateway ownership and clearnet relay WS until later — keep honesty; do not market “maximum anonymity” as live on this build.
- Next product work: **non-Tor** bands only (maintainer pick). Community and AUTH-SESSION remain closed.

## Explicit non-decisions

- **Not** R1 (excise Tor from product) unless maintainer later chooses it.
- **Not** cancelling the anonymity goal.
- **Not** declaring the whole project failed — Tor verify is siloed; clearnet product path remains.
