# RIW-6 — Profile picker verify scenario pass/fail matrix

Date: 2026-07-01  
Script: `scripts/verify-profile-picker-flow.mjs`  
Scenario ID: `obscur-profile-picker-flow`  
MCP golden path CDP: **9230** (script default probe: **9222**)

## Matrix

| # | CDP state | `appBase` | Obscur running | Result | Failure class |
|---|-----------|-----------|----------------|--------|---------------|
| A | Unavailable (9222 down) | 3341 static shell | n/a | **FAIL** | Mocked shell — picker grid not shown (`vrun-31d8d75b`) |
| B | 9222 = CodaCtrl Studio | 3341 | Obscur on 9230 | **FAIL** | `No Obscur page on CDP` — wrong debug port |
| C | 9230 = Obscur | 3341 (default) | yes | **FAIL** | `page.goto` → `:3341/profiles` CONNECTION_REFUSED |
| D | 9230 = Obscur | `OBSCUR_APP_BASE=1430` | unstable | **FAIL** | Intermittent `No Obscur page` (Playwright CDP attach) |
| E | 9230 + MCP attach | n/a (clicks) | yes | **PASS** | Unlock Tester1 via `client_interact_click` (RIW-1 session) |

## Artifact paths

- CDP down: `.codectx/verify/runs/vrun-31d8d75b/artifacts/script-2-{stdout,stderr}.txt`
- CDP 9222 default: `.codectx/verify/artifacts/riw-6-profile-picker-cdp-9222-default.txt`
- CDP 9230 wrong appBase: `.codectx/verify/artifacts/riw-6-profile-picker-cdp-9230-obscur.txt`
- Timeout (30s): `.codactrl/verify/runs/vrun-acd02d38/scenario-results.json`

## Root causes (capture-only)

1. **Port collision:** Script auto-detects `:9222` only; Studio often owns 9222 while Obscur uses 9230.
2. **appBase mismatch:** CDP path navigates to `OBSCUR_APP_BASE` default `:3341`; live Tauri serves `:1430`.
3. **False-negative mocked path:** Static shell at 3341 renders `PROFILES` header but not `Who's using Obscur?` grid — scenario fails even when product works via CDP/MCP.
4. **False-green risk:** Scenario `fileExists` + `fileContains` steps pass while `scriptInvoke` fails — verify run is red but static gates are green.

## Recommended scenario gate (document only — no code)

| Recommendation | Rationale |
|----------------|-----------|
| **`skip`** when no Obscur CDP on `profileCdpPorts` (9230→9231→9229) | Avoid mocked-shell false failure |
| **Preflight** `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9230` in verify docs | Align with MCP `obscurGoldenPath` |
| **`--cdp` required** or probe `profileCdpPorts` from `client.cdp.yaml` | Stop attaching to Studio on 9222 |
| **Default `OBSCUR_APP_BASE=http://127.0.0.1:1430`** for Tauri static asset server | Fix CONNECTION_REFUSED on goto |
| **Do not treat mocked shell as T3 proof** | Tier t2 at best; live CDP is t3 |
