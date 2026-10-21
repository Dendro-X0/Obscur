# Investigation — Tor bootstrap stuck at 10% / extremely slow (2026-08-17)

**Status:** Root cause found · bootstrap-speed slice (not Tor Verified)  
**Parents:** [tor-warming-descriptor-stall-honesty-2026-08.md](./tor-warming-descriptor-stall-honesty-2026-08.md) · [tor-performance-conflicts-research-2026-08.md](./tor-performance-conflicts-research-2026-08.md) · [tor-verified-infeasible-2026-08.md](./tor-verified-infeasible-2026-08.md)

```text
HANDOFF ATOMIC STEP:  PAUSED — dialect research (≠ Nostr / VPS / Tor)
PAUSED / CANCELLED:   dialect impl · Tor Verified · groups/** · AUTH-SESSION
CANONICAL OWNER:      apps/tor-gateway render_client_torrc · TorLifecycle::start
PROOF BEFORE DONE:    L1 torrc/unit tests · L3: Warming shows percent; restart reuses cache; no fake 100%
OUT OF SCOPE:         Fake Ready · bridges as default · Arti rewrite · Tor Verified soak
```

## Maintainer evidence

| Surface | Observation |
|---------|-------------|
| Security | Warming · **BOOTSTRAP STARTING 10%** · `bootstrapped 10%` (honesty poll **works**) |
| 10% meaning | Tor `conn_done` — TCP to a directory/guard **succeeded**; OR **handshake not done** (next is 14%) |
| Cache on disk | `cached-microdesc-consensus` 3.6 MB · **`cached-microdescs` 37 MB** (04:15) — prior run *did* download descriptors |
| `notice.log` | Truncated to 0 on this start (`prepare_torrc`) |
| Gateway | Later **down** (`:17950` refused) · `lock`/`state` mtime 05:05 · no `tor.exe` — process died or was killed mid-Warming |
| Relays | Clearnet still in use (TI-B) — not this slice |

## Why it *feels* stuck at 10%

1. **Handshake stall (path)** — same class as historical TLS_ERROR at 10–14%. IPv6 dual-stack on Windows often reports TCP connected then hangs TLS. Not fake-Ready-able.
2. **Every start is treated as hostile orphan** — `kill_orphan_tor_processes()` (`taskkill /IM tor.exe /F /T`) runs **even when :9050 is free**. Windows taskkill is slow **and** guarantees a new daemon that must re-handshake, even with 37 MB cache.
3. **`AvoidDiskWrites 1`** — delays flushing consensus/microdescs/notice.log. Warm cache exists from a long run, but logs look empty and next start under-uses persisted state.
4. **No early directory fetch knobs** — default client waits before consensus/fallback downloads.
5. **Honesty UI is working** — 10% is real `conn_done`, not a frozen “waiting for 100%” lie.

## What will **not** make 10% → 100% on a blocked path

Bridges, other networks, or waiting out DPI. Forbidden this session: fake Ready, default obfs4.

## Slice (implement)

| Change | Effect |
|--------|--------|
| IPv4-only client (`ClientUseIPv6 0`) | Skip IPv6 handshake hangs at 10% |
| `FetchDirInfoEarly` + `FetchDirInfoExtraEarly` | Start consensus fetch as soon as a hop exists |
| Consensus download initial delay **0** | Do not sit idle after connect |
| Drop `AvoidDiskWrites` | Persist 37 MB cache · faster *next* start |
| `DormantCanceledByStartup 1` | Do not go dormant mid-bootstrap |
| `HardwareAccel 1` | Faster TLS/handshake crypto |
| Kill orphans **only if :9050 is bound** | Skip needless `taskkill` when port is free |
| Keep Ready = Bootstrapped 100% only | No shortcut |

**Invariant:** Warming still keeps clearnet. Tunnel still requires 100%.
