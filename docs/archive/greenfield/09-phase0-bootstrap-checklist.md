# Phase 0 bootstrap checklist — new repository

**Status:** Draft  
**Last updated:** 2026-05-19  
**Prerequisite:** [07-repository-strategy.md](./07-repository-strategy.md) decision accepted

---

## Overview

```text
Day 0–1   Repo skeleton + docs
Day 1–2   Extract ui + crypto (Tier 1)
Day 2–3   Phase 0 tests scaffold (no full product)
Day 3–5   Charter review freeze → Phase 1 branch
```

---

## 1. Create repository

- [ ] New empty Git repo (private or public — your choice)
- [ ] Add README from [templates/new-repo-README.md](./templates/new-repo-README.md)
- [ ] Add LICENSE (same as Obscur or new)
- [ ] `pnpm-workspace.yaml` from [templates/pnpm-workspace.yaml](./templates/pnpm-workspace.yaml)
- [ ] Root `package.json` from [templates/package.json.root](./templates/package.json.root)
- [ ] `.gitignore` (Node, Tauri, `.env.local`, `target/`, `.next/`)
- [ ] Record `SOURCE_SHA` from Obscur in README (see extraction manifest)

---

## 2. Copy specifications

- [ ] Copy entire `docs/greenfield/` → new repo `docs/`
- [ ] Verify read order in `docs/README.md` (rename from greenfield README if desired)
- [ ] Copy [08-extraction-manifest.md](./08-extraction-manifest.md)

---

## 3. Extract Tier 1 packages

Per [08-extraction-manifest.md](./08-extraction-manifest.md):

- [ ] `packages/ui-kit` → `packages/ui`
- [ ] `packages/dweb-crypto` (allowlist) → `packages/crypto`
- [ ] `pnpm install` at root
- [ ] `pnpm -C packages/ui exec tsc --noEmit` (or project equivalent)
- [ ] Stub `apps/client` with one page rendering Button + Toast

---

## 4. Scaffold ports (stubs only)

- [ ] `packages/protocol/src/transport-port.ts` — interface from [04-architecture-sketch.md](./04-architecture-sketch.md)
- [ ] `packages/protocol/src/directory-port.ts` — stub
- [ ] `packages/warnings/` — empty `manifest.json` placeholder for Phase 3

No implementation required in Phase 0 beyond type definitions.

---

## 5. Phase 0 acceptance tests (scaffold)

Create `tests/phase0/` with **skipped** or **fixture-only** tests mirroring [01-phase-roadmap.md](./01-phase-roadmap.md):

| ID | File (suggested) |
|----|----------------|
| T0-1 … T0-10 | `tests/phase0/charter.test.ts` |
| S-1 … S-5 | `tests/phase0/security.test.ts` |

- [ ] Tests exist and document expected behavior
- [ ] CI runs tests (many `test.skip` until Phase 1)
- [ ] README lists how to run: `pnpm test:phase0`

---

## 6. Tooling baseline

- [ ] TypeScript 5.x strict
- [ ] Vitest
- [ ] ESLint (optional minimal)
- [ ] No Nostr, no Wrangler, no Obscur scripts in root `package.json`

---

## 7. Obscur archive linkage

- [ ] README section “Legacy” → link to Obscur repo + `SOURCE_SHA`
- [ ] Obscur repo: ensure [ARCHIVE.md](../../ARCHIVE.md) exists at root

---

## 8. Freeze charter (exit Phase 0)

- [ ] Review [00-charter-sovereign-comms.md](./00-charter-sovereign-comms.md) — no open moral/technical conflicts
- [ ] Review [05-security-data-classes.md](./05-security-data-classes.md) + [06-scope-of-responsibility.md](./06-scope-of-responsibility.md)
- [ ] Threat model one-pager written (`docs/threat-model.md` — optional summary from 05)
- [ ] Privacy nutrition label draft (`docs/privacy-label-draft.md` — bullet list of C/D)
- [ ] Kill criteria acknowledged in README
- [ ] Tag `phase-0-frozen` on git

---

## 9. Phase 1 branch (do not start until §8 complete)

- [ ] Branch `phase-1-dm-core`
- [ ] Implement courier minimal (envelope only)
- [ ] E2EE 1:1 per roadmap — **no** groups, **no** Nostr

---

## Anti-patterns (stop if tempted)

- Importing from Obscur via `pnpm link` or git submodule to `apps/pwa`
- Copying `features/groups` “to save time”
- Running Obscur `pnpm dev:desktop` as the greenfield dev loop
- Adding `NEXT_PUBLIC_*` Obscur coordination flags to new `.env.local`

---

## Done definition for Phase 0 bootstrap

Phase 0 bootstrap is **done** when:

1. New repo builds stub client with extracted UI.
2. All greenfield docs present.
3. Phase 0 test scaffold + CI green (skips allowed).
4. `phase-0-frozen` tag exists.
5. No dependency on Obscur runtime packages beyond copied Tier 1.
