# Design — Dev Lab product quarantine (subtract mounts)

**Status:** Done · 2026-07-31  
**Prior:** [production-rewrite-and-devlab-tombstone-2026-07.md](./production-rewrite-and-devlab-tombstone-2026-07.md) · Phase 0 (policy + scripts) Done · Phase 3 deletion deferred  
**Audit queue:** [backend-parallel-path-audit-2026-07.md](./backend-parallel-path-audit-2026-07.md) priority 3

**Proof:** `pnpm verify:dev-lab` — static-shell 6 Pass · policy+quarantine **6 Pass** · `dev-lab-tombstone.mjs` exit 1.

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Dev Lab quarantine
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab as validation
CANONICAL OWNER:      Product shell must not mount Dev Lab bridges
PROOF BEFORE DONE:    vitest quarantine + policy · pnpm verify:dev-lab · tombstone exit 1
OUT OF SCOPE:         Delete entire features/dev-lab tree · e2e rewrite · UI polish
```

---

## Goal

Stop product runtime from **importing / mounting** Dev Lab bridges. Policy already always-false; scripts already exit 1 — but auth + unlocked shell still pull the dead tree into the product graph (hooks, effects, native-gate listener child).

---

## Facts

| Surface | Today |
|---------|--------|
| `isDevLabEnabled()` | Always `false` (`dev-lab-policy.ts`) |
| `pnpm dev:lab:*` / `verify:tier3` | `scripts/dev-lab-tombstone.mjs` → exit 1 |
| `installDevLab()` | Never called outside `dev-lab-install.ts` |
| **`AuthGateway`** | Mounts `<DevLabAuthBridge />` on **5** branches |
| **`UnlockedAppRuntimeShell`** | Mounts `<DevLabMessagingBridge />` |
| Transport host publish | Uses `isDevLabEnabled()` gate — keep import of **policy only** |
| DM sidebar synthetic filter | `dm-kernel-dev-lab-sidebar-policy` — keep (hygiene, not lab boot) |

---

## Changes (subtract only)

1. Remove `DevLabAuthBridge` import + all mounts from `auth-gateway.tsx`.  
2. Remove `DevLabMessagingBridge` import + mount from `unlocked-app-runtime-shell.tsx`.  
3. L1: `dev-lab-product-quarantine.contract.test.ts` — product shell files must not import `features/dev-lab/*` except via documented allowlist (none for shell; transport policy separate).  
4. Extend `verify:dev-lab` to run quarantine contract.  
5. Leave `features/dev-lab/**` on disk until a later deletion pass (Phase 3).

**Non-goals:** Delete tree · remove transport `isDevLabEnabled` gate · migrate trust matrix tests out of folder.

---

## Proof

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/dev-lab/dev-lab-policy.test.ts \
  app/features/dev-lab/dev-lab-product-quarantine.contract.test.ts
pnpm verify:dev-lab
node scripts/dev-lab-tombstone.mjs   # expect exit 1
```

---

## Claim language

| May say | When |
|---------|------|
| Dev Lab product-quarantined | Shell mounts removed + L1 Pass |
| Dev Lab deleted | Tree + scripts gone (not this slice) |

---

## Next

Community un-pause study · R1 hydrate shrink · or Phase 3 deletion when no package/test imports remain.
