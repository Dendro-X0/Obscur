# Transport Engine W48 — Pre-Authority-Flip Exit Evidence Review

**Status:** Evidence review + contract pins (no routing flip)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Review W41 pre-authority-flip exit checklist against delivered waves **W24–W47**, pin executable evidence references, and document the **maintainer gate** that must be satisfied before any Phase D port default flip (W30).

W48 does not change runtime routing.

## W41 exit checklist — evidence status

| # | W41 requirement | Evidence wave(s) | Status |
|---|-----------------|------------------|--------|
| 1 | Parity harness green (acceptance + failure modes) | W24–W29, W39 dry-run integration | **Pinned** — `verify:transport-engine-w39` |
| 2 | Network publish wired behind lab gate | W40–W46 (Rust assembly, relay pool, TS async routing) | **Pinned** — `verify:transport-engine-w46` |
| 3 | Network parity vs standalone owner | W47 network publish parity harness | **Pinned** — `verify:transport-engine-w47` |
| 4 | Shim gate policy documented; production default off | W38, W33 | **Pinned** — `shouldUseHostTransportPublishShim()` default `false` |
| 5 | Single mapper owner | W19–W20, W32, shared `publish-outcome-mapper.ts` | **Pinned** |
| 6 | Subtraction plan before standalone deletion | W30 Phase D + section below | **Documented** (not executed) |

## Maintainer gate (required before Phase D flip)

Authority flip (`relay-standalone-publish-port.ts` default → host path) is **blocked** until a maintainer explicitly records all of:

1. **Evidence green** — `pnpm verify:transport-engine-w47` and `pnpm verify:engine-lab` pass on the target commit.
2. **Network parity sign-off** — W47 harness fixture sets reviewed; no open semantic drift vs `mapLegacyPublishResultToRelayPublishResult`.
3. **Lab gate policy** — flip ships only behind a **new explicit env/policy flag** (separate from W38 shim opt-in); never silent default in production builds.
4. **Subtraction charter** — standalone owner quarantine path approved (see below).
5. **No silent fallback** — host failures must not auto-fallback to standalone without an explicit policy decision (W41 non-goal).

Until maintainer sign-off is recorded in handoff, **Phase D remains PAUSED**.

## Subtraction plan (pre-deletion, not executed in W48)

When Phase D is approved:

1. Introduce maintainer-only default flip flag (future wave; not W38 shim).
2. Route `publishToUrlsStandalone` / `publishToRelayStandalone` through host path by default when flag enabled.
3. Quarantine `transport-kernel-standalone-publish.ts` behind a `-legacy` or port-only shim for one release cycle.
4. Delete standalone owner only after network parity + live desktop smoke evidence.
5. Keep `mapLegacyPublishResultToRelayPublishResult` as sole semantics owner.

## Non-goals for W48

- No port authority flip.
- No enablement of `shouldUseHostTransportPublishShim` by default.
- No standalone owner deletion or quarantine move.

## Contract expectations (pinned in w48 tests)

W48 tests must assert:

- This evidence review charter exists with maintainer gate + W41 checklist mapping.
- W47 network parity harness module exists.
- `relay-standalone-publish-port.ts` still defaults to standalone kernel owner.
- Shim gate remains off under default policy.
