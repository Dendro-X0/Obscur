# Design — U5 Roster UI honesty (“Find in community”)

**Status:** Wave A Done · Wave B Done · 2026-07-31  
**Parents:** [community-unpause-integration-study-2026-07.md](./community-unpause-integration-study-2026-07.md) §6 U5 · [membership-graph-integration-study-2026-06.md](../../docs/program/membership-graph-integration-study-2026-06.md) §2.2–§2.3

---

## Session gate

```text
HANDOFF ATOMIC STEP:  U5 Wave B Done — header metrics honesty
PAUSED / CANCELLED:   Full community · COM-RUN-* · O-2/O-4 · RIW-8 · U6 · Dev Lab as validation
CANONICAL OWNER:      community-header-member-metrics + ChatHeader (directory | known-here)
PROOF BEFORE DONE:    header-metrics + chat-header + U5 contract vitest (no roster parity claim)
OUT OF SCOPE:         COM-RUN-01 parity · U6 invite role · full-band un-pause · AUTH-SESSION
```

**Charter:** Maintainer selected **U5 Wave B** after R1 Done (2026-07-31). Wave A (picker) remains Done.

**Wave B closeout (2026-07-31):** L1 Pass — `community-header-member-metrics` + `ChatHeader` “online here” + source tooltip; `main-shell` feeds resolver (no `Math.max` inflate).

---

## Goal

Replace the group-home **Community Participants** modal (Online/Offline columns + Reconcile) with an honest **Find in this community** picker: discoverability only — not a synced roster.

---

## Subtraction (Wave A)

| Remove from picker | Keep |
|--------------------|------|
| Online / Offline column layout | Search + pagination |
| `CommunityMembershipEvidenceToolbar` Reconcile in picker | `MemberProfileRow` → profile/DM |
| Subtitle implying directory sync / authoritative roster | Author evidence + contact intersection |
| Rendering unbounded full roster as sync theater | Cap recent / connections sections (50) |

---

## Target UX

1. **Title:** Find in this community  
2. **Subtitle:** People visible to you here (from chat, your connections, and local directory hints). Not a complete member list.  
3. **Sections (single column, ordered):**
   - Recent in chat — `authorEvidencePubkeys` ∩ visible (cap 50)
   - Your connections here — accepted peers ∩ visible (cap 50)
   - Everyone else visible — remainder matching search (cap 50 + page)
4. **Search** filters all sections locally (name / pubkey / nip05).  
5. **Optional:** Left/expelled terminal list remains operator honesty, not “roster sync.”  
6. **No** Reconcile control on this surface.

---

## Owners

| Concern | Owner |
|---------|-------|
| Display pubkey set | `useCommunityParticipantRosterReadModel` / W3 projection (unchanged) |
| Picker presentation | New `community-find-in-community-picker.tsx` |
| Page wiring | `group-home-page-client.tsx` — thin mount |

---

## Proof

```bash
# L1 — source contract: no Online/Offline columns; no reconcile toolbar in picker path
pnpm -C apps/pwa exec vitest run app/features/groups/components/community-find-in-community-picker.contract.test.ts
# Neighbor — workspace kernel still green
pnpm verify:workspace-kernel
```

**Do not claim:** COM-RUN-01 fixed · cross-profile roster parity · community un-paused.

---

## Wave B — Header metrics honesty (§2.3)

**Goal:** Chat header (and any numeric member/online label fed from the same owner) shows **one labeled local source** — never implied global “N online in the community.”

### Subtraction

| Remove / stop | Keep |
|---------------|------|
| `Math.max(active, r2, persisted)` inflate for header count | Single resolver output |
| Bare `{{count}} online` copy | `{{count}} online here` (capped to visible set) |
| Driving header from provisional-repair / reconcile widen stacks | Directory snapshot **or** known-here OR-set |

### Owner + contract

| Concern | Owner |
|---------|-------|
| Resolve count + source + online-among-visible | New `community-header-member-metrics.ts` |
| Presentation | `ChatHeader` — tooltip/title for source; online “here” copy |
| Wire | `main-shell.tsx` — feed resolver; no parallel page-local count math |

**Rules:**

1. If coordination directory materialization is present for `communityId` (including empty active set after leave), **member count = directory active length**, source=`directory`, tooltip includes fetch time when known.
2. Else **member count = known-here pubkey set length** (min 1 when self/local evidence exists), source=`known_here`, tooltip: not a full list.
3. **Online** = `isPeerOnline` among the presence set (directory actives if used and non-empty, else known-here). Never a global community online figure.

### Proof Wave B

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/groups/services/community-header-member-metrics.test.ts \
  app/features/messaging/components/chat-header.test.tsx \
  app/features/groups/components/community-find-in-community-picker.contract.test.ts
```

**Do not claim:** COM-RUN-01 · cross-profile header parity · community un-paused.

---

## Claim language

| May say | When |
|---------|------|
| U5 Wave A Implemented | Contract Pass + picker mounted |
| U5 Wave B Implemented | Header-metrics + chat-header L1 Pass |
| Roster / header honest | Copy + structure match §2.2–§2.3 (no parity) |
| Fixed COM-RUN-01 | **Never** from this slice |
