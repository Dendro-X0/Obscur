# OB4 — Product chrome (title · hide lab chip · product doors · CDP spot)

**Date:** 2026-11-11  
**Status:** **CLOSED Pass** (L1) · packaged CDP spot recorded  
**Parents:** [official-beta-bar-2026-11-11.md](./official-beta-bar-2026-11-11.md) · [official-beta-ob3-shell-chrome-2026-11-11.md](./official-beta-ob3-shell-chrome-2026-11-11.md)

```text
HANDOFF ATOMIC STEP: OB4 product chrome CLOSED — Continuity Pass / Soft L3 Fixed not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote · Continuity Cut 16+ · Official Beta publish without ask
CANONICAL OWNER:     apps/desktop-ui product doors · index.html title
PROOF:               official-beta-ob4-product-chrome.contract.test.ts · build · CDP spot handoff · ≠ Continuity Pass
```

## 1. Intent

Stranger-facing product chrome on remaster: no “desktop-ui lab” title, no Matrix lab chip, Settings/Continuity/Private home as **product doors** (methods available ≠ Continuity Pass).

## 2. Landed

| Item | Evidence |
|------|----------|
| Title `Obscur` | `apps/desktop-ui/index.html` |
| Matrix lab chip removed | `PrivateTrustHome` PROTOCOL_CHIPS · matrix selection refused / coerced to `private_dc` |
| Product door chrome | `product/ProductDoors.tsx` tabs → Settings / Private home / Continuity |
| Settings ui-kit | `SettingsDoor` Button/Input/Label · `product-door` class |
| Continuity product header | stranger-facing copy · `product-door` class |
| Shell honesty | Continuity “as a product door” · Soft L3 / Continuity Pass non-claims |

## 3. CDP spot

See [`docs/handoffs/official-beta-ob4-cdp-spot-2026-11-11.md`](../../docs/handoffs/official-beta-ob4-cdp-spot-2026-11-11.md).

- L1 source title: **Obscur** (contract + build dist).  
- Packaged attach: attempted against `E:\Obscur\obscur_desktop_app.exe` with WebView2 remote-debugging — record result in CDP handoff (installed artifact may still be foundation beta.10 until Official Beta cut).

## 4. Non-claims

- Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote  
- Published Official Beta (OB5 on explicit ask only)  
- Live multi-device sync  

## 5. Proof

| Layer | Command / artifact |
|-------|--------------------|
| L1 | `pnpm -C apps/desktop-ui run verify:ob4` |
| L2 spot | CDP handoff above |

## 6. NEXT

**OB5** — Official Beta cut plan + publish ask (after OB0–OB4). Soft L3 Fixed / Continuity Pass still not claimed.
