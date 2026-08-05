# Design — Prod-first validation + multi-transport defaults (2026-08)

**Status:** Implementation slice (maintainer mandate)  
**Date:** 2026-08-02 (UTC)  
**Handoff:** `docs/handoffs/current-session.md` — Prod ≡ Dev · scrap lab illusion  
**Supersedes (product boot):** [r-relay-rust-2-defaults-design-2026-07.md](./r-relay-rust-2-defaults-design-2026-07.md) (local Dev Mesh as cold default)  
**Aligns:** [production-tor-opt-in-public-default-design-2026-07.md](./production-tor-opt-in-public-default-design-2026-07.md) · Conduit Mesh multi-dialect catalog

---

## Maintainer requirements

1. **Eliminate the Dev Lab approach as a pass criterion.** Feature iterations prioritize **production-mode** functionality. Dev Lab / experiment shell / Docker-only Soft L3 Pass ≠ done.
2. **Relay network supports multiple communication methods** (catalog dialects). Users may choose public or private paths; **E2EE stays client-owned** on every path.
3. **Nostr and Tor remain first-class** for further evaluation.
4. **Default transport:** public Nostr (**Default Stable**).
5. **Tor:** remains on the catalog as a default *evaluation option*, but is **optional** — never auto-starts; Apply requires Tor ready + user confirmation/configuration.

---

## Validation policy (non-negotiable)

| May claim | Only when |
|-----------|-----------|
| Implemented / Verified / Fixed | Evidence from **production-identical** shell (release flags / packaged desktop), not Dev Lab |
| Soft L3 / delivery | Two profiles on **user-facing** transport (public pack or explicitly applied private pack) — **not** lab-only `:7000` as sole path |

| Forbidden as success | Notes |
|----------------------|--------|
| `obscurDevLab` / `pnpm dev:lab:*` Pass | Already tombstoned (`DEV_LAB_TOMBSTONED`) — keep refuse scripts |
| Local Dev Mesh / Docker required for “app works” | Optional pack only |
| Experiment shell online-only gates | Not product proof |

Canonical policy doc: [prod-first-validation-policy-2026-08.md](../../docs/program/prod-first-validation-policy-2026-08.md).

---

## Product boot (subtract RUST-2 local default)

| Surface | Before (RUST-2) | After (this mandate) |
|---------|-----------------|----------------------|
| `PRODUCT_BOOT_TRANSPORT_PRESET` | `local_dev_mesh` | `default_stable` (public Nostr) |
| `DEFAULT_RELAYS` | `ws://localhost:7000` only | Same URLs as Default Stable (enabled) |
| Transport mode cold default | `basic` | `redundancy` (matches Default Stable) |
| Preset group order | private_mesh first | **public_nostr** → **tor** → private_mesh → hybrid |
| Tor at boot | Off | **Off** (unchanged) |
| Tor pack Apply | Fail-closed until ready | Unchanged + confirm on replace |

Local Dev Mesh / LAN / HTTP mesh / SSH remain **selectable** packs — not boot.

---

## Mental simulation

1. Fresh profile, production desktop → Relays list shows `nos.lol` / `primal` / `damus` (or current Default Stable set) — **no Docker required**.
2. User never touches Tor → Tor stays off; no sidecar.
3. User applies Tor onion pack → confirm replace if list non-empty → blocked until Tor configured+ready → user must enable Tor in Security and fill onion URL template.
4. Operator who wants lab relay applies **Local Dev Mesh** explicitly — optional.

---

## Owners

| Concern | Module |
|---------|--------|
| Boot preset | `transport-preset-catalog.ts` |
| Cold relay list | `use-relay-list.ts` |
| Mode default | `relay-transport-mode.ts` |
| Tor apply / badge | `transport-preset-apply-policy.ts` |
| Dev Lab refuse | `dev-lab-tombstone-policy.ts` · `scripts/dev-lab-tombstone.mjs` |

---

## Out of scope this slice

- Claiming public Nostr delivery fixed / Soft L3 Pass
- Unpausing COM-RUN groups
- Auto-starting Tor
- Deleting private_mesh presets from catalog
- Removing Docker compose from repo (lab tooling may exist; must not be product gate)

---

## Proof (L1)

- `transport-preset-catalog.test.ts` — boot = `default_stable`; groups order; Tor `requiresTor`
- `transport-preset-apply-policy.test.ts` — Tor blocked until ready; confirm replace
- `relay-transport-mode.test.ts` — cold default redundancy
- `use-relay-list` / preset-match tests updated away from local-only boot
- `verify:dev-lab` remains tombstone/policy Pass (not scenario success)
