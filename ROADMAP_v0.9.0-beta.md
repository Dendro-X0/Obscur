# Obscur v0.9.0-beta Roadmap

Status: Active execution roadmap  
Created: 2026-03-17

Removal policy:
- This file must remain in the repository root.
- It may only be removed after all phases below are marked complete and the completion state has been pushed to the remote repository.

## Goal

Ship a stable cross-platform `v0.9.0-beta` with deterministic release gates, explicit architecture boundaries, and reduced cross-platform drift.

## Phase Plan

## Phase 0: Release Stabilization (Immediate)

Objective:
- Stop release churn by making the current gate failures deterministic and actionable.

Key outcomes:
- Resolve release test-pack failure(s) with canonical contract decisions.
- Enforce clean-head parity checks before tag/release.
- Ensure local and CI gate commands produce consistent results.

Exit criteria:
- `pnpm release:test-pack -- --skip-preflight` passes.
- `pnpm ci:scan:pwa:head` passes.
- Release preflight checks are green on `main`.

Status checklist:
- [x] P0.1 Canonical avatar URL contract finalized and test-aligned
- [x] P0.2 Release test pack green locally
- [x] P0.3 Clean-head CI scan green
- [x] P0.4 Preflight checks green

## Phase 1: Next.js + TanStack Data Architecture

Objective:
- Keep Next.js as app shell/router while introducing TanStack Query where it improves data consistency and cache discipline.

Key outcomes:
- Scoped query key contract (`profileId`, `publicKeyHex`, runtime capability).
- First migration slices: discovery/search, relay diagnostics, account-sync read surfaces.
- Documented invalidation policy per feature owner.

Exit criteria:
- Query usage lands in selected slices without lifecycle owner duplication.
- Cross-profile cache contamination tests pass.

Status checklist:
- [ ] P1.1 Query-key and invalidation contract approved
- [ ] P1.2 Discovery/search slice migrated
- [ ] P1.3 Relay/account-sync read surfaces migrated
- [ ] P1.4 Cache isolation tests passing

## Phase 2: Rust Core Boundary Tightening

Objective:
- Keep performance/security critical logic in Rust and reduce mixed ownership between TS and Rust.

Key outcomes:
- Rust as canonical owner for crypto/protocol verification/quorum/storage recovery primitives.
- TS remains owner for UI orchestration and runtime composition.
- Typed JS<->Rust contracts validated by dedicated tests.

Exit criteria:
- Critical protocol paths have explicit owner mapping and contract tests.
- No duplicate owners for security-sensitive state transitions.

Status checklist:
- [ ] P2.1 Ownership map completed
- [ ] P2.2 Contract hardening landed
- [ ] P2.3 Boundary tests passing

## Phase 3: Kotlin/Swift Adapter Hardening

Objective:
- Keep Kotlin/Swift layers thin and deterministic, delegating business/security logic to Rust core.

Key outcomes:
- Replace placeholder/simulated sync/decrypt paths with explicit FFI contract usage.
- Platform-secure secret storage policy enforced.
- Android/iOS behavior parity matrix documented and tested.

Exit criteria:
- Background sync and push flows call canonical native contracts.
- Security-sensitive fallback behavior is deterministic on both platforms.

Status checklist:
- [ ] P3.1 FFI adapter paths standardized
- [ ] P3.2 Secure storage policy applied
- [ ] P3.3 Parity matrix verified

## Phase 4: Beta Release Hardening and Repeatability

Objective:
- Make beta release generation repeatable and observable end-to-end.

Key outcomes:
- Artifact matrix and release checks consistently green.
- Version alignment and docs checks enforced.
- Release runbook aligned with current CI/runtime truth.

Exit criteria:
- Tag-triggered release pipeline completes green with correct versioned artifacts.
- Docs and changelog reflect final shipped behavior and known limitations.

Status checklist:
- [ ] P4.1 Full release workflow green
- [ ] P4.2 Artifact version parity verified
- [ ] P4.3 Final docs/changelog sync complete

## Command Gate (Must Pass Before Tag)

```bash
pnpm version:check
pnpm docs:check
pnpm release:test-pack -- --skip-preflight
pnpm ci:scan:pwa:head
pnpm release:artifact-matrix-check
pnpm release:ci-signal-check
pnpm release:preflight
```

## Governance Notes

- Follow canonical owner rules in `AGENTS.md`.
- Do not close a phase based on unit test success alone when runtime behavior diverges.
- Core messaging/auth/account-sync changes require two-user reasoning and evidence-backed outcomes.
