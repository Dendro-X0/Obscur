# Core Verification: Updater and Download Distribution

_Last reviewed: 2026-04-18 (baseline commit a3f16b10)._

This packet covers Lane 9 from:

1. `docs/trust/20-core-function-verification-matrix.md`

The goal is to prove that the desktop updater, release download routing, and
published release artifacts all agree on one canonical release truth, with
rollback-safe behavior when streaming install is unavailable or fails.

## Scope

This lane verifies:

1. desktop update eligibility and policy enforcement,
2. streaming updater manifest/feed contract validation,
3. release download fallback routing when streaming install is unavailable,
4. website `/download` release truth and platform targeting,
5. release workflow publication of `latest.json` and
   `streaming-update-policy.json`,
6. rollback-safe failure handling that preserves the current installed version.

## Canonical Owners

1. `apps/pwa/app/components/desktop-updater.tsx`
2. `apps/pwa/app/features/updates/services/streaming-update-policy.ts`
3. `apps/pwa/app/features/updates/services/release-download-targets.test.ts`
4. `.github/workflows/release.yml`
5. `apps/website/src/app/download/page.tsx`

Reference contracts and history:

1. `docs/roadmap/v1.3.8-streaming-update-contract.md`
2. updater/distribution checkpoints recorded in
   `docs/handoffs/current-session.md`

## Required Invariants

1. If streaming install is eligible and available, the app offers the correct
   in-app update path for the current platform.
2. If streaming install is unavailable, blocked, or feed publication is
   missing, the app must route the user to the correct download target instead
   of claiming “no update”.
3. Update policy must gate rollout, kill switch, min-safe, and blocked states
   deterministically.
4. Website and app updater must agree on current release/download truth.
5. Release workflow must publish the required update artifacts:
   - `latest.json`
   - `streaming-update-policy.json`
6. Any update install failure must preserve the current installed version and
   surface a rollback-safe user message.

## Automated Verification Set

Run:

```bash
pnpm -C apps/pwa exec vitest run app/features/updates/services/streaming-update-policy.test.ts app/features/updates/services/release-download-targets.test.ts
pnpm -C apps/pwa exec tsc --noEmit --pretty false
pnpm -C apps/website lint
pnpm -C apps/website exec tsc --noEmit
pnpm -C apps/website build
pnpm release:streaming-update-contract:check
pnpm release:artifact-matrix-check
pnpm docs:check
```

Expected focus:

1. `streaming-update-policy.test.ts`
   - manifest parsing,
   - rollout gating,
   - kill switch behavior,
   - min-safe / force-update signaling,
   - rollback-safe failure classification.
2. `release-download-targets.test.ts`
   - platform inference,
   - preferred installer selection,
   - website/app shared download target contract.
3. `desktop-updater.tsx`
   - app-side fallback behavior should be inspected against current release
     truth even if no dedicated component suite exists yet.
4. `.github/workflows/release.yml`
   - updater feed generation,
   - artifact publication,
   - required artifact matrix.
5. website `/download`
   - build-time release/download rendering remains green.

## Manual Replay Set

Run on desktop for at least one prior stable build and the current candidate or
published tag where possible:

1. check for updates on a build below the latest stable version,
2. verify whether the live release channel exposes:
   - `latest.json`
   - `streaming-update-policy.json`
3. if streaming install is available, execute the in-app install success path,
4. if streaming install is unavailable, verify the updater routes to the
   correct platform download target instead of a false “up to date” result,
5. test a blocked or holdback case if a policy manifest is available,
6. test an install/download failure path and verify the app preserves the
   current version with a deterministic user-visible message,
7. verify website `/download` shows the same platform target the app would pick.

## Evidence To Capture

Primary artifacts and probes:

1. `pnpm release:workflow-status -- --tag <tag>`
2. live release URLs:
   - `https://github.com/Dendro-X0/Obscur/releases/latest/download/latest.json`
   - `https://github.com/Dendro-X0/Obscur/releases/latest/download/streaming-update-policy.json`
3. updater UI state from desktop settings/background surface,
4. website `/download` rendered target for the active platform.

Capture:

1. current installed version,
2. latest published version/tag,
3. whether feed and policy artifacts exist live,
4. whether updater chose `streaming`, `download_only`, or `blocked`,
5. which installer URL/asset label was selected,
6. whether failure preserved the current installed version.

## Pass Criteria

This lane passes only if:

1. automated suites and release contract checks are green,
2. live release artifacts expose the expected updater feed and policy manifest,
3. desktop runtime confirms either:
   - successful in-app streaming install, or
   - correct deterministic fallback download routing,
4. updater failures preserve the current installed version,
5. website and app updater agree on release/download truth for the tested
   platform.
