# Investigation — Tor T1 vs KnotTrace (Obscur soak)

**Date (UTC):** 2026-10-17  
**Status:** Boundary recorded · T1 still host-gated  
**Parents:** [protocol-adaptation-l2-matrix-tor-soak-2026-10.md](./protocol-adaptation-l2-matrix-tor-soak-2026-10.md) · KnotTrace [START-HERE.md](file:///e:/Experimental%20projects/network/docs/START-HERE.md) · [slowdown-factors.md](file:///e:/Experimental%20projects/network/docs/slowdown-factors.md)

```text
HANDOFF ATOMIC STEP: Tor T1 on bootstrap-capable net (not Tor Verified)
PAUSED / CANCELLED: Soft L3 Fixed · remount · uncapped Quiet · Tor Verified (T5)
CANONICAL OWNER: obscur-tor-gateway (lifecycle) · KnotTrace (local diagnosis only)
PROOF: T0–T1 stamp · KnotTrace does not claim Tor Mbps / Ready fixes
```

## Context

Obscur Atom B on this LAN: **T0 Pass**, **T1 Fail** — stuck ~10% with `TLS_ERROR` / unexpected EOF to directory relays. KnotTrace (separate Tauri app under `e:/Experimental projects/network`) is the maintainer’s local-first network companion for Obscur-class desktop use cases.

## What KnotTrace is for (aligned with Obscur)

| KnotTrace strength | Obscur relevance |
|--------------------|------------------|
| DNS / link / Windows caps / MTU assists | Clearnet product path feels healthy before Tor |
| Honest Tor/VPN overhead copy · tunnel compare | Matches Obscur “don’t fake Tor Ready” ritual |
| Upstream pool proof (detect-only) | Explains proxy-path limits without auto-bypass |
| Observe-first, reversible assists | Same claim discipline as Obscur PAUSED bands |

KnotTrace START-HERE: *fix what is on the machine first; tell the truth about Tor/VPN overhead; prove when a proxy upstream/pool is the limit — do not fake Mbps gains.*

## What KnotTrace is **not** for (this soak)

| Symptom | Owner |
|---------|--------|
| Tor bootstrap stuck at 10% `TLS_ERROR` | **Path / DPI / ISP / region** — need a **bootstrap-capable network** (different uplink, less filtered Wi‑Fi, mobile hotspot that allows Tor, etc.) |
| Guaranteed Tor latency improvement | Neither KnotTrace nor Obscur claim this |
| Patching `obscur-tor-gateway` to “force Ready” | Forbidden — false Ready |

Local DNS/MTU/caps repairs can improve **clearnet** and sometimes help *reach* Tor slightly; they do **not** convert a TLS-blocked directory path into Bootstrapped 100%.

## Operator path (T1 retry)

1. Optional: run KnotTrace Overview + Network (link, DNS, tunnel compare) — record shapes; do not expect Ready.
2. Move to a network that allows Tor OR connectivity (or confirm current path still blocked).
3. Obscur: `pnpm dev:tor-gateway` → `POST /v1/tor/start` → wait ≤5 min for `bootstrapReady:true`.
4. If T1 Pass: optional T3 curl SOCKS · stop before T5 Verified.
5. If T1 Fail again: stamp Fail · **stop** · no patch-loop.

## Product note (KnotTrace ↔ Obscur)

Continuing KnotTrace exploration for Obscur-like cases is **in scope as a sibling tool** (diagnosis + honesty). Integrating KnotTrace into Obscur UI is a **separate ask** — not this soak slice.

## Re-probe (same host, 2026-10-17)

| Layer | Result |
|-------|--------|
| T0 | **Pass** — gateway `:17950` health ok |
| T1 | **Fail** — stuck 10% · `TLS_ERROR` · unexpected eof · stopped Tor (no patch-loop) |

Conclusion: this uplink is still **not** bootstrap-capable. KnotTrace local assists will not flip T1; need a different network path.

_Last updated: 2026-10-17T15:00:00Z_
