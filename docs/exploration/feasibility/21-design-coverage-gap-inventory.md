# Feasibility — Design coverage gap inventory

**ID:** F-gaps  
**Status:** draft (meta — what to explore next)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Claim language:** **inventory** ≠ Cut 0 Pass · ≠ module Pass · ≠ impl queue (F9 **NARROW** recorded separately)

## 1. Scope

- **In:** Which **functional modules / product planes** already have design-concept coverage in this feasibility band, and which remain **unexplored or thin**.
- **Out:** Filling every gap in this file; coding; Soft L3 Pass.

## 2. Basics — how to read coverage

| Tag | Meaning |
|-----|---------|
| **Covered** | Dedicated feasibility note (or recorded solution) this band |
| **Partial** | Touched inside another note; needs its own deep pass |
| **Charter-owed** | On F0–F9 queue but **not written yet** |
| **Unexplored** | Important product surface; little/no concept work in this band |

As-built code exploration (`docs/exploration/modules/*`) is **complementary** — it maps today’s code, not the rewrite concept shelf.

## 3. Capabilities map — coverage matrix

### A. Already explored (this band)

| Module / theme | Note(s) |
|----------------|---------|
| Aggregator / adapter law | F0.5 |
| Relationship authority (CRM ≠ history) | F1 |
| Ideal stack (Rust/TS/SQLite) | F-stack |
| External crypto sources | F-sources |
| Perf · security · encryption tiers | F-PSE |
| Hub · vault · sandbox product shape | F-hub |
| Architecture alternatives (staged hub) | F-alt |
| Auth / Profile improvements | F-auth-profile |
| Auth schemes + solution record | F-auth-schemes · 15b |
| Relationship discovery & sync intents | F-rel-discover |
| Discovery methods catalog | F-discover-methods |
| Community / group systems · DC pin | F-groups |
| Network / relays / protocols settings | F-netconfig |
| Cross-device Continuity methods | F-sync |

### B. Charter queue still pending (must write before F9)

| ID | Topic | Why it still matters |
|----|--------|----------------------|
| **F2** | Nostr as carrier | Honest adapter limits (kinds, metadata, NIP-17 ≠ Signal) |
| **F3** | Matrix as carrier | Olm/Megolm · HS as “game server” fit |
| **F4** | Private relay / custom server | DC/VPS reference architecture |
| **F5** | E2EE models | Own vs reuse; tier policy → concrete choice |
| **F6** | Tor underlay | Transport ≠ product identity |
| **F7** | Decentralization spectrum | Sovereign vs federated vs P2P |
| **F8** | Universal auth · profile · DB | **Draft landed** — SQLite keep · vault envelopes · SQLCipher vs file-AEAD deferred to F9 cut |
| **F9** | Synthesis GO/NARROW/NO-GO | **NARROW recorded** — Cut 0 design next; messaging still thin |

### C. Product modules — partial or unexplored (design concepts)

| Module | Coverage now | Gap to explore |
|--------|--------------|----------------|
| **1:1 messaging / threads** | Stronger (F-msg skim) | Cut 0 design freeze of tables; T3/E2 impl; thin H-dc wire; receipts UX later |
| **Notifications** | Unexplored | Local vs push; privacy (no plaintext push); desktop badges; mute schedules |
| **Voice / AV / calls** | Unexplored (handoff: voice shipped, video blocked) | Call signaling under pins; media path; conference roadmap |
| **Media pipeline** | Partial (sandbox/vault) | Capture, compress, streaming, thumbnails, retention vs CAS |
| **Search (in-chat / global)** | Partial (people/community discovery) | Message search over E2EE local index; no server-side plaintext search lies |
| **Presence · typing · read state** | Unexplored | Metadata leakage vs UX; optional encrypted receipts |
| **Moderation · safety · ASE** | Unexplored in this band | Report/block UX; antisocial-engineering contract as product module; group mod tools |
| **Public profile / identity card** | Partial (discovery display) | What is publishable vs workspace-private; NIP-05-class names under hub |
| **Invites system** | Partial (discovery/groups) | Unified invite object across 1:1, group, event, workspace |
| **Onboarding · empty states** | Partial (Continuity gate) | First-run private-trust wizard; recovery file education |
| **Desktop shell** | Stronger (F-shell) | Cut UI Vite+TanStack timing; Linux WebKitGTK soak pin |
| **Mobile shell** | Partial (F-shell secondary) | Background sync limits; biometric UV optional; battery budgets; same SPA pipeline? |
| **i18n · accessibility** | Unexplored | Design constraints for rewrite UI |
| **Observability · diagnostics UX** | Partial (netconfig diagnostics) | User-facing support bundles without leaking secrets |
| **Packaging · release · channels** | Unexplored | Beta vs stable; lab relays never in prod defaults |
| **Payments / zaps / wallet** | Unexplored | In or out of product face; must not become auth root |
| **Bots · webhooks · automation** | Unexplored | Operator DC bots vs user workspace |
| **Feeds / timelines (non-DM)** | Unexplored | Public community content vs chat; spam controls |
| **Spaces / channel hierarchy** | Partial (F-groups open Q) | Discord-like categories as hub objects |
| **Governance / roles** | Partial (as-built sealed community) | Concept note for roles, kick, proposals under pin |
| **Compliance · legal export** | Unexplored | User data export; operator retention policies on DC |
| **Performance budgets productization** | Partial (F-PSE) | Named SLOs per surface (chat open, sync, dial) |
| **Threat model document (unified)** | Partial (scattered) | One maintainer-facing threat model spanning hub |

## 4. Fit to planes — “what’s missing” by plane

| Plane | Explored? | Still owed |
|-------|-----------|------------|
| Auth | Strong | Optional passkey cut design |
| Profile | Strong | Public vs private profile surfaces |
| Storage / DB / vault | Strong (candidates) | F9 engine pick (SQLCipher vs file AEAD); media CAS lifecycle |
| Relationship | Strong | Production gate proof is separate (paused Soft L3) |
| Message | **Weak** | Dedicated messaging design exploration |
| Transport | Partial | F2–F4, F6 carrier/underlay notes; F-netconfig is UX-side |

## 5. Libraries / stacks

N/A (meta). When filling gaps, reuse `_template.md` and cite F-sources / F-PSE.

## 6. Feasibility verdict

**Exploration covers platform shape + charter carriers F1–F8; F9 = NARROW. Still weak on several user-facing modules (messaging, calls, notifications, moderation, mobile).**

Suggested **next design-concept order** (docs only until Cut 0 design opens):

| Priority | Next note | Rationale |
|----------|-----------|-----------|
| **1** | **Cut 0 design spec** | Tier A + F-msg skim done; contracts before rewrite impl |
| **2** | Thin H-dc API outline (in Cut 0 or F4 addendum) | A2 MVP home |
| **3** | Notifications · Calls · Moderation | Secondary social surfaces |

## 7. Risks / traps

- Exploring endless peripherals past F8 → F9 delayed without new charter signal.  
- Treating as-built module READMEs as rewrite design.  
- Re-opening Soft L3 contact Pass under “messaging exploration.”

## 8. Open questions (maintainer steer)

1. Prefer finishing **charter F2–F8** before more product-module notes?  
2. Is **messaging** or **private DC (F4)** the higher-value non-charter deep dive?  
3. Are payments/zaps **in** or **explicitly non-goal** for the rewrite band?

## 9. References

- `docs/exploration/feasibility/README.md` (index)  
- `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
- `specs/backend/platform-rewrite-band-charter-2026-11.md`  
- `docs/exploration/00-methodology-and-synthesis-plan.md`  
