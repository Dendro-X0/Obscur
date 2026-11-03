# Charter — Reopen Tor R4 verify (optional feature, must stay functional)

**Date (UTC):** 2026-08-08  
**Status:** Reopen authorized by maintainer — clearnet DMs confirmed working; Tor remains optional but must work  
**Parents:** [tor-r4-host-bootstrap-feasibility-2026-08.md](./tor-r4-host-bootstrap-feasibility-2026-08.md) · [tor-gateway-r4-design-2026-08.md](./tor-gateway-r4-design-2026-08.md)

```text
HANDOFF:              Tor R4 reopen — gateway URL align · bootstrap 100% · UI soak
PAUSED / CANCELLED:   Community · AUTH-SESSION (unchanged)
CANONICAL OWNER:      apps/tor-gateway · desktop tor_gateway_client · Settings Tor toggle
PROOF BEFORE DONE:    notice.log Bootstrapped 100% · preference ON · UI interactive · no UI SOCKS
OUT OF SCOPE:         Fake READY · in-process tor.exe · Slice 4b until HTTP path Verified
```

## Maintainer posture

| Item | Position |
|------|----------|
| Daily driver | Clearnet DMs (text / media / voice / call requests) — **working** |
| Tor | Optional; not daily use; **must remain fully functional** |
| Docker Soft L3 | May add multi-minute send delay — lab caveat only |
| Goal | Seamless Tor integration in Obscur — not abandoned |

## What already exists (do not rebuild)

- R4: UI must not spawn Tor or open SOCKS (`UI_PROCESS_MAY_SPAWN_TOR` / `UI_PROCESS_MAY_DIAL_VIA_SOCKS` false).  
- `obscur-tor-gateway` owns `tor.exe` + HTTP Tor dials; ready only on **Bootstrapped 100%**.  
- Slice 4a: HTTP fetch via gateway; relay WS still clearnet until 4b.  
- Status emit only on change (PostMessage quota fix).

## Reopen sequence (one step at a time)

| Step | Action | Exit |
|------|--------|------|
| **T0** | Align desktop gateway URL with bind `127.0.0.1:17950` (fix drift e.g. `11468`) | **Pass** 2026-08-08 — resolve pins canonical; `/v1/health` OK |
| **T1** | Keep `pnpm dev:tor-gateway` running; toggle Tor off→on | **Pass (L2)** 2026-08-08 — POST stop→start; notice.log 0%→100%; UI OFF→ON confirm optional |
| **T2** | Wait for **Bootstrapped 100%** (bridges only if still stuck at ~5%) | **Pass** 2026-08-08T13:52:30Z — `bootstrapReady:true` + notice `100%` |
| **T3** | L3 soak: preference ON · shell interactive · no freeze / PostMessage storm | **Pass** 2026-08-08T13:57:17Z — Verified (lifecycle) |
| **T4** | Slice **4b** — relay WS via gateway | Charter + 4b-0 design open → next **4b-1** impl |

## Claim language

| May say | When |
|---------|------|
| Clearnet DM functional | Maintainer runtime confirmation (this note) |
| Tor Implemented (L1) | Existing R4 slices |
| Tor Gateway / opt-in **Verified** | T2 + T3 evidence only |
| Tor cancelled | **Never** from this charter |

## Hard rules

- Do not trade clearnet stability for Tor patches.  
- Do not claim Verified from SocksPort TCP alone.  
- If bootstrap sticks again after T0–T1 with evidence, document env block — do not infinite-patch.
