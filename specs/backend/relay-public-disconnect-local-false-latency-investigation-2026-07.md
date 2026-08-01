# Investigation — Public relays disconnected · local “high latency” ~6008ms

- Date (UTC): 2026-08-01
- Surface: Settings → Relays (desktop online shell `SHELL-2026-07-31T12:30:16Z`)
- Related: [relay-settings-latency-metrics-investigation-2026-07.md](./relay-settings-latency-metrics-investigation-2026-07.md)

## Handoff gate

```text
NEXT ATOMIC STEP: Hold — Relays latency metrics bridge implemented (L1)
PAUSED / CANCELLED: COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION
User ask: Public relays fail to connect; local shows high latency
```

Not a PAUSED-band conflict.

## Screenshot facts

| Relay | Role UI | Socket | Latency |
|-------|---------|--------|---------|
| nos.lol | Active transport | DISCONNECTED | NO SAMPLES |
| primal / damus | Standby | DISCONNECTED | NO SAMPLES |
| `ws://localhost:7000` | Pool member | open | **~6008ms**, 8 tall samples, badge HIGH LATENCY |

Success rate still n/a (Insufficient data 0) — connection counters not advancing in UI path (separate from latency).

## Finding A — Local “high latency” is a false probe sample (primary, code bug)

`probeStandbyRelayLatency` (`standby-latency-prober.ts`):

- `DEFAULT_TIMEOUT_MS = 6_000`
- On **frame timeout**, settles `{ ok: true, latencyMs: Date.now() - startMs }` ≈ **6000ms**
- File comment says fallback should be **open-handshake time only** — implementation does the opposite
- Unit test currently **encodes the bug**: expects `latencyMs === frameTimeoutMs` after open-without-frame

Local Nostr often opens WS and sends **no** immediate NOTICE/frame. After metrics bridge + probing **all** enabled URLs (including active local):

1. Probe opens to `:7000` quickly  
2. Waits 6s for a frame  
3. Records ~6000ms as **ok** latency  
4. UI threshold `latency > 1500` → **HIGH LATENCY**

Matches screenshot (6008ms × many bars).

**Owner:** `standby-latency-prober.ts`  
**Fix direction:** On open-without-frame timeout, record `openedAt - startMs` (handshake RTT), not wall-clock to frame deadline.

## Finding B — Public DISCONNECTED (runtime / dial — not yet proven code bug)

Public cards show no active socket. Possible causes (ordered):

1. **Outbound WSS failure** (network/DNS/TLS/Tor) from this host right now  
2. **Pool only opened local** while public remain configured but not connected (dial / bootstrap / Docker local preference)  
3. **Shell hot path**: live Next may include probe-all change; probing does not replace pool connect — public still need NativeRelay/mesh open  
4. Stale shell stamp does **not** disprove hot reload of PWA code

Earlier same day: `verify:e2-public-only-l3` Pass with nos/primal writable — so public connect **can** work on this machine when dialed correctly. Current UI suggests regression or config drift (local re-enabled / pool URLs / network).

**Next evidence (before claiming public fix):**

- CDP: `obscurRelayRuntime` enabled/writable/connections  
- Optional: probe `wss://nos.lol` from host  
- Confirm whether local is enabled in storage again

Do **not** patch dial/pool until A is fixed and runtime evidence for B exists.

## Mental simulation

1. Metrics bridge exposes monitor to Relays UI (working — local shows samples).  
2. Probe-all hits localhost → false 6s samples → HIGH LATENCY.  
3. Public never open (or fail) → DISCONNECTED + no samples (failed probes not recorded: `ok && latencyMs > 0`).

## Non-goals

- Community / AUTH-SESSION  
- Lowering success-rate sample threshold  
- Declaring public Nostr “fixed” from screenshot alone

## Live evidence (2026-08-01 CDP)

Host probes: `nos.lol` HTTP 200 · `localhost:7000` up · CDP `:9230` up.

From the **same Tauri webview** (browser `WebSocket`):

| URL | Result |
|-----|--------|
| `wss://nos.lol` | open ~882ms |
| `wss://relay.primal.net` | open ~941ms |
| `ws://localhost:7000` | open ~8ms |

So public “fail to connect” is **not** outbound network failure on this machine.

Runtime `enabledRelayUrls` (active pool / supervisor) **flaps**: sometimes `[localhost]` only, sometimes public+local; `writable` 0–1. Storage list still has all four enabled + transport mode `redundancy`.

**Interpretation:** Relays cards show storage-configured public URLs as DISCONNECTED when the **active pool** is not holding open sockets to them (dial/pool preference for live local, or native connect path), while local stays open. Separate from false 6s latency.

## Proposed next

1. **Done this pass:** open-handshake fallback in standby prober (slice below).  
2. **Public dial honesty:** separate design — when storage enables public WSS and mode is redundancy, active pool must dial them (not leave DISCONNECTED while local alone is open). Do not patch without that design + L1.  
3. Optional: desktop Relays smoke after hot reload — local latency should be ms-scale, not ~6000.

