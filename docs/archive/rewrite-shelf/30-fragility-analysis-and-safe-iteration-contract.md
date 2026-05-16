# 30 Fragility Analysis and Safe Iteration Contract

_Last reviewed: 2026-04-19 (baseline commit a3f16b10)._

## Purpose

This document explains why Obscur is fragile even though the repository is already fairly modular in structure, and how to protect the product so incremental iteration stops breaking adjacent functionality.

This is not a call to restart the MVP, disable features, or flatten the project into a simpler product.

It is a call to distinguish:

1. structural modularity,
2. behavioral ownership,
3. convergence safety,
4. iteration discipline.

## Key Distinction

The repo is already modular in one important sense:

1. app surfaces are separated,
2. shared packages exist,
3. features have roots,
4. docs and recovery material are relatively organized.

That part is not the main problem.

The main problem is that **behavioral truth is not yet modular enough**, especially in fragile lanes.

In other words:

1. the files are modular,
2. the behaviors are still overlapping.

## Why This Project Is Unusually Fragile

Obscur combines constraints that make ordinary product patterns unreliable:

1. decentralized transport,
2. local-first truth,
3. multi-layer encryption,
4. relay-mediated recovery,
5. multiple runtime surfaces,
6. no central authoritative backend to collapse ambiguity.

That means many normal shortcuts are unavailable.

You cannot safely rely on:

1. a server as the final source of truth,
2. a single always-online database,
3. a single session owner,
4. a single timeline feed that all clients trust automatically.

Instead, the system must converge from evidence.

That is the hard part.

## The Real Fragility Pattern

The dominant failure mode is not “the code is unmodular.”

It is:

1. one domain has several partial truths,
2. multiple modules try to help reconstruct the same user-visible state,
3. those helpers evolve at different speeds,
4. a new fix improves one path while another path silently becomes stale,
5. runtime then selects or merges thinner state.

This is why the same regressions reappear in new forms.

## The Main Sources of Fragility

### 1. Overlapping State Owners

The same user-visible state can currently be reconstructed from several places:

1. backup restore payload,
2. canonical account-event append,
3. persisted chat-state,
4. provider hydration,
5. route/page fallback heuristics,
6. live relay transport evidence.

When those are all allowed to materialize product truth, the system becomes drift-prone.

### 2. Compatibility Bridges That Became Semi-Permanent

Many bridges were valid for rapid iteration:

1. direct chat-state restore,
2. recovery from legacy persisted rows,
3. provider-level fallback reconstruction,
4. page-level member/message inference.

The problem is not that these bridges exist.

The problem is when they continue mutating live state after canonical owners also exist.

### 3. Partial Evidence Treated Like Complete Truth

In a decentralized encrypted system, evidence often arrives partially:

1. room key without full roster,
2. ledger entry without rich member list,
3. DM invite without later relay roster,
4. relay roster without full local restore context,
5. projection append before compatibility stores have caught up.

If one partial signal gets promoted too early, the UX thins out.

### 4. Async Ordering Races

The same account can be restored and hydrated through:

1. startup bootstrap,
2. new-window login,
3. relay backup restore,
4. provider remount,
5. IndexedDB migration,
6. live subscriptions.

Those sequences are individually valid, but their ordering is not always protected tightly enough.

### 5. Module Boundaries Exist, But Contracts Between Them Are Weak

A feature folder is not enough.

What matters is whether the boundary clearly answers:

1. who imports evidence,
2. who derives truth,
3. who persists it,
4. who is allowed to mutate it,
5. who only reads it.

When those answers are blurry, iteration drift is guaranteed.

### 6. Tests Protect Slices, But Not Enough Cross-Lane Invariants

Many focused tests exist and are valuable.

But the current risk is not usually a single function failing.

It is one lane thinning another lane’s truth.

That requires stronger ratchet tests around:

1. restore cannot make history thinner,
2. community recovery cannot collapse to self-only when invite evidence exists,
3. provider hydration cannot overwrite richer state,
4. page adapters cannot reassemble conflicting truth.

## What “Safe Incremental Iteration” Must Mean Here

Incremental iteration is still the right strategy, but only if every slice does two jobs:

1. improve behavior,
2. reduce the number of competing truth paths.

If a slice improves behavior but adds another compatibility path, the system gets less safe even when the local fix looks correct.

## The Protection Strategy

### A. Protect Behavioral Ownership, Not Just Folder Layout

For every fragile domain, explicitly separate:

1. import owner,
2. projection owner,
3. persistence owner,
4. UI adapter.

A module is not safe until those are distinct and named.

### B. Require One Canonical Read Authority Per User-Visible Surface

Examples:

1. one DM conversation authority,
2. one DM timeline authority,
3. one community membership projection,
4. one route navigation owner.

Fallback layers may exist, but they must not compete as normal read truth.

### C. Treat Compatibility Paths as Temporary, Measurable Debt

Each compatibility bridge should have:

1. a named owner,
2. a reason for existing,
3. diagnostics proving when it is used,
4. an exit condition for removal.

If any of those are missing, the bridge is now architecture debt, not a migration tool.

### D. Add Ratchet Invariants

The codebase should defend a small set of non-negotiable invariants:

1. restore must not thin DM history,
2. restore must not collapse joined community roster to self-only when stronger evidence exists,
3. provider hydration must not overwrite richer restored state,
4. live relay updates must not demote canonical projection truth,
5. profile/account scope must be explicit at every persistence boundary.

These invariants should be tested directly.

### E. Prefer Convergence Tests Over Isolated UI Tests in Fragile Lanes

The most valuable tests in this project are not simple component assertions.

They are:

1. sender/receiver tests,
2. account A/account B tests,
3. fresh-window/fresh-device restore tests,
4. out-of-order evidence convergence tests,
5. “thinner-after-restore” regression tests.

### F. Use Diagnostics as Part of the Architecture

In this system, diagnostics are not optional debugging extras.

They are part of the architecture contract because they tell us:

1. which owner path actually ran,
2. which evidence was present,
3. where thinning occurred,
4. whether a compatibility bridge is still active.

### G. Limit Slice Size to One Shared Boundary at a Time

Do not try to “fix restore”, “fix community”, and “fix messaging” in one broad pass.

Choose one shared boundary, for example:

1. restore import,
2. DM read authority,
3. community membership projection,
4. provider hydration boundary.

Then:

1. define the owner,
2. remove overlap,
3. add tests,
4. add diagnostics,
5. verify runtime.

## Practical Safety Rules for Future Work

Before merging any core slice, answer:

1. Which user-visible truth is being touched?
2. Which module is now the canonical owner?
3. Which older mutation/read path was removed or quarantined?
4. Which regression invariant is now ratcheted?
5. Which runtime diagnostic proves the correct owner ran?

If those answers are missing, the slice is not safe enough yet.

## Immediate Focus

The current most dangerous overlap remains:

1. restore import,
2. DM history authority,
3. community membership projection.

These are the correct next places to harden if we want iteration to stop breaking adjacent features.

## Success Criteria

We should consider the system substantially less fragile only when:

1. new-window/fresh-device restore preserves full expected DM history,
2. joined community rosters reconstruct correctly without self-only collapse,
3. live join/leave updates converge across surfaces without manual refresh,
4. new fixes remove competing truth paths instead of adding them,
5. future regressions localize to one owner boundary instead of cascading across several.
