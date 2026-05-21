# Manual verification environment

**Status:** Active — required for all demo matrices and pre-tag sign-off through **v2.0.0**  
**Related:** [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md), demo matrices under `docs/assets/demo/`

---

## Canonical setup (maintainer)

| Item | Value |
|------|--------|
| **Surface** | **Desktop app** (Tauri) — primary evidence for community, DM, governance, and UX lanes |
| **Profiles** | **Two** windows in one machine, same desktop build |
| **Account A** | **Tester 1** — use **dark** theme in screenshots |
| **Account B** | **Tester 2** — use **light** theme in screenshots |
| **Third account** | **None** — do not assume a third peer for quorum unless a matrix row explicitly uses relay-only evidence |
| **Mobile** | Deferred to **v1.8.x** Lane **M** after install/signing path works (see 2.0 roadmap) |

---

## How to run A/B on desktop

1. Launch Obscur desktop twice (two profile windows) or use built-in multi-profile switching per your usual workflow.
2. Lock themes before capturing: **Tester 1 → dark**, **Tester 2 → light** (settings → appearance).
3. For community flows, label screenshots `A-dark` / `B-light` in demo folders.
4. Record **Pass** only when **both** profiles show expected behavior (or the row documents single-profile scope).

---

## What counts as “manual verification done”

A version band (e.g. **v1.7.x**) is not release-ready until:

1. Every **Pass** column in that band’s demo matrix is checked on desktop A/B where applicable.
2. Regressions found in manual pass are **fixed or filed** in [v1.5.0-known-issues-and-investigation-queue.md](./v1.5.0-known-issues-and-investigation-queue.md) before tag.
3. `pnpm release:test-pack` is green on the commit being tagged.

Automated tests do **not** replace the matrix for governance, invite, relay gate, or cross-profile membership rows.

---

## Mobile verification (later)

When Lane **M** opens:

- **Environment:** Android Studio emulator or USB device with **local/decentralized signing** (no purchased store certificates).
- **Parity:** Same monorepo version as desktop tag; shared kernel behavior, native shell only where documented.
- Extend matrix rows with `M-dark` / `M-light` only after install path is proven — until then, desktop A/B remains authoritative.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-21 | Initial environment: Tester 1/2, dark/light, desktop-first, no third account |
