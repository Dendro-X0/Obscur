# Phase 1 — Desktop shell gate (app opens and stays open)

**Status:** Active  
**Last updated:** 2026-05-24  
**Scope:** Native desktop cold start → unlock → sidebar → open a DM thread. **No community work.**

Charter: [obscur-offline-first-policy.md](./obscur-offline-first-policy.md) · Handoff: [current-session.md](../handoffs/current-session.md)

---

## Dev command (canonical for Phase 1)

```bash
pnpm dev:desktop
```

`tauri.conf.json` sets `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=0` — experiment shell with **offline stubs** (noop relay, synthetic account sync). Use `pnpm dev:desktop:online` only when deliberately testing G6 online modules.

---

## Automated evidence

```bash
pnpm verify:phase1
```

Includes: startup overlay invariants, experiment-shell policy, runtime activation (G4), window runtime supervisor, native persistence policy.

Optional B3 copy vitest (not required for Phase 1 exit):

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/groups/utils/community-membership-evidence-display.test.ts \
  app/features/groups/services/community-directory-materialization-policy.test.ts
```

---

## Gate checklist (G1–G5)

| Gate | What to verify | Pass when |
|------|----------------|-----------|
| **G1** | Cold start + nav | App opens; sidebar switches Chats / Settings; no freeze or red error overlay |
| **G2** | Startup IPC | Window paints before long blocking work; `profile_binding_refresh` reasonable in DevTools / app events |
| **G3** | Settings panels | Profile, Appearance, Privacy, Security, Storage, Updates render — no `)` JSX artifacts |
| **G4** | Runtime ready | Shell reaches interactive without waiting on relay `connecting` (experiment offline: immediate ready path) |
| **G5** | Transport fail-open | Offline or relay down → degraded banner only; no provider throw / crash |

---

## Manual script (~10 min)

1. `pnpm cache:clear` if HMR feels stale, then `pnpm dev:desktop`.
2. Unlock profile (or create + unlock).
3. Confirm **Chats** sidebar visible; open **Settings → Updates** (inline updater, no GitHub fetch in dev).
4. Select or create a **DM** thread; confirm main pane renders (empty thread OK).
5. Navigate **Settings → Profile → Appearance → Privacy** — no crash.
6. **Do not** open `/groups`, send invites, or enable coordination URL for this pass.

---

## Out of scope (Phase 1)

- Community invites, membership sync, coordination HTTP
- Two-profile relay DM soak
- Android build / signing
- Re-enabling `NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1`

---

## Sign-off

| Gate | Date | Pass |
|------|------|------|
| G1 | | |
| G2 | | |
| G3 | | |
| G4 | | |
| G5 | | |
| `pnpm verify:phase1` | | |
