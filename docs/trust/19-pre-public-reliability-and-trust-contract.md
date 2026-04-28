# 19 Pre-Public Reliability and Trust Contract

_Last reviewed: 2026-04-16 (baseline commit a3f16b10)._

This document defines the current phase policy for Obscur before broad public
promotion.

Obscur is still in a pre-public, community-first phase. In this phase, trust is
earned through reliability, explainability, and disciplined release gates, not
through rapid feature expansion.

## Phase Intent

Current priority order:

1. define and stabilize high-value core behaviors,
2. encode those behaviors as explicit contracts and tests,
3. verify them manually in runtime,
4. only then expand surface area.

The project should behave like a trustworthy underground tool before it behaves
like a polished mainstream product.

## Core Reliability Scope

The following flows are considered core and must not regress casually:

1. auth, unlock, logout, and session restore,
2. profile/account isolation across windows and switches,
3. direct message send, receive, delete, and replay convergence,
4. fresh-device restore and backup hydration,
5. updater, download, and release-distribution path,
6. community membership integrity and recovery,
7. relay/runtime degraded behavior and recovery,
8. privacy/trust controls and anti-abuse routing.

## Required Execution Order

For any core lane:

1. define the contract first,
2. implement or repair the owner path,
3. add focused tests and diagnostics,
4. run manual/runtime verification,
5. release only after evidence is recorded.

Do not skip directly from bug report to patch release.

## Contract Definition Rule

Before major changes to a core flow, document:

1. canonical owner,
2. accepted inputs and outputs,
3. failure/degraded states,
4. evidence that qualifies as success,
5. what must never be inferred from optimistic local state alone.

This contract may live in:

1. a canonical architecture/release doc,
2. a focused incident/recovery doc,
3. a typed boundary/module contract,
4. or all of the above when risk is high.

## Validation Rule Before Push

Core functionality is not considered ready to push unless it has all of:

1. code inspection on the touched owner path,
2. focused automated tests for the changed behavior,
3. typecheck and required release/documentation gates,
4. manual runtime replay when the flow is lifecycle-, relay-, or cross-device-sensitive.

For Obscur, manual replay is part of the definition of done for fragile flows.

## Push Policy

For core-flow work:

1. tests must pass before push,
2. docs must reflect the current truth before push,
3. runtime-sensitive claims must be backed by replay evidence before push if the
   change is intended to close a release blocker,
4. if replay is still pending, the code may land only when docs explicitly say
   the runtime truth is still open.

## Community Project Standard

Because Obscur is a community project:

1. trust and transparency outrank release speed,
2. evidence-backed behavior outranks speculative feature breadth,
3. the roadmap should promise only what the current gates can defend,
4. experimental work is welcome, but must not silently destabilize core trust paths.

## Expansion Rule

New feature work is encouraged only when:

1. the touched core lanes are green,
2. current release blockers are under control,
3. tests and replay coverage are keeping pace with complexity.

If those conditions are not true, prioritize reliability and test hardening over
new capability work.
