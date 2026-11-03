# Frontend spec — Auth lock / unlock screen

**Date:** 2026-11-01  
**Surface:** `AuthScreen` mode `login` (+ conflict banner when manual lock)  
**Goal:** One calm composition — account first, minimal prose, Obscur dark glass language preserved.

## Composition (top → bottom)

1. **Status** — if locked/mismatch: one compact chip (title only + optional one short line). No multi-paragraph banners on the happy path.
2. **Identity hero** — large identicon, display name as primary title, key fragment as secondary mono line. Eyebrow: “Signing in as” (small).
3. **One supporting line** — ≤12 words (device password / private key). No nested “how it works” cards by default.
4. **Primary control** — password (or key) field + single CTA.
5. **Quiet links** — Advanced: private key · Details (collapsed literacy + device help).
6. **Footer** — existing SELF-CUSTODY / ANONYMOUS strip unchanged.

## Non-goals

- Redesign create / welcome greenfield flows this pass (leave structure; only login density).
- New brand colors; keep purple accent + glass card.
- Remove security truth — demote to Details, don’t delete.

## Acceptance

- DemoUser (or username) readable as hero, not buried mid-sentence.
- Default unlock view: ≤1 instructional sentence + form + CTA.
- Existing vitest unlock routing still passes.
