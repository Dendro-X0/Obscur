# 33 Community Modes and Relay Guarantees

_Last reviewed: 2026-04-21 (baseline commit a3f16b10)._

Status: active product/spec contract

## Purpose

This document defines the user-facing community modes Obscur can honestly
support and ties those modes to relay capability.

The goal is to stop treating `community` as one universal feature set when the
underlying runtime can operate in very different relay environments:

1. public default relays,
2. trusted private relays,
3. intranet or operator-controlled relays.

Community UX and promises must follow those environments.

## Product Anchor

Obscur is:

1. local-first,
2. privacy-first,
3. sovereignty-first,
4. relay-configurable,
5. E2EE-centered.

That means:

1. content privacy can remain strong even on public relays,
2. membership/directory guarantees depend on relay/runtime trust and control,
3. low-friction public usage and stronger managed-team guarantees should not be
   collapsed into one ambiguous community product.

## User Experience Principles

The community redesign should optimize for usefulness without lying about
capability.

Principles:

1. defaults must be simple enough for non-technical users,
2. stronger guarantees must be available for technical users who are willing to
   configure relays deliberately,
3. privacy and sovereignty remain non-negotiable across all modes,
4. the app should prefer explicit tradeoffs over hidden complexity,
5. a user should always know what kind of community they are creating and what
   guarantees it receives.

## Relay Capability Tiers

### Tier 1. Public Default

Examples:

1. global default relays,
2. public third-party relays chosen in Settings,
3. heterogeneous relay mixes the app does not control.

Characteristics:

1. lowest friction,
2. lowest operator control,
3. weakest membership/directory guarantees,
4. content privacy still acceptable through E2EE.

Default expectation:

1. this is the out-of-the-box app experience,
2. users do not need to understand relay topology to begin,
3. the app must stay usable even if directory semantics remain weak.

### Tier 2. Trusted Private

Examples:

1. org-run relays,
2. family/friend-owned relays,
3. invite-only relay clusters with known operators.

Characteristics:

1. moderate friction,
2. higher operator trust,
3. stronger persistence and directory guarantees may be possible,
4. still must preserve end-to-end encrypted content expectations.

Default expectation:

1. this is for users who understand relay configuration,
2. the app may expose stronger coordination affordances here,
3. guarantees must still be tied to explicit relay assumptions.

### Tier 3. Managed Intranet / Workspace

Examples:

1. office intranet deployments,
2. self-hosted relay fleets for work coordination,
3. project or team environments where relay topology is controlled.

Characteristics:

1. highest setup friction,
2. strongest operator control,
3. strongest honest basis for durable directory, membership, and coordination
   guarantees.

Default expectation:

1. this is for work teams and controlled deployments,
2. the app may offer the strongest directory/workflow features here,
3. those guarantees should never be implied when running on Tier 1 relays.

## Community Modes

## 1. Sovereign Room

This is the default mode and should work over Tier 1 relays.

Primary purpose:

1. private group communication,
2. low-friction shared rooms,
3. privacy-preserving collaboration where users retain sovereignty.

Guaranteed:

1. encrypted room messaging,
2. share/invite access flow,
3. room identity and metadata,
4. local history and restore inputs,
5. best-effort local participant discovery,
6. user-configurable relay operation.

Not guaranteed:

1. exact live member list,
2. exact synchronized roster after refresh/reload,
3. exact global online/offline presence,
4. strict member-admin workflow based on authoritative live roster truth.

Required UX rules:

1. do not present exact member counts as canonical truth,
2. frame people surfaces as local or best-effort,
3. prioritize access, encrypted chat, and room continuity over roster control.

Recommended product framing:

1. "private room" or "sovereign room",
2. "encrypted coordination space",
3. "best-effort people context",
4. no roster-administration copy.

## 2. Managed Workspace

This mode should only be offered when Tier 2 or Tier 3 assumptions are
explicitly configured.

Primary purpose:

1. work coordination,
2. durable team spaces,
3. higher-trust relay-backed collaboration.

May guarantee:

1. stronger member directory persistence,
2. stronger membership approval/role semantics,
3. stronger coordination affordances,
4. more reliable workspace-wide presence/directory behavior,
5. operational controls appropriate for teams.

Only promise these when:

1. relay topology is explicit,
2. runtime capability is sufficient,
3. validation exists for the chosen guarantee set.

Recommended product framing:

1. "workspace",
2. "team coordination",
3. "relay-backed directory",
4. "managed membership controls".

## Feature Guarantee Matrix

| Feature | Sovereign Room | Managed Workspace |
| --- | --- | --- |
| Encrypted community chat | guaranteed | guaranteed |
| Share / invite access | guaranteed | guaranteed |
| Local room continuity after reload | guaranteed | guaranteed |
| Best-effort local participant discovery | guaranteed | guaranteed |
| Exact live member roster | not guaranteed | allowed only when relay/runtime contract supports it |
| Durable relay-backed member directory | not guaranteed | target capability |
| Strong membership administration | demoted | target capability |
| Workspace coordination features | limited | target capability |
| Global online/offline roster truth | not guaranteed | allowed only with stronger relay contract |

## Settings and UX Mapping

The existing relay settings page is the correct user-facing anchor.

The redesign should map to it explicitly:

1. global relay configuration remains the default transport baseline,
2. advanced relay configuration becomes the gate for stronger workspace mode,
3. community creation/join UI should show which mode and guarantees are in
   effect,
4. mode labels must be understandable without reading protocol docs.

Recommended future UI:

1. `Community Mode: Sovereign Room`
2. `Community Mode: Managed Workspace`
3. `Guarantees:`
   - `Encrypted Chat`
   - `Reload-Stable Access`
   - `Best-Effort Directory`
   - `Relay-Backed Directory`
   - `Workspace Controls`

### Relay Settings Mapping

The current relay settings should become the source of truth for community
capability messaging.

#### Default Path

1. app boots with several public relays enabled,
2. users get encrypted messaging and rooms immediately,
3. community creation defaults to `Sovereign Room`,
4. no advanced relay decision is required.

#### Advanced Path

Advanced Settings can later expose:

1. relay profile selection:
   - `Public Default`
   - `Private Trusted`
   - `Intranet Workspace`
2. per-community relay override,
3. relay profile pinning for a workspace,
4. "stronger guarantees require controlled relays" guidance.

### Creation UX Recommendation

Community creation should not ask every user to become a relay expert.

Recommended flow:

1. default creation path:
   - "Create Private Room"
   - uses current global relays
   - promises only sovereign-room guarantees
2. advanced creation path:
   - "Create Workspace"
   - only shown behind advanced/technical affordance
   - requires explicit relay profile or workspace relay selection
   - displays stronger guarantee contract before creation

### Community Details UX Recommendation

The details page should always surface:

1. active community mode,
2. relay profile/capability tier,
3. guarantee summary,
4. what is encrypted,
5. what is only best-effort.

This is more important than trying to mimic a mainstream member list when the
mode cannot support it honestly.

## Product Rules

### Do Not Promise

1. exact live roster in Sovereign Room mode,
2. workspace-grade directory behavior on public relays,
3. synchronized presence without relay/runtime contract support.

### Do Promise

1. privacy and sovereignty,
2. encrypted transmission,
3. configurable relay topology,
4. explicit tradeoffs between low-friction public use and stronger managed
   relay deployments,
5. that advanced users can opt into stronger community guarantees through relay
   configuration when the environment supports them.

## Validation Rules

Before a mode is called release-ready:

1. automated tests must exist for its core guarantees,
2. manual runtime replay must confirm those guarantees,
3. UI copy must match the guarantee level exactly,
4. no weaker environment may silently inherit stronger guarantees.

## v1.4.0 Implications

For `v1.4.0`, the community system overhaul should deliver:

1. explicit community modes,
2. explicit relay capability framing,
3. removal/demotion of unsupported universal roster promises,
4. validation requirements for every stronger guarantee we keep.

## Immediate Next Steps

1. update the `v1.4.0` roadmap docs so community-system overhaul is the primary
   release story,
2. define the community-system verification packet around mode-specific
   guarantees,
3. implement mode-aware community creation UX from the current relay settings
   model,
4. only then expand managed-workspace relay-settings integration.
