# Archived Obscur UI (reference only)

**Do not iterate this app for product features.** Backend work lives in `packages/` and engine services.

| Preserve | Location |
|----------|----------|
| Reusable components | [`packages/ui-kit`](../../packages/ui-kit/) |
| Full UI reference | This app (`apps/pwa`) — frozen |

**Manifest:** [docs/program/obscur-ui-archive-manifest.md](../../docs/program/obscur-ui-archive-manifest.md)  
**Backend roadmap:** [docs/program/obscur-backend-engine-roadmap.md](../../docs/program/obscur-backend-engine-roadmap.md)

```bash
# Normal lab work — no dev server required
pnpm verify:engine-lab
```

Legacy UI boot (archaeology only — **not** kernel integration test):

```bash
NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1 pnpm dev:desktop:online
```

**Kernel + UI integration test (default):**

```bash
pnpm dev:desktop:transport-smoke   # W53 smoke env + online stack
# or
pnpm dev:desktop:online          # strict kernels, routine UI flows
```

Checklist: [docs/program/obscur-kernel-ui-desktop-test-checklist.md](../../docs/program/obscur-kernel-ui-desktop-test-checklist.md)
