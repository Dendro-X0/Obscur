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
```

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
