# Transport Engine W53 — Maintainer Smoke Runbook

**Status:** Maintainer-only (band PAUSED until sign-off)  
**Last updated:** 2026-06-26  
**Charter:** [transport-engine-w53-live-desktop-publish-smoke-charter.md](./transport-engine-w53-live-desktop-publish-smoke-charter.md)  
**Sign-off:** [transport-engine-smoke-sign-off-recorded.md](../handoffs/transport-engine-smoke-sign-off-recorded.md)  
**Deletion index:** [transport-engine-standalone-legacy-subtraction-index.md](./transport-engine-standalone-legacy-subtraction-index.md)

## Purpose

Step-by-step guide for the **manual desktop smoke** that unblocks standalone legacy deletion. Agents do not execute smoke or flip `Decision: PASS`.

---

## Phase 1 — Programmatic pre-flight

On the smoke commit:

```bash
pnpm verify:transport-engine-w68
pnpm verify:standalone-legacy-subtraction-prep
```

`verify:transport-engine-w52` / `w53` are backward-compatible aliases to the same flat gate.

Prep report must show `prepBandComplete: true` (gate may still show `gateApproved: false` — expected).

---

## Phase 2 — Desktop smoke env

Build/run desktop with **strict engine-lab mode** and host publish gates:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY` | **unset** or `0` (must not be `1`) |
| `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY` | `1` |
| `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK` | `1` |

Example (bash, from repo root):

```bash
pnpm dev:desktop:transport-smoke
```

Or export manually then `pnpm dev:desktop:online`. See [obscur-kernel-ui-desktop-test-checklist.md](./obscur-kernel-ui-desktop-test-checklist.md).

Use a profile with configured relays. See W53 charter checklist steps 2–7.

---

## Phase 3 — Evidence capture

Record in the sign-off template:

- Journal source `transport_kernel_host_publish_shim` (authority on)
- Invoke `engine_invoke_transport_publish_relay_event` (network on)
- Multi-relay publish summary (success count, quorum, failures)
- Authority **off** → legacy `-legacy.ts` fallback still works (step 7)

Copy completed template into [transport-engine-smoke-sign-off-recorded.md](../handoffs/transport-engine-smoke-sign-off-recorded.md) with `Decision: PASS`.

---

## Phase 4 — Deletion execution (after PASS only)

1. Set `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1` in the maintainer shell.
2. `node scripts/execute-transport-standalone-legacy-subtraction.mjs` — must exit 0.
3. Follow [W66 mechanical commit](./transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md).
4. Confirm [W67 B5 exit](./transport-engine-w67-standalone-legacy-b5-exit-verification.md).
5. `pnpm verify:transport-engine-w68 && pnpm verify:engine-lab`

**Do not** delete production `-legacy.ts` while `Decision: BLOCKED`.
