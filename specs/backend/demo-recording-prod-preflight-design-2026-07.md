# Design — Demo recording without 30‑minute rebuild loops

**Status:** Active · 2026-07-28  
**Band:** v1.9.14 demo / Full Release prep  
**Out of scope:** AUTH-SESSION-1 silent unlock · community roster · changing packaged defaults

---

## Problem

Recording needs a **production** surface (online relays, no offline stub, real NativeRelay). Full `pnpm desktop:package` (~30 min) before every clip discovery loop means errors are found only during recording.

## Policy

| Do | Don't |
|----|-------|
| Fail bugs on **release exe** (`tauri build --no-bundle`) or prod-parity Tauri before NSIS | Use default `dev:desktop` (offline stub) as “prod enough” |
| Run L1 preflight before any long build | Start ScreenToGif on an unsmoked installer |
| Package NSIS **once** after smoke green | Rebuild installer to discover F5 / offline / Tor bugs |

## Ladder (time ↑)

1. **`pnpm desktop:demo-preflight`** — L1 vitest for auth reload, NativeRelay, mesh WS, Tor apply policy (~1–3 min).
2. **`pnpm desktop:build:exe`** — production static shell + release binary, **no NSIS** (~much less than full package when Rust is warm; use `--skip-shell` after first shell build).
3. **Manual smoke on** `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe`:
   - Relays leave offline with Tor off
   - F5 exits “Restoring session…” ≤ ~12s (login or shell)
   - Account create / unlock path for Phase 1 clip 3
4. **`pnpm desktop:package`** — one installer for download/install clip + final artifacts.
5. Record.

## Scripts

| Script | Role |
|--------|------|
| `desktop:demo-preflight` | L1 gates + print ladder |
| `desktop:build:exe` | `tauri build --no-bundle` (+ optional `--skip-shell`) |
| `desktop:package` | Full NSIS — only after step 3 green |

## Claim language

- Preflight green ≠ demo-ready.
- Release exe smoke green ≠ installer L3 (Tor sidecar layout, SmartScreen path).
- Demo “verified” only after maintainer cold run on the installer used for recording.
