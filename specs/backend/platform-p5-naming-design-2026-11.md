# Design — P5 naming pass (2026-11)

**Status:** Landed (L1)  
**Parent:** [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)  
**Related:** [obscur-platform-service-vision-2026-10.md](./obscur-platform-service-vision-2026-10.md) · [platform-boundary-map-2026-11.md](./platform-boundary-map-2026-11.md)

```text
HANDOFF ATOMIC STEP: P5 naming pass — DONE L1
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     PAL display names · package identity docs
PROOF:               module-display-names + P5 contract + migration-hints Pass
```

## 1. Goal

Lock **human-facing and package identity names** now that P3/P4 ports exist, without a filesystem mega-rename.

## 2. Glossary (canonical)

| Name | Role | Do not |
|------|------|--------|
| **Obscur** | Platform + client shell (public product name) | Rebrand shell to a protocol name |
| **Obscur-Nostr** | Working name for the Nostr protocol module | Call the whole product “Nostr app” in Settings |
| **`@obscur/protocol-nostr`** | Workspace package attachment point | Rename package in this cut |
| **Matrix (lab)** | Selectable lab carrier | Claim promote / Verified |
| **Private DC** | Company / private-server carrier (`private_dc`) | Claim multi-protocol Verified |
| **ProtocolAdaptationLayer (PAL)** | Frozen port surface | Import adapter leaves from outside `protocol-adaptation/` |

Wire ids stay lowercase: `nostr` · `matrix` · `private_dc`. Display strings are separate.

## 3. L1 slice (this cut)

1. `module-display-names.ts` — `protocolDisplayName(id)` + package constants.
2. Settings Protocols tab uses those defaults (`Obscur-Nostr`, `Matrix (lab)`, `Private DC`).
3. Contract: glossary strings present; `@obscur/protocol-nostr` name unchanged; no claim of package path rename.
4. Short README under `protocol-adaptation/` pointing at this glossary.

## 4. Explicitly deferred

- Mass rename of folders (`features/messaging` → …)
- Full `nostr/` orchestration extract into package body (P7 started with `canonical-from-rich` only)
- Renaming `@obscur/protocol-nostr` npm name or public product string
- Matrix promote naming as production-ready

## 5. Non-claims

- Not “rename charter complete for every module path”
- Not Soft L3 / Tor Verified / Matrix promote
- Not multi-protocol shipping

## 6. Proof

| Layer | Check |
|-------|--------|
| L1 | vitest: display-name unit + P5 contract Pass |
| L2+ | Optional copy soak on desktop Settings (not required to land) |
