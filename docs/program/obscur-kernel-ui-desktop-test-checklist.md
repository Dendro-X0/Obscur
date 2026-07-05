# Obscur — Kernel + UI Desktop Integration Test Checklist

**Status:** Maintainer manual band (post-refactor validation)  
**Last updated:** 2026-06-27  
**Order:** W53 transport smoke → routine UI flows under strict kernels

The archived PWA (`apps/pwa`) is the **manual test harness**. Kernels are authoritative by default (`NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY` unset). Do not use `ALLOW_LEGACY=1` for this band unless debugging a specific legacy path.

---

## Step 0 — Programmatic gates

```bash
pnpm verify:engine-lab
pnpm verify:standalone-legacy-subtraction-prep
```

Prep report: `prepBandComplete: true` (expected before smoke).

---

## Step 1 — W53 transport smoke

**Runbook:** [transport-engine-w53-maintainer-smoke-runbook.md](./transport-engine-w53-maintainer-smoke-runbook.md)

```bash
pnpm dev:desktop:transport-smoke
```

Requires `apps/pwa/.env.example` copied to `.env.local` with `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787`.

**Optional (Conduit Mesh C5):** add `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL=1` to route the relay pool hook through mesh instead of `enhanced-relay-pool-legacy` (requires transport-kernel authority; Nostr subscribe remains unwired).

Complete W53 charter checklist → record in [transport-engine-smoke-sign-off-recorded.md](../handoffs/transport-engine-smoke-sign-off-recorded.md) with `Decision: PASS` when evidence is captured.

---

## Step 2 — Kernel UI integration (strict mode)

Same dev session or fresh boot with **strict kernels** (no `ALLOW_LEGACY`):

```bash
pnpm dev:desktop:online
# or pnpm dev:desktop:transport-smoke when testing publish + UI together
```

| # | Flow | Pass criteria |
|---|------|----------------|
| 1 | Cold start → profile picker | No `RootErrorBoundary`; data root resolves |
| 2 | Unlock / auth | `AuthKernelProvider` path; session reaches main shell |
| 3 | Sidebar + conversation list | Native: SQLite list authority; list renders |
| 4 | Open DM thread | Messages via dm-kernel (`useThreadMessages` → `useDmKernelThread`) |
| 5 | Send DM | Persist + visible in thread (sqlite write path) |
| 6 | Settings navigation | No crash; profile switch if multi-profile |
| 7 | Relay status | Transport snapshot / relay badge reflects connectivity (writable > 0 when relays enabled) |
| 8 | Vault — local upload | **Secure Upload** → **Obscur Local Vault** → file appears under **Local** with original filename |
| 9 | Vault — cloud fallback | NIP-96 failure → **Save to local encrypted vault** succeeds |
| 10 | Chat — save to vault | Right-click (desktop) or long-press (mobile) attachment → **Save to vault**; item in Vault |
| 11 | Lock confirm | Title bar / avatar **Lock** → dialog shows “Lock Obscur?” (not raw i18n keys) |

**DM + relay prerequisites (rows 4–5, 7):** identity unlocked; `useShellTransportReady` / transport owner must arm with unlocked identity (not only `ready` window phase). Rebuild static shell after PWA changes: `pnpm dev:desktop:online -- --rebuild`.

Optional automated slice before handoff:

```bash
pnpm verify:handoff
```

---

## Step 3 — After W53 PASS (maintainer only)

1. `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1`
2. `node scripts/execute-transport-standalone-legacy-subtraction.mjs`
3. W66 mechanical commit → W67 B5 exit → `pnpm verify:engine-lab`

See [transport-engine-standalone-legacy-subtraction-index.md](./transport-engine-standalone-legacy-subtraction-index.md).

---

## Not in this band

- Community/groups feature work (**PAUSED**)
- New UI features under `apps/pwa/app/features/**`
- Thin host / ui-kit extraction (deferred per [obscur-ui-archive-manifest.md](./obscur-ui-archive-manifest.md))
