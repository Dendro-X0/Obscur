# Community dual-tier UX charter (2026-08)

**Status:** **Approved** (maintainer continue 2026-08-21) — first slice **CU-UX-2** in progress / landing  
**Kind:** Product + UX un-pause slice charter (modular-iteration)  
**Date (UTC):** 2026-08-21  
**Pairs:** [community-production-unpause-charter-2026-08.md](./community-production-unpause-charter-2026-08.md) · [workspace-kernel-manifest.md](./workspace-kernel-manifest.md) · [obscur-ecosystem-charter.md](./obscur-ecosystem-charter.md)  
**Investigation:** [community-dual-tier-ux-investigation-2026-08.md](../../specs/backend/community-dual-tier-ux-investigation-2026-08.md)  
**Design:** [community-dual-tier-ux-design-2026-08.md](../../specs/backend/community-dual-tier-ux-design-2026-08.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  none yet — this charter proposes CU-UX-1 / CU-UX-2
ACTIVE BAND / SCOPE:  Community CHARTERED / SOAK-ACTIVE (CU-P1 Verified)
PAUSED / CANCELLED:   COM-RUN-02 restore · COM-RUN-01 live roster parity as ship goal · Tor Verified · AUTH-SESSION
FORBIDDEN UNTIL APPROVE: free groups/** patches · re-enabling sovereign create without honesty copy · claiming Slack parity
CANONICAL OWNER (target): workspace-kernel create/list + Relays settings model (one create path)
PROOF BEFORE DONE:    L1 catalog/gates · L3 two-profile create on Quiet public · L3 operator path still works
SURFACE:              packaged desktop (primary) · docs/demo honesty
```

---

## Maintainer problem (2026-08-21)

Setting up a custom node / relay pool and creating a group is **too hard**. Operator Setup + Create Group feel like an expert console. Users cannot start a useful group on the **same Quiet public relays** already used for DMs without fighting empty-host gates.

**Required before v2.0.0 beta:** a group chat path that is **quick to start**, **honest about limits**, and a separate path that is **reliable for long-term / business-team** use (enterprise-grade controls when the team hosts infrastructure).

---

## Product thesis — two tiers (not one confused mode)

| Tier | Name (UI) | Infra | Goal |
|------|-----------|-------|------|
| **T0 — Quick group** | “Start on public relays” | Existing Quiet / user-enabled `wss://` public Nostr | Minutes to first message; family / casual / trial |
| **T1 — Team workspace** | “Hosted / operator workspace” | Team `wss://` (+ optional coordination HTTPS) | Long-term business teams; deletion, roles, directory, operator control |

**Hard rule:** T0 is **first-class and allowed**. T1 is **recommended for production teams**. Never pretend T0 equals T1.

This **revises** the current default UX that blocks Managed Workspace on public defaults (`isPublicDefaultRelayHost` create gate). Kernel authority for **T1** stays Path B / coordination when configured. **T0** uses a **documented limited** membership + message model (see design) — not a silent rebrand of Managed Workspace.

---

## Honesty contract (must ship in UI, not only docs)

When the user picks T0 (public), the create flow **must** show a short, plain notice and a confirm:

| Public / Quiet groups **do not** guarantee | Team / self-hosted **can** aim for |
|--------------------------------------------|-------------------------------------|
| Full message deletion / hide across all peers | Operator relay hide + tombstone (managed deletion path) |
| Enterprise roster / directory truth | Coordination membership directory |
| Strong admin / compliance controls | Roles, expel, invite ACL, operator trust |
| Cross-device roster parity | Still ACC-02 honest on weak paths |

Copy tone: teach, don’t shame. Pattern: Slack/Teams “workspace on our cloud” vs “self-managed” — Obscur maps cloud ≈ public Nostr (less control), self-managed ≈ your relay/VPS.

---

## Relays / custom nodes — simplify (CU-UX-1)

Collapse today’s Relays surface into **two jobs**:

1. **Message delivery (DM + Quick groups)** — enable/disable pool members; add `wss://`; health in plain language.  
2. **Team workspace (optional)** — one card: coordination URL + workspace relay → **Save & use for new teams**. Applying it **prefills Create** and unlocks T1. No parallel “Test without relay” expert traps in the default path.

Move lab-only toggles (coordination-only, trust-local override) behind **Advanced / Developer**.

---

## Create Group — simplify (CU-UX-2)

Default create:

1. Name  
2. **Where it runs:** Public relays (T0) | My team relay (T1)  
3. If T0 → honesty notice → Create  
4. If T1 → pick enabled private/`wss://` team host (or deep-link from Operator card) → Create  

Remove from the **default** first screen: guarantee tag clouds, relay baseline essays, empty host + red wall while Quiet is healthy.

---

## Enterprise-grade (T1) — reference bar (not clone)

Inspired by Slack / Microsoft Teams / Discord (business) **capabilities**, not their cloud lock-in:

| Capability | v2.0.0 beta bar (T1) | T0 |
|------------|----------------------|----|
| Fast create + invite | Yes | Yes |
| Encrypted group chat | Yes | Yes (sealed as shipped) |
| Roles / admin | Steward + member (expand later) | Minimal (creator + members) |
| Remove member | Yes (directory + leave) | Best-effort / honest limits |
| Message moderation / delete-for-all | Operator hide path when relay supports | **No** — copy says so |
| Directory / SSO | Coordination when configured; SSO later | No |
| Audit / retention | Operator policy (out of client) | No |
| Multi-team | Multiple workspaces | Multiple quick groups |

**Non-goals for beta:** full Slack replacement, channel sprawl UX, meeting/PSTN, marketplace bots.

---

## Relationship to existing bands

| Existing | Interaction |
|----------|-------------|
| **CU-P1** Verified | Keep; T0 aligns with “production relays” soak transport |
| **COM-RUN-02** CANCELLED | Unchanged — no restore loops |
| **COM-RUN-01** not ship goal | Unchanged — T0 must not promise roster parity |
| **workspace-kernel** “public create unsupported” | **Superseded for T0 only** by this charter when approved; T1 remains kernel/coordination path |
| Free `groups/**` churn | Still forbidden — only named CU-UX-* slices after approve |

---

## Proposed slices (after approve)

| ID | Deliverable | Exit |
|----|-------------|------|
| **CU-UX-1** | Relays settings: two-job layout; Operator card → prefills create; Advanced hides lab flags | L1 settings model tests · packaged Relays screenshot gate |
| **CU-UX-2** | Create dialog: T0/T1 chooser + T0 honesty modal; public create allowed | L1 gate tests · L3 two-profile T0 create+send on Quiet |
| **CU-UX-3** | T1 create still one-click from Operator card; deletion honesty in T0 vs T1 copy | L3 operator path smoke · copy i18n coverage |

Demo Segment I may use T0 live on packaged Quiet **after CU-UX-2**, or keep GIF stitch until then.

---

## Approve checklist (maintainer)

- [x] Dual tier (T0 public / T1 operator) accepted  
- [x] Public create allowed with mandatory honesty copy  
- [x] COM-RUN-01 / full delete **not** claimed on T0  
- [x] First code slice = **CU-UX-2**  
- [ ] Handoff Next Atomic Step updated to that slice (optional)

**CU-UX-2 landed (2026-08-21):** Quick group default · public Quiet create + ack · team tier keeps Managed gates · create no longer hardcodes `managed_workspace`.

**CU-UX-2b landed (2026-10-20):** T0 create honesty polish — subtract baseline/guarantee clutter on Quick path · ack reset on host change · persist `hostingTier` (`public_quiet` / `custom` / `operator`) · L1 Pass.

**CU-UX-4 landed (2026-10-20):** Governance roles L1 — managed stewards promote/demote via descriptor `stewardPubkeys` · members Steward badge · last-steward guard · L1 Pass.

**CU-UX-5 landed (2026-10-21):** Relay freedom — T1 Team may use public Quiet with mandatory honesty ack (not hard-blocked) · coordination still required · `public_relay_honest` / `public_default_honest` · catalog keeps Quiet selectable · L1 Pass.

**CU-UX-6 landed (2026-10-21):** Manage convert — existing groups T0↔T1 + hosting toggle (Quiet / custom / private) honesty-gated · steward seed on T0→T1 · local `updateGroup` host remount · **not** SF-B Spaces · L1 Pass.

**CU-UX-1 landed (2026-08-21):** Relays Team workspace card · lab flags under Advanced · **Save & use for new teams** enables workspace relay + prefers Team tier on Create.
