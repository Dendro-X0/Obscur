# Obscur UI archive manifest

**Status:** Active (2026-06-17)  
**Band:** ENGINE-LAB  
**Policy:** UI is **frozen reference material**, not an iteration surface.

---

## What is preserved (reusable)

| Asset | Location | Role |
|-------|----------|------|
| **Component library** | [`packages/ui-kit`](../../packages/ui-kit/) | Buttons, inputs, shell chrome primitives — **only** sanctioned UI package for future host |
| **Design tokens / styles** | `packages/ui-kit/src`, Tailwind config in `apps/pwa` (reference) | Copy into future host when needed; do not grow in place |
| **Archived app shell** | [`apps/pwa`](../../apps/pwa/) | Full Next.js product UI — **read-only** for layout/copy reference |

**Rule:** New work does **not** add features under `apps/pwa/app/features/**`. Extract patterns into `ui-kit` only when a future host explicitly needs them.

---

## What is archived (do not extend)

| Path | Status |
|------|--------|
| `apps/pwa/app/features/**` | Frozen — backend logic must not be copied from here into engines |
| Main shell, settings, groups routes | Reference layouts only |
| Desktop WebView shell | Frozen until headless engine-host replaces dev loop |

**Exception:** `apps/pwa/app/engine-lab/**`, `apps/pwa/app/legacy/**`, contract tests that guard subtraction.

---

## Isolation contract

1. **`packages/*` engines** must not import from `apps/pwa/**`.
2. **`packages/ui-kit`** must not import from `apps/pwa/**` or `@/app/features`.
3. Future host (when built) imports **`@obscur/engine-contracts`** + **`ui-kit`** only.

Verify: `pnpm verify:ui-archive` (ui-kit boundary + engine-lab quarantine).

---

## Future host (deferred)

When backend engines stabilize:

- New thin host under future shell app or external repo
- Consumes archived `ui-kit` components
- Wires `HostEnginePort` only

Until then: **no obligation to run `pnpm dev` or render the archived UI.**

---

## References

- [obscur-engine-lab-charter.md](./obscur-engine-lab-charter.md)
- [obscur-backend-engine-roadmap.md](./obscur-backend-engine-roadmap.md)
- [QUARANTINE.md](../../apps/pwa/app/legacy/QUARANTINE.md)
