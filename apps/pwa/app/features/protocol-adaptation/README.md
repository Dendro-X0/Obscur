# Protocol adaptation (PAL)

**Plane:** Protocol adaptation  
**Rewrite band:** [platform-boundary-map](../../../../../specs/backend/platform-boundary-map-2026-11.md) · [P6 fences](../../../../../specs/backend/platform-p6-plane-readme-fences-design-2026-11.md)

Frozen port surface for messaging carriers. Shell code talks to `ProtocolAdaptationLayer`, not adapter leaves.

## Owns

- Active protocol / transport preference
- Canonical list/send façade + rich Nostr compatibility ports on the layer
- Adapter registry (`nostr` · `matrix` lab · `private_dc`)
- Public send confirmation exports (`send-confirmation.ts` · K6–K8) — rich `SendConfirmation` + slim `CanonicalSendConfirmation`; `sendDm` `onConfirmed` is Canonical-only

## Does not own

- Auth unlock / identity root
- Profile slots
- Inbound media quarantine (Storage)

## Naming (P5)

| Name | Meaning |
|------|---------|
| **Obscur** | Platform + client shell |
| **Obscur-Nostr** | Nostr protocol module (`nostr` wire id) · package `@obscur/protocol-nostr` |
| **Matrix (lab)** | Lab carrier (`matrix`) — not promoted |
| **Private DC** | Company / private server (`private_dc`) · HTTPS `/v1` wire |

See [platform-p5-naming-design-2026-11.md](../../../../../specs/backend/platform-p5-naming-design-2026-11.md).

Display helpers: `module-display-names.ts`. Wire ids stay lowercase.
