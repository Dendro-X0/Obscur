# Dependency Audit Triage (v0.8.0)

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._

## 1) Audit Command and Result

Command executed:

```bash
pnpm audit
```

Current result snapshot:

1. 20 vulnerabilities total
2. Severity: 13 high, 6 moderate, 1 low

Post-remediation snapshot (after dependency upgrades):

1. 16 vulnerabilities total
2. Severity: 12 high, 4 moderate
3. runtime-targeted `next` advisories removed after upgrade to `16.1.6`

## 2) Highest Priority Findings (P0)

1. `next@16.1.1` high/moderate advisories fixed in `>=16.1.5`
   - advisory: `GHSA-h25m-26qc-wcjf`
   - advisory: `GHSA-9g9p-9gw9-jx7f`
   - advisory: `GHSA-5f7q-jpqc-wp7h`
2. `rollup` path traversal advisories in tooling chain
   - advisory: `GHSA-mw96-cpmx-2vgc`
3. multiple `minimatch` ReDoS advisories in transitive dependencies
   - advisory: `GHSA-3ppc-4f35-3m26`
   - advisory: `GHSA-f8q6-p94x-37v3`
4. `ajv` ReDoS advisories in transitive dependency graph
   - advisory: `GHSA-2g4f-4pwh-qvx6`

## 3) Triage Classification

### Runtime-Exposed (must patch before v0.8.0 tag)

1. `next` vulnerabilities on `apps/pwa`.
2. any dependency reachable in production runtime request path.

### Dev-Tooling Exposure (patch if safe, else document risk acceptance)

1. `rollup` via test/build toolchain.
2. `minimatch`/`ajv` via eslint/build tooling.
3. `esbuild`/`undici` via `wrangler` local tooling chain.

## 4) Remediation Plan

1. done: upgraded `apps/pwa` `next` and aligned `eslint-config-next` to patched versions.
2. done: upgraded `hono` to patched baseline.
3. done: re-ran audit and recorded delta.
4. next: evaluate replacing or isolating `@ducanh2912/next-pwa` dependency chain (currently largest source of high findings).
5. next: evaluate safe dependency overrides for `rollup`, `minimatch`, `ajv`, and `serialize-javascript`.
6. next: if any high findings remain, open explicit risk acceptance entries with scope and compensating controls.

## 5) Evidence Tracking

1. First audit run: completed.
2. First remediation step: completed (`next@16.1.6`, `eslint-config-next@16.1.6`, `hono@4.11.10`, `vitest@4.0.18`).
3. Post-remediation audit run: completed.
4. Build validation after upgrade: completed (`pnpm -C apps/pwa build` passed).
5. Final risk acceptance note: pending.

## 6) Related References

1. [v0.8.0 Release Readiness Plan](./19-v0.8.0-release-readiness-plan.md)
2. [Threat Model and Security Checklist (v0.8.0)](./20-threat-model-and-security-checklist-v0.8.0.md)
