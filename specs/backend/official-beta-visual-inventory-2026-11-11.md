# OB1 — Official Beta visual inventory

**Date:** 2026-11-11  
**Status:** **CLOSED Pass** · keep/strip tables locked  
**Parents:** [official-beta-bar-2026-11-11.md](./official-beta-bar-2026-11-11.md) · [official-beta-visual-inherit-design-2026-11-11.md](./official-beta-visual-inherit-design-2026-11-11.md)

```text
HANDOFF ATOMIC STEP: OB1 visual inventory CLOSED — Continuity Pass / Soft L3 Fixed not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote · Continuity Cut 16+ · greenfield UI rewrite
CANONICAL OWNER:     apps/desktop-ui · @dweb/ui-kit · remaster ports
PROOF:               this inventory · official-beta-ob1-inventory.contract.test.ts · ≠ Continuity Pass
```

## Law (repeat)

Keep **appearance**. Strip **legacy owners**. Wire **remaster ports**. Home = `apps/desktop-ui`. Never `from "@/app/features/"`.

## A — Keep as-is (workspace import)

| Asset | Path | Role |
|-------|------|------|
| UI kit package | `packages/ui-kit` (`@dweb/ui-kit`) | Button, Input, Textarea, Label, Dialog, ConfirmDialog, DropdownMenu, Select, Avatar, Card, Checkbox, Skeleton, Progress, Pagination, Toast, EmptyState, ConnectionStatus, MessageStatus, QueueStatus, ErrorDetails, `cn` |
| Overlay z-index | `@dweb/ui-kit/overlay-z-index` | Portal stacking |

**Action:** add `@dweb/ui-kit` dependency on `apps/desktop-ui` in OB2 (no copy needed).

## B — Keep appearance · adapt into desktop-ui (OB2–OB3)

Copy/adapt **markup + CSS patterns**; delete hooks/services on paste. Presentational props only.

| Priority | Surface (pwa source) | Strip on copy | Remaster wire |
|----------|----------------------|---------------|---------------|
| **P0** | CSS tokens / shell vars — `apps/pwa/app/globals.css` (`:root`, `.dark`, `.desktop-mode`, sidebar/radius/primary) | Next `@import "tailwindcss"` / `@source` until desktop-ui has Tailwind or plain CSS port of vars | Replace lab `styles.css` tokens |
| **P0** | Auth visual — `features/auth/components/auth-screen.tsx` layout/hero | `AuthGateway`, identity stores, PDK owners | `AuthDoor` + `DeviceUnlockPort` |
| **P0** | Locked identity chrome — `main-shell/components/locked-identity-view.tsx` | unlock owners | AuthDoor locked state |
| **P0** | Empty thread — `main-shell/components/empty-conversation-view.tsx` | network/relay owners | remaster empty state |
| **P1** | Conversation row chrome — `messaging/components/conversation-row.tsx` | `useIdentity`, `useResolvedProfileMetadata`, `useMobileCompactLayout`, Next `Image`, voice preview services | props: label, preview, selected, onSelect |
| **P1** | Composer chrome — `messaging/components/composer.tsx` | protocol chips, voice/attachment pipelines, contact-request sandbox | props: draft, onSend, disabled, delivery honesty |
| **P1** | Sidebar / list shell proportions — `messaging/components/sidebar.tsx` **layout only** | unread providers, transport owners | `listConversations` |
| **P2** | Message bubble / header look — extract from `message-list.tsx` / `message-header.tsx` (do **not** port whole MessageList) | chat-state, reactions, voice cards | `listMessages` rows |
| **P2** | Mobile compact breakpoints — `use-mobile-compact-layout` **behavior copy** as pure CSS/`matchMedia` helper in desktop-ui | runtime shell-contract imports | local helper |

## C — Strip / do not port into remaster (Official Beta v1)

| Asset | Why |
|-------|-----|
| `main-shell/main-shell.tsx` wholesale | Integration spine (transport, voice, network, unread) |
| `ChatView` wholesale | Coupled to messaging providers |
| `MessageList` wholesale (~1k lines) | Durability + media + voice owners |
| `ChatStateDurabilityOwner` | Explicit chat-state owner |
| `GlobalDialogManager` / `GlobalVoiceCallOverlay` | Runtime dialog/voice bus |
| `usePeerTrust` / Requests dual Soft L3 matrix | Soft L3 Fixed paused |
| `MessagingProvider` / `RuntimeMessagingTransportOwnerProvider` | Dual owners |
| `@/app/features/*` imports into desktop-ui | R1 kill-list |
| Groups / Matrix lab / video surfaces | Out of Official Beta bar |
| Continuity sealed invent beyond existing ContinuityDoor | Methods already landed · ≠ Continuity Pass invent |

## D — Official Beta first bind order (OB2→OB3)

```text
1. Tailwind-or-CSS token port from globals.css → desktop-ui
2. @dweb/ui-kit on AuthDoor (create/unlock look)
3. Presentational ConversationRow + list bind listConversations
4. Presentational thread bubbles + Composer bind listMessages/sendDm
5. Product title (drop "desktop-ui lab") · hide Matrix lab chip · product Continuity/Settings placement
```

## E — Proof

| Check | Gate |
|-------|------|
| Inventory documents keep A/B and strip C | This file |
| Contract asserts inventory + inherit law | `apps/desktop-ui/src/official-beta-ob1-inventory.contract.test.ts` |
| Remaster still free of pwa feature imports | Existing `remaster-r1-path.contract.test.ts` |

## NEXT

**OB2 CLOSED** — [official-beta-ob2-auth-ui-kit-2026-11-11.md](./official-beta-ob2-auth-ui-kit-2026-11-11.md).  
**OB3 CLOSED** — [official-beta-ob3-shell-chrome-2026-11-11.md](./official-beta-ob3-shell-chrome-2026-11-11.md).  
**OB4 CLOSED** — [official-beta-ob4-product-chrome-2026-11-11.md](./official-beta-ob4-product-chrome-2026-11-11.md).  
**OB5 READY** — [official-beta-ob5-cut-plan-2026-11-11.md](./official-beta-ob5-cut-plan-2026-11-11.md) · WAITING publish ask.
