# 35 Data Sovereignty and Unified Backend Rewrite Target

_Last reviewed: 2026-04-22 (baseline commit a3f16b10)._

Status: target architecture contract for future rewrite

## Purpose

This document corrects the architectural misunderstanding that repeatedly
drove the project into failure.

The target is:

1. decentralized data ownership,
2. privacy and user sovereignty,
3. portable encrypted user state,
4. but maintainable, modular, unified backend coordination.

## Core Clarification

Two ideas were previously conflated.

### A. Data Sovereignty

The user owns:

1. identity keys,
2. encrypted private state,
3. export/import portability,
4. privacy-sensitive communication payloads,
5. the right to move, back up, or destroy their data.

This is required.

### B. Backend Decentralization

Every runtime concern is treated as relay-distributed or peer-distributed:

1. membership truth,
2. session truth,
3. restore truth,
4. indexing,
5. synchronization,
6. presence,
7. coordination.

This is not required.

For Obscur, forcing backend decentralization at every layer has made the system
difficult to finish and difficult to maintain.

## Rewrite Principle

The new architecture should optimize for:

1. user-sovereign data,
2. privacy-preserving protocols,
3. backend-authoritative coordination where consistency is needed,
4. modular service boundaries,
5. iterable implementation with explicit owners.

## Backend Pragmatism Rule

Obscur should be decentralized in:

1. user experience assumptions,
2. key ownership,
3. encrypted private data ownership,
4. operator and self-hosting flexibility.

Obscur should **not** pursue backend protocol purity where it makes the system:

1. difficult to reason about,
2. difficult to finish,
3. difficult to scale,
4. difficult to maintain,
5. likely to regress after routine feature work.

When there is a conflict between:

1. backend design purity,
2. maintainable/scalable coordination,

the rewrite should choose maintainable/scalable coordination, as long as user
sovereignty and encrypted private-state boundaries remain intact.

## High-Level Target Topology

The rewrite target should be split into five major planes.

### 1. Sovereign Data Plane

Owns:

1. private keys,
2. encrypted account backup,
3. local message/media caches,
4. room keys,
5. portable bundles.

Properties:

1. end-to-end encrypted,
2. portable between runtimes,
3. user-controlled deletion/export,
4. no service requires plaintext ownership of this plane.

### 2. Coordination Backend Plane

Owns:

1. session continuity metadata,
2. community membership and directory coordination,
3. invite workflows,
4. canonical indexing of public or metadata-level state,
5. operational consistency for reload/rejoin/recovery.

Properties:

1. unified service boundary,
2. modular subsystems,
3. explicit service contracts,
4. can be self-hosted or operator-hosted,
5. does not need private plaintext content.

### 3. Transport Interop Plane

Owns:

1. relay interoperability,
2. delivery transport,
3. public relay discovery,
4. optional fallback or backup channels,
5. proxy/Tor/privacy-routed delivery adaptation.

Properties:

1. relays are transport and evidence sources,
2. relays are not universal truth owners,
3. transport can fail or degrade without redefining product state.

### 4. Projection and Read-Model Plane

Owns:

1. session read models,
2. DM list/timeline read models,
3. community member/directory read models,
4. room-key/sendability read models,
5. restore/recovery projection truth.

Properties:

1. projection is the single UI read authority,
2. it is fed by authoritative import and coordination inputs,
3. local caches and transport evidence are inputs, not competing truth owners.

### 5. UI and Workflow Plane

Owns:

1. shells,
2. routes,
3. dialogs,
4. local-only preferences,
5. ephemeral form state.

Properties:

1. consumes projection outputs,
2. never invents durable truth,
3. never owns transport or restore coordination.

## What Should Be Unified

The future system should strongly consider unified backend ownership for:

1. community directory and membership coordination,
2. session continuity and remember-me restore metadata,
3. account restore indexing and timeline reconstruction support,
4. search/discovery index,
5. public metadata reconciliation,
6. canonical event sequencing and replay checkpoints.

These backend owners should be judged by:

1. operational simplicity,
2. explicit contracts,
3. self-hostability,
4. scaling behavior,
5. ease of debugging and recovery.

They should not be forced into relay-native or peer-native designs if doing so
recreates the current fragility.

This does not violate data sovereignty if:

1. private payloads stay encrypted,
2. keys stay user-controlled,
3. export/import remains user-portable,
4. backend-managed metadata can be self-hosted or operator-controlled.

## What Must Remain User-Sovereign

The rewrite should protect these as non-negotiable:

1. private key ownership,
2. local encryption and decryption,
3. encrypted private message content,
4. encrypted room keys,
5. encrypted private backups,
6. the ability to move identity/data without platform lock-in.

## What Relays Should Become

Relays should be treated as:

1. transport channels,
2. optional public discovery surfaces,
3. interoperability surfaces,
4. backup or evidence sources,
5. degraded-mode delivery paths.

Relays should not be treated as the only durable owner for:

1. community membership truth,
2. authoritative participant directory,
3. restore truth,
4. session continuity,
5. product-grade coordination guarantees.

## Canonical Future Owners

The rewrite should converge on these owner categories.

### Session Owner

One service owns:

1. stored identity record,
2. native session status,
3. remember-me state,
4. profile binding,
5. startup auth decision.

### Restore Owner

One service owns:

1. backup import parsing,
2. canonical event reconstruction,
3. projection hydration,
4. recovery diagnostics,
5. compatibility bridges with explicit retirement rules.

### DM Read Owner

One service owns:

1. conversation list authority,
2. timeline authority,
3. message identity reconciliation,
4. restore/live parity.

### Community Read Owner

One service owns:

1. participant roster,
2. joined membership,
3. directory visibility,
4. room-key sendability,
5. governance-visible state.

### Transport Owner

One service owns:

1. relay connection lifecycle,
2. proxy/Tor mode,
3. subscription replay,
4. retry cadence,
5. transport diagnostics.

## Rewrite Module Layout

The future codebase should be organized around explicit modules, not feature
bags.

Suggested macro layout:

1. a client app surface replacing or heavily reworking the current `apps/pwa`,
2. a native host surface replacing or heavily reworking the current `apps/desktop`,
3. a unified coordination backend surface,
4. a relay interop edge surface if still needed,
5. shared contracts packages,
6. shared crypto packages,
7. shared projection packages,
8. shared protocol helper packages.

## Migration Strategy

The rewrite should not start from "delete all code and improvise."

It should proceed by salvage:

1. extract contracts and typed boundaries first,
2. extract stable primitives second,
3. rebuild owners around those contracts,
4. replace surfaces module by module.

Recommended order:

1. session/bootstrap contract,
2. restore/import contract,
3. DM read-model contract,
4. community read-model contract,
5. transport runtime contract,
6. backend coordination contract.

If a current owner cannot be stabilized without repeated regressions, the
migration may skip salvage and move directly to replacement:

1. keep the route/workflow surface,
2. delete or quarantine the current owner module,
3. rebuild the owner around the future backend contract,
4. reconnect the UI only after the new owner is deterministic.

## Compatibility Policy

During migration:

1. the old repo acts as a reference mine,
2. no new deep feature work should deepen old owner overlap,
3. compatibility bridges must be named and temporary,
4. each replacement module must reduce total ambiguity.

## Acceptance Criteria

This rewrite target is only valid if it improves:

1. maintainability,
2. iteration speed,
3. runtime determinism,
4. restore correctness,
5. participant/member visibility,
6. session continuity,
7. ability to evolve features without reopening old bug classes.

If a future architecture preserves privacy but still leaves multiple competing
truth owners for the same workflow, it has failed.
