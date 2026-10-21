# Vision — Unified protocol client (gateway + protocol modules)

**Date (UTC):** 2026-10-18  
**Status:** Vision only · not an implementation charter  
**Constraint:** Maintainer — no rewrite / greenfield / token budget for this scope in Obscur

## Intended product

One **unified client** (Obscur as the shell / gateway). The user selects a **protocol** (and network path). The shell then loads that protocol’s **own modules and UI**: identity, relays/endpoints, conversations, settings patterns that match how that protocol is used.

```text
Obscur shell (profiles, lock, window chrome, protocol picker)
        ├── Protocol module: Nostr   (identity · relays · DMs · …)
        ├── Protocol module: …       (its own identity · endpoints · UX)
        └── …
```

This is closer to **several applications behind one gateway** than to a thin adapter on a single kernel.

## What this repo is today

A **Nostr-shaped kernel** with a later protocol-adaptation switch. ProtocolAdaptationLayer can flip an active id; it does not give each protocol a separate identity/relay/UI stack. Redesign of that coupling inside Obscur is **all but impossible** under current time and token constraints.

## Scale (honest)

| Approach | Meaning |
|----------|---------|
| Adapter on Nostr | Small surface; cannot meet “switch protocols” vision |
| Gateway + full modules per protocol | Feasible in theory; workload ≈ multiple apps + integration |
| Restart / greenfield | Already tried; Obscur UI discarded; not available as a path |

## Binding for agents

Do **not** treat this document as permission to start a multi-app platform, a greenfield, or a Nostr-lock-in “slice.” Wait for an explicit maintainer charter and budget. Until then, Obscur work stays bounded in-repo tasks the maintainer names.

_Last updated: 2026-10-18T09:30:00Z_
