# OB2 — AuthDoor + CSS tokens + `@dweb/ui-kit` (first remaster surface)

**Date:** 2026-11-11  
**Status:** **CLOSED Pass** · first Official Beta visual surface on remaster ports  
**Parents:** [official-beta-bar-2026-11-11.md](./official-beta-bar-2026-11-11.md) · [official-beta-visual-inventory-2026-11-11.md](./official-beta-visual-inventory-2026-11-11.md) · [official-beta-visual-inherit-design-2026-11-11.md](./official-beta-visual-inherit-design-2026-11-11.md)

```text
HANDOFF ATOMIC STEP: OB2 AuthDoor + ui-kit tokens CLOSED — Continuity Pass / Soft L3 Fixed not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote · Continuity Cut 16+ · greenfield UI rewrite
CANONICAL OWNER:     apps/desktop-ui · @dweb/ui-kit · DeviceUnlockPort
PROOF:               official-beta-ob2-auth-ui-kit.contract.test.ts · pnpm -C apps/desktop-ui build · ≠ Continuity Pass
```

## 1. Intent

First Official Beta surface: keep Obscur auth **look** via `@dweb/ui-kit` + ported CSS tokens; keep unlock **owners** on remaster ports only.

## 2. Landed

| Item | Evidence |
|------|----------|
| `@dweb/ui-kit` workspace dep on `apps/desktop-ui` | `package.json` |
| Tailwind v4 + `@tailwindcss/vite` | `vite.config.ts` · `devDependencies` |
| Token / gradient / `btn-enhanced` / `input-enhanced` port | `src/styles.css` (from `apps/pwa/app/globals.css` subset) · `@source` ui-kit |
| AuthDoor uses `Button` / `Input` / `Label` | `src/auth/AuthDoor.tsx` |
| Product title drop “desktop-ui lab” | `index.html` → `<title>Obscur</title>` · `class="dark"` |
| No `@/app/features/*` / `usePeerTrust` / `MessagingProvider` | R1 + OB2 contracts |

## 3. Non-claims

- Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote  
- Official Beta Pass (needs OB0–OB4) · published Official Beta (OB5 on ask)  
- Pixel-perfect auth-screen / locked-identity wholesale port  

## 4. Proof

| Layer | Command / artifact |
|-------|--------------------|
| L1 | `pnpm -C apps/desktop-ui exec vitest run src/official-beta-ob2-auth-ui-kit.contract.test.ts src/remaster-r1-path.contract.test.ts src/official-beta-ob1-inventory.contract.test.ts` |
| L1 build | `pnpm -C apps/desktop-ui build` |

## 5. NEXT

**OB3** — conversation list + thread + composer visual bind to `PrivateTrustHomePorts` (presentational props; no pwa feature imports).
