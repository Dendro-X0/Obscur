# Repository strategy — new repo vs current monorepo

**Status:** Draft — concept phase  
**Last updated:** 2026-05-19  
**Decision:** **New repository for implementation** + **controlled extraction** of reusable assets from Obscur (this monorepo).

---

## Recommendation (summary)

| Approach | Verdict |
|----------|---------|
| Continue building greenfield **inside** `newstart` (Obscur monorepo) | **Not recommended** — high risk of old paths, docs, and hooks resurfacing |
| **New repo** + copy/extract only allowlisted packages/UI | **Recommended** |
| Migrate entire monorepo wholesale | **Not recommended** — imports coupling, Nostr/community debt |

**This repository (`newstart`):** archive + reference + source for extractions. Greenfield specs live in `docs/greenfield/` until copied or linked from the new repo README.

---

## Why not continue in the current repo

| Risk | Cause |
|------|--------|
| Old problems recur | `apps/pwa` groups/Nostr/coordination paths remain importable |
| Wrong owner for truth | `use-sealed-community`, relay pool, v1.9 program docs |
| Agent/human confusion | Handoffs, `docs/program/`, `.env.local` Obscur flags |
| Scope creep | “Fix one more Obscur bug” before Phase 1 gate |
| False progress | Typecheck green while greenfield invariants untested |

Isolation in the same repo (e.g. `apps/next-product/`) **reduces** but does not remove these risks unless Obscur apps are removed or frozen behind explicit archive boundaries.

---

## Why not blank-slate without extraction

| Asset | Reuse value | Coupling risk if whole monorepo copied |
|-------|-------------|----------------------------------------|
| `@dweb/ui-kit` | High — pure UI | Low |
| `@dweb/crypto` | High — keys, types | Low–medium |
| `@dweb/db` / `@dweb/storage` | Medium — adapt for SQLite-first | Medium |
| `@dweb/core` (profile bus) | Medium — evaluate per Phase 1 | Medium |
| `@dweb/client-gateway` | Low early — Obscur-shaped | High |
| `@dweb/nostr`, `dweb-transport-nostr` | Phase 4 only | **High** — do not import in Phase 1–2 |
| `apps/pwa/features/groups/*` | Low — replace per greenfield directory model | **High** |
| `apps/coordination` | Pattern reference — simplify new courier | Medium |

Incremental extract **avoids** replaying Nostr-as-membership and triple truth sources.

---

## Recommended layout

### Repository A — `newstart` (Obscur)

- Status: **Archived** (root `ARCHIVE.md` optional).
- Keep: history, docs, demo of what failed.
- No new feature work on Obscur trunk unless security-critical.
- `docs/greenfield/` may remain here as spec source or be copied to Repo B.

### Repository B — greenfield product (name TBD)

```text
repo-b/
  apps/
    client/          # Tauri or native shell — Phase 1
    courier/         # minimal directory + envelope sync — Phase 1–2
  packages/
    ui/              # extracted from @dweb/ui-kit (rename optional)
    crypto/          # extracted from @dweb/crypto
    protocol/        # TransportPort, DirectoryPort — new
    warnings/        # rule packs — Phase 3
  docs/              # copy or submodule link to greenfield specs
  pnpm-workspace.yaml
```

**Phase 1 dependency rule:** No imports from Repo A. Only copied files in Repo B.

---

## Extraction process (incremental, low pain)

| Step | Action |
|------|--------|
| 1 | Create Repo B with Phase 0 tests + empty `apps/client` |
| 2 | **Copy** (not workspace-link) `packages/ui-kit` → `packages/ui` — fix package name, run UI smoke |
| 3 | Copy `dweb-crypto` minimal surface needed for 1:1 E2EE |
| 4 | Copy messaging **UI components** only (presentational) — strip Obscur-specific hooks |
| 5 | Implement new `TransportPort` + courier — **do not** import `dweb-nostr` until Phase 4 |
| 6 | Optional: `git subtree` or internal npm `@yourscope/crypto` if two repos need sync later |

**Avoid:** `pnpm link` to Repo A long-term — ties release cycles and revives old types.

**Prefer:** one-time copy + changelog “extracted from Obscur @ commit SHA”.

---

## What to retain from Obscur (allowlist)

### Keep (copy early)

- `packages/ui-kit/**` — components, tokens, `cn` utility
- `packages/dweb-crypto/**` — key material, E2EE primitives (audit before trust)
- Selected PWA components: message bubble, list shell, dialog patterns — **after** removing group/Nostr imports
- `docs/greenfield/**` — charter, phases, security, scope

### Reference only (read, do not import)

- `community-trust-policy` ideas → greenfield rule packs
- `apps/coordination` — signed delta pattern, simplified
- `community-relay-transport` guards — relay adapter Phase 4, not Phase 1

### Do not carry

- `features/groups` sealed community, CRDT membership as authority
- `use-sealed-community`, relay pool as roster owner
- v1.9.x program execution, `NEXT_PUBLIC_DEV_COORDINATION_ONLY_*` workarounds
- Public relay default lists as product truth

---

## If forced to stay in one repo (second-best)

Only if a new remote is impossible short-term:

1. Add `apps/sovereign-client/` + `packages/sovereign-*` — **no** imports from `apps/pwa` or `@dweb/nostr`.
2. Mark `apps/pwa`, `apps/desktop`, `apps/coordination` as `archived` in root README; remove from default `pnpm dev`.
3. Move `docs/greenfield` to `docs/` root of new app; stop updating `docs/program/v1.9*`.
4. CI: only build `apps/sovereign-*` on greenfield branch.

Exit to Repo B when Phase 1 gate passes.

---

## Decision checklist

Choose **new repo** when:

- [x] Greenfield specs are frozen (this folder)
- [x] Obscur failures were structural, not cosmetic
- [x] You want Phase 1 gate without Nostr in the dependency graph
- [x] UI/crypto reuse is intentional extract, not drag-along

Choose **same repo** only when:

- [ ] You need Tauri/desktop wiring **this week** and cannot copy shell yet
- [ ] You accept strict import lint + archived apps

---

## Handoff when creating Repo B

1. Copy `docs/greenfield/` → `docs/` in new repo.
2. Add README: “Extracted UI/crypto from Obscur monorepo @ `<sha>`; not compatible with Obscur runtime.”
3. Implement Phase 0 tests before any UI port.
4. Link Repo A as archived reference in README, not as workspace dependency.

**Checklists:** [08-extraction-manifest.md](./08-extraction-manifest.md) · [09-phase0-bootstrap-checklist.md](./09-phase0-bootstrap-checklist.md) · [templates/](./templates/)
