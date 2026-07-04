# Dev Lab Phase 2 — personas, reversibility, security scenarios

**Status:** Active (2026-06-12)  
**Parent:** [dev-lab-spec.md](./dev-lab-spec.md) · [v1.9.5-phase-b-manual-matrix.md](./v1.9.5-phase-b-manual-matrix.md)

---

## Purpose

Extend Dev Lab from **Phase 1 benchmarks** into a **reversible abuse/edge-case harness** so SEC-B / BOT / membership zombie paths can be exercised programmatically without manual two-window clicking.

---

## Contracts

| Concern | Owner | Rule |
|---------|-------|------|
| Ephemeral identities | `dev-lab-persona.ts` | In-memory only; label `zombie:*`; teardown on scenario end |
| Leave zombie gates | `dev-lab-membership-leave-zombie-scenario.ts` | Pure policy; mirrors E-REL directory sidebar repair gate |
| BOT keyword flood | `dev-lab-bot-inbound-flood-policy.ts` | Mirrors `scripts/lib/community-bot-inbound.mjs` — no relay I/O |
| Scenario registration | `dev-lab-scenario-catalog.ts` + manifest | Full suite only until stable |

**Non-goals (Phase 2 slice 1):** live relay runner integration, PC-restart CLI for membership, TRUST banner DOM automation.

---

## Window API (personas)

```javascript
const persona = window.obscurDevLab.createZombiePersona({ label: "abuse" })
await window.obscurDevLab.unlockZombiePersona(persona.id) // optional — import/unlock ephemeral key
window.obscurDevLab.listZombiePersonas()
window.obscurDevLab.teardownZombiePersona(persona.id)
window.obscurDevLab.teardownAllZombiePersonas()
```

Personas never persist beyond the registry unless explicitly unlocked (same bound-profile rules as Tester1/2).

---

## Scenarios (Phase 2 slice 1)

| ID | Maps to | Type |
|----|---------|------|
| `membership-leave-rejoin-zombie` | E-REL NewTest 1 stay-left | Pure policy |
| `sec-bot-keyword-flood` | BOT-1 + BOT-2 partial | Synthetic flood + allowlist |

## Scenarios (Phase 2 slice 2)

| ID | Maps to | Type |
|----|---------|------|
| `trust-fixtures` | TRUST-1..3 | Synthetic `assessDmTrustWarning` + zombie peer |
| `auth4-scope-probe` | AUTH-4 partial | In-app scope fingerprint vs Tester2 reference |
| `auth4-scope-probe-live` | AUTH-4 | CLI dual browser + reload + digest |
| `membership-leave-rejoin-live` | E-REL restart class | CLI dual browser + Tester2 reload + zombie gates |

Run:

```bash
pnpm dev:lab:run -- --scenario membership-leave-rejoin-zombie
pnpm dev:lab:run -- --scenario sec-bot-keyword-flood
pnpm dev:lab:run -- --scenario trust-fixtures
pnpm dev:lab:run -- --scenario auth4-scope-probe-live
pnpm dev:lab:run -- --scenario membership-leave-rejoin-live
pnpm dev:lab:full   # includes in-app + CLI tail scenarios
```

---

## Next slices

1. TRUST banner DOM automation (recipient-only banner visibility)
2. BOT-1 live inbound runner integration in Dev Lab CLI
3. Actual leave UI automation for membership-leave-rejoin-live

---

## Verification

```bash
pnpm verify:dev-lab
```

Unit coverage: persona registry, leave zombie gates, inbound flood policy, manifest drift.
