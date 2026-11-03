# Investigation — Tor Warming appears stuck while descriptors load (2026-08-17)

**Status:** Root cause found · honesty + watcher slice Implemented (L1)  
**Parents:** [tor-warming-stuck-network-vs-logic-investigation-2026-08.md](./tor-warming-stuck-network-vs-logic-investigation-2026-08.md) · [tor-silent-spawn-warming-clearnet-investigation-2026-08.md](./tor-silent-spawn-warming-clearnet-investigation-2026-08.md) · [tor-verified-infeasible-2026-08.md](./tor-verified-infeasible-2026-08.md)

```text
HANDOFF ATOMIC STEP:  PAUSED — dialect research (≠ Nostr / VPS / Tor)
PAUSED / CANCELLED:   dialect impl · Tor Verified · groups/** · AUTH-SESSION
CANONICAL OWNER:      apps/tor-gateway notice watcher · get_tor_status snapshot · Security Tor UX
PROOF BEFORE DONE:    L1 cargo/vitest · L3: Security shows live percent while Warming; clearnet relays stay open
OUT OF SCOPE:         Fake Ready · bridges · claiming Tor Verified · TLS/DPI bypass
```

## Maintainer evidence (this session)

| Surface | Observation |
|---------|-------------|
| Relays | Tor ON · **Open sockets 2 of 3** (primal + damus) · Warming keep-clearnet **Pass** |
| Security UI | BOOTSTRAP **STARTING** · logs frozen at `waiting for Bootstrapped 100%` |
| Gateway `/v1/tor/status` | `state=starting` · `bootstrapReady=false` · **`detail=bootstrapped 50%`** |
| `notice.log` | Reached **50% (loading_descriptors)** · handshake **succeeded** (not 14% TLS stall) |
| `tor.exe` | `tor-x86_64-pc-windows-msvc` PID on `:9050` · gateway `:17950`/`:17951` listening |
| Descriptor cache | `cached-microdesc-consensus` ~3.6 MB · `cached-microdescs.new` ~2.3 MB then **mtime stalled** |

## What changed vs 2026-08-08

| Then | Now |
|------|-----|
| Stall **10–14%** · mass `TLS_ERROR` | Handshake done · consensus loaded · stall at **50% loading microdescriptors** |
| Env still can block | Yes — `Unable to decompress HTTP body` · first consensus had **no exit nodes** · later recovered exits |
| UI honesty | Gateway knows 50%; **UI never refreshes** because `tor-status` emits only on state transitions |

## Root causes (ordered)

### R1 — Security panel is pull-on-event only (UX lie)

`use-auto-lock` refreshes `get_tor_status` on `tor-status` emit. `set_tor_runtime_status` emits **only when state changes**. Percent 0→50 stays `Starting` → no emit → logs stay at start-time `waiting for Bootstrapped 100%`.

### R2 — `watch_notice_log` stops after ~5 minutes (app miss)

Windows often block-buffers Tor stdout; Ready is detected from `notice.log`. Watcher loop was **600 × 500 ms ≈ 5 min**. Loading ~10k microdescriptors on this path can exceed 5 min. After the cap, **Bootstrapped 100% in the file would never promote Ready**.

### R3 — Directory fetch friction (environment / path)

`Unable to decompress HTTP body (deflated)` then `We have no usable consensus` then partial consensus. Descriptor file stopped growing after ~2.3 MB. This is **not** fake-Ready-able. Bridges / other network remain the Verified prerequisite.

## Slice (this change)

| Change | Why |
|--------|-----|
| Notice watcher runs until Ready / Error / Stopped | Do not miss late 100% |
| Snapshot `detail` + `bootstrapPercent` · poll while Warming | Honest 50% in Security |
| Forward decompress/warn into gateway detail | Logs match notice, not only start line |

**Must not:** mark Ready at 50% · arm tunnel before 100% · keep-clearnet already landed.

## Claim language

| May say | Must not say |
|---------|----------------|
| Warming keeps clearnet (L3 screenshot) | Tor Verified / production Tor-ready |
| Gateway reached 50% loading descriptors | “Tor cannot start” as app-only failure |
| UI now shows live percent (after this slice) | Fake Connected |
