# 32 Community System Reset and Alternative Solutions

_Last reviewed: 2026-04-21 (baseline commit a3f16b10)._

Status: active product/design reset

## Purpose

This document records a hard product truth:

1. exact live community member-sync is not currently reliable enough to present
   as a product guarantee,
2. repeated attempts to "fix" the same UI drift class have not converted the
   underlying runtime into trustworthy exact-roster behavior,
3. the product should stop claiming capabilities it cannot currently deliver and
   instead provide stable alternative community functionality.

This is not a statement that communities are being removed.

It is a statement that unsupported promises must be removed from the product.

## Product Reality

Today the app can still support:

1. community creation,
2. invitation/share flows,
3. self-membership and sendability for the current user,
4. encrypted community chat continuity,
5. durable known-participant discovery from local evidence,
6. best-effort local presence presentation.

Today the app cannot honestly guarantee:

1. exact synchronized community member counts after refresh/reload,
2. exact live roster truth across devices/windows/relay ordering,
3. exact online/offline status for all current community members,
4. exact invite-eligibility decisions based on authoritative live roster truth.

## Features To Remove Or Demote

The following should no longer be treated as core guaranteed features until a
different architecture exists:

1. exact live member count as a first-class UX claim,
2. exact member list as a first-class UX claim,
3. roster-synchronized invite gating based on authoritative current membership,
4. exact online/offline roster as a trustable community control surface.

Allowed temporary uses:

1. diagnostics,
2. best-effort local hints,
3. hidden/internal owner debugging.

Disallowed user-facing claims:

1. "this community currently has exactly N members" unless that is backed by a
   trustworthy canonical path,
2. "this roster is synchronized with current reality",
3. "invite is blocked because the user is definitely already a member" if that
   conclusion depends on unstable roster truth.

## Alternative Community Model

The supported alternative model is:

1. communities expose a stable `known participants` directory,
2. that directory is built from durable local evidence,
3. the current user's own membership/sendability remains a separate concern,
4. live roster updates remain best-effort and diagnostic, not the primary UX
   contract.

### Stable Surfaces

Supported stable surfaces:

1. known participant count,
2. known participant directory/modal,
3. share access / invite flows,
4. local presence hints for known participants,
5. community descriptor and chat continuity.

### Separate Truths

These truths must stay separate:

1. self membership truth,
2. known participant directory,
3. best-effort live roster signals,
4. local presence hints.

The product should not collapse them into one unsupported "member list."

## UI Copy Rules

Community UI must follow these wording rules:

1. use `known participants` for the stable alternative module,
2. avoid `members` when referring to reload-stable directory counts,
3. avoid exact live roster wording unless the surface is explicitly diagnostic,
4. prefer `participant directory`, `known participants`, or `local presence`.

## Technical Direction

The alternative model currently relies on:

1. provider-owned live roster projection,
2. separate durable known-participants directory,
3. descriptor rows remaining compatibility data rather than live roster truth.

Future work should continue to:

1. remove remaining exact-member UI claims,
2. route invite exclusion and directory rendering through known participants
   instead of exact live roster,
3. keep live roster only as best-effort diagnostic input until a different
   architecture exists.

## Release Truth

For the current lane:

1. success is not "exact live roster finally works",
2. success is "community UX no longer lies about unsupported exact sync and the
   alternative module is stable after reload."

## Required Next Steps

1. audit remaining community surfaces for exact-member language,
2. replace unsupported member-sync claims with known-participant semantics,
3. validate that the stable count survives real refresh/reload paths,
4. capture runtime evidence showing the alternative module remains stable even
   when live roster signals drift.
