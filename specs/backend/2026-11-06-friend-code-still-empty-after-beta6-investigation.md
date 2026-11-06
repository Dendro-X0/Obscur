# Investigation — Friend codes still empty after beta.6 (2026-11-06)

```text
HANDOFF ATOMIC STEP: cold-run beta.6 Add Friend vanity
PAUSED: Soft L3 · Tor · Matrix · Continuity promote
CANONICAL OWNER: relay-discovery-query (+ conduit pool)
PROOF: L1 invite ephemeral discovery · L2 Exact Match on OBSCUR-* with published NSIS
```

## Operator evidence

- Discovery Add Friend: `OBSCUR-Z8V4YD` / `OBSCUR-RU8ZL8` → **No exact account resolved**
- Diagnostics Lookups **0** (Safe Mode path — expected; counter is global-search only)
- Relays (external): both codes return kind 31950 + kind 0 on nos.lol / primal

## Install surface

| Artifact | mtime (local) | Notes |
|----------|---------------|-------|
| `E:\Obscur\obscur_desktop_app.exe` | 2026-11-05 17:21 | **Before** beta.6 publish |
| `release-assets/.../Obscur_2.0.0_x64-setup.exe` (beta.6) | 2026-11-05 21:34 | SHA `dfc98130…861db` |

Operator is still running a **pre-hotfix** shell. Reinstall beta.6 is mandatory for the sendToOpen fix.

## Remaining product risk (even after reinstall)

Quiet dial cap (`RELAY_WARMUP_PUBLIC_DIAL_CAP=2`) + `addTransientRelay` → `setRelayUrls` may **never dial** extra discovery hosts when two other public relays already occupy the cap. Invite lookup then REQs only non-discovery sockets → empty Exact Match while aliases exist on nos/primal.

## Fix

1. Reinstall published beta.6 NSIS (operator).  
2. Invite mode: open **ephemeral WebSockets** to `GLOBAL_DISCOVERY_RELAY_URLS` for the same REQ (pool-independent).  
3. Keep pool `sendToOpen` path as best-effort parallel.

## Non-goals

Soft L3 · Tor · Continuity · claiming vanity as primary Add Friend (QR/OB2 still preferred).
