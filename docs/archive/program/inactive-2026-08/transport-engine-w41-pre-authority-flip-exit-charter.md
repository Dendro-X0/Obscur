# Transport Engine W41 — Pre-Authority-Flip Exit Charter

**Status:** Charter + contract pins (design-only; no routing flip)  
**Last updated:** 2026-06-25  
**Band:** ENGINE-LAB / transport-engine post-B5

## Goal

Pin the **exit checklist** that must be satisfied before `relay-standalone-publish-port.ts` defaults to the host path (W30 Phase D), without performing the flip in this wave.

W41 is design + contract only.

## Exit checklist (all required before authority flip)

1. **Parity harness green** — W24–W39 evidence including dry-run integration.
2. **Network publish wired** — Rust returns real per-relay outcomes behind lab gate (post-W40).
3. **Network parity proven** — headless harness compares host network results vs standalone owner for fixture sets.
4. **Shim gate policy documented** — production default remains off; flip is explicit maintainer decision.
5. **Single mapper** — `mapLegacyPublishResultToRelayPublishResult` remains sole outcome semantics owner.
6. **Subtraction plan** — `transport-kernel-standalone-publish.ts` quarantine path documented before deletion.

## Non-goals for W41

- No default enablement of `shouldUseHostTransportPublishShim`.
- No standalone owner deletion.
- No silent fallback from host failures to legacy standalone.

## Contract expectations (pinned in w41 tests)

W41 tests must assert:

- This charter exists with exit checklist items.
- `relay-standalone-publish-port.ts` still routes to standalone kernel owner by default.
- Shim gate remains off under default policy.
