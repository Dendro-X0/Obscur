# Operational Runbooks Per App

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


This is the practical runbook for each workspace app.

## 1) `apps/pwa`

### Dev

```bash
pnpm -C apps/pwa dev
```

### Build

```bash
pnpm -C apps/pwa build
pnpm -C apps/pwa start
```

### Quality gates

```bash
pnpm -C apps/pwa exec tsc --noEmit
pnpm -C apps/pwa lint
pnpm -C apps/pwa test:run
pnpm release:test-pack
```

### Relay/NIP diagnostics

```bash
pnpm probe:relay-nip
pnpm probe:relay-nip -- --json
```

Notes:

1. CLI probe and Dev Panel probe card use the same shared `relay-nip-probe` module.
2. Probe snapshot should be used before/after relay churn incidents to confirm socket/publish/subscribe/NIP-11/NIP-96 viability with typed reason codes.

## 2) `apps/desktop`

### Dev

```bash
pnpm -C apps/desktop dev
```

### Build

```bash
pnpm -C apps/desktop build
```

Notes:

- `predev` and `prebuild` run sidecar cleanup + tor setup scripts.
- verify native runtime starts cleanly after script prep.

## 3) `apps/coordination`

### Dev

```bash
pnpm -C apps/coordination dev
```

### Deploy

```bash
pnpm -C apps/coordination deploy
```

### Local D1 migration

```bash
pnpm -C apps/coordination db:migrate
```

## 4) `apps/relay-gateway`

### Dev

```bash
pnpm -C apps/relay-gateway dev
```

### Build + start

```bash
pnpm -C apps/relay-gateway build
pnpm -C apps/relay-gateway start
```

## 5) `apps/website`

### Dev

```bash
pnpm -C apps/website dev
```

### Build

```bash
pnpm -C apps/website build
pnpm -C apps/website start
```

## 6) Root Script Mismatch Notice

Current root scripts reference an API app path (`dev:api`, `build:api`), but that app directory is not present in this workspace.

Source:

- `package.json` at repo root

Maintainer policy:

1. do not assume root `dev:api`/`build:api` are valid.
2. use per-app scripts listed above.
3. when updating root scripts, keep this runbook in sync.

## 7) Release-Day Checklist (All Apps)

1. run `pnpm version:sync` and commit synchronized release manifests.
2. run `pnpm version:check` and confirm strict version alignment.
3. run `pnpm docs:check` and confirm docs integrity.
4. run quality gates for changed apps.
5. run production builds for changed apps.
6. sanity test startup and primary flows.
7. update `CHANGELOG.md`.
8. tag and publish artifacts.

## 8) v0.9 Recovery Toggles and Unstable Paths

For current recovery branches, treat these paths as unstable unless explicitly re-enabled:

1. Deterministic discovery lifecycle UI (resolver + outbox full flow)
2. Legacy invite-code-only onboarding dependency
3. API `/v1/health` probe assumptions in PWA-only environments

Canonical ownership/status reference:

1. `docs/38-v0.9-rescue-wave0-api-function-audit-matrix.md`

Runtime toggles:

1. `stabilityModeV090=true`:
- forces safe Add Friend path (`contact-card | npub | hex`)
- hides advanced deterministic discovery UI
2. `deterministicDiscoveryV090=false`:
- keeps resolver/outbox primitives present but UI-disabled by default
- enable only for Wave B validation runs
3. `protocolCoreRustV090=false`:
- keeps Rust protocol adapter path disabled by default
- required prerequisite before enabling deterministic discovery in staged runs
4. `x3dhRatchetV090=false`:
- keeps full X3DH + ratchet rewrite disabled by default
- enable only after Wave C crypto/session gates pass

Maintainer note:

1. Keep web-dev + desktop two-user flow in parity for add/request testing.
2. Never require global search for friend add in recovery mode.
3. Flag dependency policy: `stabilityModeV090=true` forces `deterministicDiscoveryV090=false`, `protocolCoreRustV090=false`, `x3dhRatchetV090=false`.

Protocol rollout matrix:

1. `stability only`: `stabilityModeV090=true`, all other v0.9 flags off.
2. `protocol-core`: `stabilityModeV090=false`, `protocolCoreRustV090=true`, `x3dhRatchetV090=false`.
3. `protocol-core + x3dh`: `stabilityModeV090=false`, `protocolCoreRustV090=true`, `x3dhRatchetV090=true`.
