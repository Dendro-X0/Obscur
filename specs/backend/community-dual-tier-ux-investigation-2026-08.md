# Investigation — Community create & Relays setup friction (dual-tier)

**Date (UTC):** 2026-08-21  
**Status:** Findings for charter  
**Charter:** [community-dual-tier-ux-charter-2026-08.md](../../docs/program/community-dual-tier-ux-charter-2026-08.md)  
**Design:** [community-dual-tier-ux-design-2026-08.md](./community-dual-tier-ux-design-2026-08.md)

---

```text
HANDOFF ATOMIC STEP:  proposed CU-UX (charter) — no code until approve
PAUSED / CANCELLED:   COM-RUN-02 · COM-RUN-01 parity as ship goal
EVIDENCE:             Maintainer screenshots 2026-08-21 — Operator Setup applied; Create still empty host / red wall; Quiet pool healthy
```

---

## Symptom

Users cannot reasonably configure custom nodes or create groups. Packaged app shows healthy public Quiet relays while Create Group demands a “trusted community relay host” that is not in the SELECT list. Operator Setup (coordination + `ws://localhost:7000` + trust-local) does not complete the create journey.

Maintainer judgment: **UI and application logic make setup hard** whether the backend is Docker, VPS, or anything else.

## Root causes (structural)

| ID | Cause | Owner today |
|----|--------|-------------|
| **UX-1** | Relays tab mixes **DM Quiet pool** health with **workspace operator** config without a single “ready to create” outcome | Relays settings + Operator wizard |
| **UX-2** | Create catalog only lists **enabled non-public** candidates; public defaults filtered (`isPublicDefaultRelayHost` / managed gate) | `community-create-relay-catalog` · `community-mode-contract` |
| **UX-3** | Operator bundle snapshot does not reliably **prefill + unlock** Create when Quiet-only list is empty of private hosts | `create-group-dialog` + `readOperatorTrustBundleSnapshot` |
| **UX-4** | Lab flags (“Test without local Nostr relay”) contradict create’s host requirement | `community-dev-flags` |
| **UX-5** | Create dialog is a **policy console** (baselines, guarantees, tiers) not a create flow | `create-group-dialog.tsx` |
| **POL-1** | Product docs / kernel say public-relay create unsupported; CU-P1 soak wants production/public relays — **policy split** | workspace-kernel manifest vs CU-P1 |

## Evidence

1. Relays: Active transport primal · “Relay communication healthy” · Operator Setup filled (`:8787`, `:7000`, trust-local checked).  
2. Create: Relay Host empty · SELECT empty / no usable host · red “choose trusted host” · Create ineffective.  
3. Metrics earlier: public Quiet active; `http://127.0.0.1:8788` disabled (wrong node type for Nostr workspace chat).

## What “enterprise” needs vs what public Nostr can give

| Need (business teams) | Public Nostr reality |
|----------------------|----------------------|
| Fast setup | Possible if T0 allowed |
| Reliable long-term ops | Weak — relay operators control retention/delete |
| Full delete / compliance | Needs operator-controlled relay (+ hide policy) |
| Directory / roles | Needs coordination or equivalent |
| Cross-client roster truth | ACC-02 — not a ship promise on weak paths |

## Parallel paths (must not duplicate)

| Path | Risk |
|------|------|
| Patch only Docker enablement | Ignores product UX; fails CU-P1 “production relays” story |
| Re-enable sovereign create silently | Violates honesty; users expect Managed guarantees |
| Second create engine beside workspace-kernel | Dual owners — forbidden |

**Canonical direction:** Dual-tier charter — T0 Quick (public, limited) + T1 Team (operator); simplify Relays into two jobs; one create dialog with mode chooser.

## Out of scope for this investigation

- Implementing CU-UX code  
- COM-RUN-02 restore  
- Tor communities  
- Full Slack feature parity
