# OB3 — Conversation list + thread + composer chrome on remaster ports

**Date:** 2026-11-11  
**Status:** **CLOSED Pass** · presentational shell chrome bound to `PrivateTrustHomePorts`  
**Parents:** [official-beta-bar-2026-11-11.md](./official-beta-bar-2026-11-11.md) · [official-beta-visual-inventory-2026-11-11.md](./official-beta-visual-inventory-2026-11-11.md) · [official-beta-ob2-auth-ui-kit-2026-11-11.md](./official-beta-ob2-auth-ui-kit-2026-11-11.md)

```text
HANDOFF ATOMIC STEP: OB3 list/thread/composer CLOSED — Continuity Pass / Soft L3 Fixed not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote · Continuity Cut 16+ · MessageList wholesale · MessagingProvider
CANONICAL OWNER:     apps/desktop-ui/private-trust/chrome · PrivateTrustHomePorts
PROOF:               official-beta-ob3-shell-chrome.contract.test.ts · pnpm -C apps/desktop-ui build · ≠ Continuity Pass
```

## 1. Intent

Inherit Obscur **list / bubble / composer appearance** as presentational props in `apps/desktop-ui`. Wire data only through remaster `PrivateTrustHomePorts` (`listConversations` · `listMessages` · `sendDm`).

## 2. Landed

| Surface | Module | Wire |
|---------|--------|------|
| Conversation row | `chrome/ConversationRowView.tsx` | `listConversations` → label/preview/selected |
| Message bubble | `chrome/MessageBubbleView.tsx` + `@dweb/ui-kit/message-status` | `listMessages` rows |
| Composer | `chrome/ComposerView.tsx` + ui-kit `Textarea`/`Button` | `sendDm` |
| Empty states | `chrome/EmptyThreadView.tsx` + ui-kit `EmptyState` | no conversations / no selection / empty thread |
| Home bind | `PrivateTrustHome.tsx` | ports only · no `@/app/features/*` |

## 3. Explicitly not ported

- PWA `ConversationRow` hooks (`useIdentity`, `useResolvedProfileMetadata`, pin/hide menus, Next `Image`)
- PWA `composer.tsx` voice/attachment/protocol pipelines
- `MessageList` wholesale · `MessagingProvider` · `usePeerTrust`

## 4. Non-claims

- Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote  
- Official Beta Pass (needs OB4) · published Official Beta (OB5 on ask)  
- Pixel-perfect sidebar unread/presence parity  

## 5. Proof

| Layer | Command / artifact |
|-------|--------------------|
| L1 | `pnpm -C apps/desktop-ui exec vitest run src/official-beta-ob3-shell-chrome.contract.test.ts src/official-beta-ob2-auth-ui-kit.contract.test.ts src/remaster-r1-path.contract.test.ts` |
| L1 build | `pnpm -C apps/desktop-ui build` |

## 6. NEXT

**OB4** — product chrome pass (hide Matrix lab chip · Continuity/Settings as product doors · packaged CDP spot). Soft L3 Fixed / Continuity Pass still not claimed.
