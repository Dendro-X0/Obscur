# 31 Long-Term Resilience and Context-Limits Playbook

_Last reviewed: 2026-04-19 (baseline commit a3f16b10)._

## Purpose

This document defines how Obscur can succeed over the long term in a development environment where:

1. contributors are few,
2. context windows are limited,
3. chat memory is unreliable,
4. architecture is fragile,
5. the product cannot afford repeated regressions in core trust paths.

The goal is not only to make the codebase more robust.

The goal is to make the project **durable under iteration**.

That means core functionality should survive:

1. contributor turnover,
2. interrupted threads,
3. partial understanding,
4. long-lived compatibility periods,
5. ambitious feature expansion.

## Definition of Long-Term Success

For this project, long-term success means:

1. core user-visible truths do not become thinner over time,
2. major features remain operable while the internals evolve,
3. architectural progress survives context loss,
4. new contributors can resume from files instead of chat memory,
5. the system becomes easier to change without becoming easier to break.

## Core Principle

In a limited-context environment, reliability does not come from remembering everything.

It comes from making the right things impossible to forget.

That requires:

1. file-backed continuity,
2. explicit behavioral ownership,
3. ratcheted invariants,
4. layered tests,
5. diagnostics that expose truth,
6. narrow, owner-safe slices.

## What Must Become Durable

### A. Durable Context

Important state must live in repository files, not in thread memory.

Durable context includes:

1. canonical owner boundaries,
2. active rewrite direction,
3. incident history,
4. current blockers,
5. next atomic step,
6. acceptance criteria,
7. known anti-patterns.

### B. Durable Behavioral Truth

For each fragile lane, define:

1. what is canonical truth,
2. what counts as evidence,
3. which layer imports evidence,
4. which layer derives projection truth,
5. which layer is UI adapter only.

### C. Durable Anti-Drift Gates

The codebase must make it hard to accidentally reintroduce old classes of bugs.

That means:

1. tests that ratchet behavior,
2. diagnostics that prove owner paths,
3. docs that name invariants,
4. release gates that fail when truth is ambiguous.

## Why Limited Context Breaks Projects

In this environment, failure usually happens through one of these patterns:

1. a contributor fixes the visible symptom but not the owner conflict,
2. a compatibility bridge is mistaken for a permanent solution,
3. a previous architectural decision is forgotten,
4. a green local test suite hides a cross-lane regression,
5. runtime truth is not recorded durably enough to survive interruption.

This means the project must be designed to survive partial understanding.

## The Long-Term Protection Model

### 1. File-Backed Continuity First

Every substantial thread should leave behind:

1. current status,
2. why the latest changes landed,
3. what remains broken,
4. exact next atomic step.

Canonical files:

1. `docs/handoffs/current-session.md`
2. `docs/12-core-architecture-truth-map.md`
3. `docs/14-module-owner-index.md`
4. incident and rewrite docs for the touched lane.

### 2. Behavioral Ownership Over Folder Ownership

A feature folder does not make a system safe.

A system becomes safe when each user-visible truth has:

1. one canonical import owner,
2. one canonical projection owner,
3. one canonical persistence owner,
4. one UI adapter path.

Everything else must be compatibility-only.

### 3. Ratchet the Invariants That Matter Most

Some invariants must only move in one direction: toward stronger guarantees.

Examples:

1. restore must not thin DM history,
2. restore must not collapse a joined community to self-only if stronger evidence exists,
3. provider hydration must not overwrite richer state,
4. profile/account scope must not leak across windows or restores,
5. UI success must not claim network truth without evidence.

Every fragile lane should have explicit ratchet tests for these.

### 4. Replace Broad Re-Exploration With Incident-Lane Replay

When something breaks:

1. identify the lane,
2. identify the canonical owner,
3. identify overlapping mutation paths,
4. replay only that lane’s tests and diagnostics first,
5. update the handoff.

This prevents the project from paying the full rediscovery cost on every interruption.

### 5. Use Diagnostics as Durable Memory

Diagnostics are not optional in this project.

They are part of how contributors recover context safely.

Diagnostics should answer:

1. which owner ran,
2. which evidence was present,
3. what was reconstructed,
4. what was dropped,
5. where thinning occurred.

### 6. Favor In-Place Rewrite Slices

The project should improve by rewriting one owner boundary at a time while keeping the product surface alive.

Each slice should:

1. reduce overlapping truths,
2. preserve current UX scope,
3. add tests,
4. add diagnostics,
5. update canonical docs.

### 7. Protect the Core Before Expanding

Long-term resilience comes from keeping a small set of trust paths sacred:

1. auth/unlock/session restore,
2. account/profile isolation,
3. DM history continuity,
4. community membership integrity,
5. room-key/sendability truth,
6. relay/runtime degradation handling.

If these are unstable, feature expansion should pause or stay narrowly scoped.

## What Each Module Needs to Survive Long-Term

For a module to remain resilient through years of iteration, it should have:

1. a named owner,
2. a typed contract,
3. a projection or reducer with deterministic rules,
4. persistence scoped explicitly,
5. UI adapters that do not reconstruct truth,
6. focused tests,
7. runtime diagnostics,
8. an incident doc or recovery section when high-risk.

## The Safe Iteration Loop

Use this loop for core work:

1. Restate the user-visible truth we are protecting.
2. Identify the canonical owner.
3. List competing truth paths.
4. Remove or quarantine at least one competing path.
5. Add or strengthen a ratchet test.
6. Add or verify diagnostics.
7. Verify runtime manually when cross-device/lifecycle-sensitive.
8. Update durable docs and handoff.

If a change skips steps 3, 5, or 8, the risk of future disruption remains high.

## What Makes a Change “Resilient Enough”

A change is resilient enough only when:

1. it improves behavior,
2. it reduces overlap,
3. it leaves behind evidence,
4. it is resumable by another contributor from repo files alone.

If the change only fixes behavior temporarily, it is not long-term progress.

## Required Artifacts for Long-Term Durability

For major lanes, keep these artifacts current:

1. truth-map owner row,
2. owner-index entry,
3. incident or rewrite doc,
4. handoff/current-session status,
5. focused test suite,
6. runtime verification packet or checklist.

## Context-Limit Rules

When context is tight:

1. checkpoint earlier, not later,
2. stop broad exploration,
3. resume from the latest atomic step,
4. prefer refining one owner path over scanning the whole codebase again,
5. write down decisions immediately when ownership changes.

## Healthy Signs

The project is becoming more resilient when:

1. failures localize to one owner boundary,
2. fixes delete overlapping paths instead of adding more,
3. tests catch regressions before runtime does,
4. restore and live convergence become less heuristic,
5. future contributors need less rediscovery.

## Unhealthy Signs

The project is still fragile when:

1. old regressions return under new symptoms,
2. different surfaces show different truths,
3. fixes require page-level heuristics,
4. runtime truth depends on timing luck,
5. contributors cannot explain who owns a behavior.

## Immediate Rule for This Project

For the next stage of Obscur, every important change should be evaluated by one question:

Does this make the system more likely to survive the next 20 iterations without re-breaking the same core trust path?

If the answer is unclear, the slice needs stronger ownership, tests, diagnostics, or documentation before it is considered done.
