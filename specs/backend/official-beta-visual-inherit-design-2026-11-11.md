# Design — Official Beta visual inherit (keep look · strip legacy integration)

**Date:** 2026-11-11  
**Status:** **ACTIVE**  
**Parent:** [official-beta-bar-2026-11-11.md](./official-beta-bar-2026-11-11.md)

```text
HANDOFF ATOMIC STEP: OB visual inherit design — Continuity Pass / Soft L3 Fixed not claimed
PAUSED / CANCELLED: Soft L3 Fixed · Continuity Pass · Tor Verified · Matrix promote · wholesale MessagingProvider port · Continuity Cut 16+
CANONICAL OWNER:     apps/desktop-ui presentation · @dweb/ui-kit · remaster ports
PROOF BEFORE DONE:   inherit rule + keep/strip tables · ≠ Continuity Pass
```

## 1. Intent

Retain Obscur’s **visual appearance** (valuable, multi-size compatible). Replace **legacy integration** that couples those views to dual owners. Theory: presentation ≠ API owners. As-built PWA mixed them; remaster separates them.

## 2. Inherit rule

```text
KEEP:  markup structure · CSS/tokens · responsive layout · @dweb/ui-kit primitives · presentational props
STRIP: usePeerTrust / chat-state / MessageQueue / dm-controller / MessagingProvider / feature stores as owners
WIRE:  remaster ports only (PrivateTrustHomePorts · ContinuityPorts · DeviceUnlock · Settings residue)
HOME:  apps/desktop-ui — copy/adapt views here; do not import apps/pwa/app/features/*
```

## 3. Keep (visual)

| Layer | Examples | Note |
|-------|----------|------|
| **`@dweb/ui-kit`** | Button, Input, Dialog, Avatar, Toast, EmptyState | Already presentational — prefer workspace import |
| **Tokens / global chrome** | spacing, typography, dark/light surfaces, shell gutters | Port CSS/vars into desktop-ui; no Next dependency |
| **Shell layout patterns** | sidebar + thread + composer proportions, mobile breakpoints | Replicate structure; feed from remaster state |
| **Auth visual patterns** | identity hero, passphrase fields, lock chrome | Re-skin AuthDoor with ui-kit; unlock still remaster ports |
| **Message chrome** | bubble, status glyph, list row density | Props: body, direction, deliveryStatus — no queue owner |

## 4. Strip (integration)

| Coupled owner | Why strip on remaster |
|---------------|------------------------|
| `chat-state-store` / `PersistedChatState` | Cut 1 demoted; R1 kill-list |
| `MessageQueue` / `dm_message_queue_v1` | Dual durability |
| `usePeerTrust` as CRM writer | Soft L3 / LS dual path |
| `dm-controller` / send pipelines as UI imports | PAL/ports own send |
| `MessagingProvider` wholesale | Reimports dual owners (Cut 3 risk) |
| `@/app/features/*` into desktop-ui | Remaster sole face fence |

## 5. Wire map (first Official Beta surfaces)

| Visual surface | Remaster owner |
|----------------|----------------|
| Unlock / create | `DeviceUnlockPort` + `createVitePassphraseIdentity` |
| Conversation list | `PrivateTrustHomePorts.listConversations` |
| Thread | `listMessages` |
| Composer send | `sendDm` (private_dc face) |
| Settings residue | `vite-settings-residue` |
| Continuity door | `ContinuityPorts` (methods ≠ Pass) |
| Private home URL | `vite-private-dc-session` |

## 6. Execution sequence (anti-rewrite)

1. **Inventory** (OB1) — name files/styles to copy; name hooks to delete on copy.  
2. **Extract presentational** — component accepts props only; vitest renders without pwa imports.  
3. **Bind remaster ports** — one surface at a time (auth → list → thread → composer).  
4. **Product chrome** — remove “lab” title/chips; honest non-claims stay in copy.  
5. **Soak** — remaster verify + packaged CDP spot · ≠ Soft L3 invent.

## 7. Non-goals

- Pixel-perfect port of groups / voice / Matrix lab in Official Beta v1  
- Soft L3 contact Pass · Continuity Pass · Tor Verified  
- Deleting `apps/pwa` on day one (rollback / mobile overlay may remain)  
- Greenfield design system rewrite  

## 8. Claim language

- May say: Official Beta **inherits Obscur visual chrome**; integration is remaster ports  
- Must not say: Soft L3 Fixed · Continuity Pass · “full pwa feature parity” · months of UI discarded  

## 9. Next

**OB1** — visual inventory checklist under `specs/backend/official-beta-visual-inventory-2026-11-11.md`.
