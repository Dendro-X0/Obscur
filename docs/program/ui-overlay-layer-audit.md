# UI overlay layer audit (2026-06)

## Root cause class: missing Tailwind CSS for `@dweb/ui-kit`

Tailwind v4 scans the PWA app tree by default. Classes defined **only** in `packages/ui-kit` were not emitted until:

```css
@source "../../../packages/ui-kit/src";
```

### Dialog regression (fixed)

`DialogContent` used `top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]` — arbitrary utilities not present elsewhere in the app bundle. The overlay (`fixed inset-0 bg-black/50`) worked; the panel rendered off-screen.

**Fix:** standard centering utilities (`top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`) + ui-kit `@source`.

## Canonical floating UI stack

| Tier | z-index | Owner |
|------|---------|--------|
| Dialog backdrop | 5000 | `@dweb/ui-kit` `DialogOverlay` |
| Dialog panel | 5001 | `@dweb/ui-kit` `DialogContent` |
| Popovers (dropdown, select menu) | 5100 | `@dweb/ui-kit` dropdown + `SelectField` inline style |
| Toasts | 5200 | `@dweb/ui-kit` `ToastContainer` |

Constants: `UI_OVERLAY_Z_CLASS` / `UI_OVERLAY_Z_INDEX` in `packages/ui-kit/src/overlay-z-index.ts`.

Safelist in `apps/pwa/app/globals.css`:

```css
@source inline("z-[5000] z-[5001] z-[5100] z-[5200]");
```

## Other patterns (no change required)

| Pattern | Notes |
|---------|--------|
| Custom `fixed inset-0 flex items-center justify-center` modals | Work — centering uses scanned utilities |
| `SelectField` | Uses inline `position` + `zIndex` — immune to missing Tailwind rules |
| Sidebar chrome `z-[2600]` | Below dialog stack; dialogs now cover chrome correctly |
| Shell dropdown overrides `z-[10040]` | Intentionally above everything in main shell |
| `animate-in` / `fade-in-0` in app + ui-kit | **No plugin installed** — no-ops today; not the dialog trap |

## Consumer overrides to avoid

- Do **not** set `DialogContent` z-index below `5000` (historical `z-[100]` trap).
- Dropdowns inside Radix dialogs need `z-[5100]+` (default now `5100`; remove stale `z-[200]` overrides).

## Tests

- `apps/pwa/app/components/ui/dialog.test.tsx`
- `apps/pwa/app/components/ui/overlay-layer-stack.test.tsx`
