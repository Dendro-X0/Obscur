# Feasibility exploration shelf (platform rewrite)

**Status:** Active — F0–F8 drafts on shelf; **F9 NARROW recorded**  
 
 
**Charter:** [`specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`](../../../specs/backend/platform-feasibility-exploration-charter-2026-11-08.md)  
**Related as-built shelf:** [`docs/exploration/`](../README.md) (modules 1–8 — code reality, not carrier basics)

## Goal

Learn enough about **Nostr · Matrix · Tor · E2EE · decentralization · private relays** (and auth/profile/DB candidates) to decide whether Obscur’s platform concept is **feasible** before more rewrite coding:

> Universal authentication, profile, and database — switchable data-transmission protocols — multiple “apps” / carriers under one account.

## Rules

- **Docs only** until a Cut 0 **design** spec opens coding (F9 **NARROW** recorded — does not itself authorize impl)  

- Follow documentation standards in the charter (sections 1–9)  
- Soft L3 contact Pass / UI migrate-as-salvage are **out of scope** here  
- Correct protocol misconceptions in notes — do not paper over them with code

## Index

| ID | Topic | Status |
|----|--------|--------|
| F0 | Charter + standards | **Done** — platform-feasibility-exploration-charter |
| F0.5 | Aggregator law (protocols = adapters, one profile) | **Done** — [`00-aggregator-adaptation-law.md`](./00-aggregator-adaptation-law.md) |
| F1 | Relationship authority | **Done (draft)** — [`01-relationship-authority.md`](./01-relationship-authority.md) |
| F2 | Nostr as carrier | **Done (draft)** — [`02-nostr-carrier.md`](./02-nostr-carrier.md) |
| F3 | Matrix as carrier | **Done (draft)** — [`03-matrix-carrier.md`](./03-matrix-carrier.md) |
| F4 | Private relay / custom server | **Done (draft)** — [`04-private-relay-server.md`](./04-private-relay-server.md) |
| F5 | E2EE models | **Done (draft)** — [`05-e2ee-models.md`](./05-e2ee-models.md) |
| F6 | Tor underlay | **Done (draft)** — [`06-tor-underlay.md`](./06-tor-underlay.md) |
| F7 | Decentralization spectrum | **Done (draft)** — [`07-decentralization-spectrum.md`](./07-decentralization-spectrum.md) |
| F8 | Universal auth · profile · DB | **Done (draft)** — [`08-universal-auth-profile-db.md`](./08-universal-auth-profile-db.md) |
| F-stack | Ideal stack thought experiment (Rust kernel · TS UI · modular · SQLite) | **Done (draft)** — [`09-ideal-stack-thought-experiment.md`](./09-ideal-stack-thought-experiment.md) |
| F-sources | External E2EE / Nostr / encrypted-protocol sources | **Done (draft)** — [`10-external-e2ee-protocol-sources.md`](./10-external-e2ee-protocol-sources.md) |
| F-PSE | Performance · security · encryption standards | **Done (draft)** — [`11-performance-security-encryption-standards.md`](./11-performance-security-encryption-standards.md) |
| F-hub | Hub workspace · encrypted vault · multi-protocol apps | **Done (draft)** — [`12-hub-workspace-vault-adapters.md`](./12-hub-workspace-vault-adapters.md) |
| F-alt | Architecture alternatives · hub critique (feasibility · security · UX) | **Done (draft)** — [`13-architecture-alternatives-hub-critique.md`](./13-architecture-alternatives-hub-critique.md) |
| F-auth-profile | Auth & Profile improvement exploration | **Done (draft)** — [`14-auth-profile-improvement-exploration.md`](./14-auth-profile-improvement-exploration.md) |
| F-auth-schemes | Auth schemes beyond raw keypairs | **Done (draft)** — [`15-auth-schemes-beyond-raw-keypairs.md`](./15-auth-schemes-beyond-raw-keypairs.md) |
| F-auth-schemes-solution | Auth face solution record | **Direction recorded** — [`15b-auth-schemes-solution-record.md`](./15b-auth-schemes-solution-record.md) |
| F-rel-discover | Relationship discovery · decentralized sync | **Done (draft)** — [`16-relationship-discovery-decentralized-sync.md`](./16-relationship-discovery-decentralized-sync.md) |
| F-discover-methods | Discovery methods catalog (current + community/interest candidates) | **Done (draft)** — [`17-discovery-methods-catalog.md`](./17-discovery-methods-catalog.md) |
| F-groups | Community / group systems (public · private · DC / VPS pin) | **Done (draft)** — [`18-community-group-systems.md`](./18-community-group-systems.md) |
| F-netconfig | Network · relays · protocols settings redesign | **Done (draft)** — [`19-network-protocol-configuration-ux.md`](./19-network-protocol-configuration-ux.md) |
| F-sync | Cross-device profile sync (E2EE · decentralized) | **Done (draft)** — [`20-cross-device-profile-sync-e2ee.md`](./20-cross-device-profile-sync-e2ee.md) |
| F-gaps | Design coverage gap inventory (what’s left to explore) | **Done (draft)** — [`21-design-coverage-gap-inventory.md`](./21-design-coverage-gap-inventory.md) |
| F-shell | UI shell · libraries · WebView (Next vs React+TanStack) | **Done (draft)** — [`22-ui-shell-libraries-webview.md`](./22-ui-shell-libraries-webview.md) |
| F-confirm | Cut 0 confirmation gate (what still must be locked) | **Tier A recorded** — [`23-cut0-confirmation-gate.md`](./23-cut0-confirmation-gate.md) |
| F-msg | Messaging plane skim (schema freeze gate) | **Done (draft)** — [`24-messaging-plane-skim.md`](./24-messaging-plane-skim.md) |
| Cut 0 design | Account spine (NARROW impl gate) | **0.1–0.10 L1/docs** — [`cut0-account-spine-design-2026-11-09.md`](../../../specs/backend/cut0-account-spine-design-2026-11-09.md) · lab [`cut0-lab-milestone-checklist-2026-11-09.md`](../../../specs/backend/cut0-lab-milestone-checklist-2026-11-09.md) |
| Rewrite posture | Replacement ≠ preserve unviable foundations | **Recorded** — [`rewrite-replacement-posture-2026-11-09.md`](../../../specs/backend/rewrite-replacement-posture-2026-11-09.md) |
| Cut 1 design | Replacement authority (kill list + cutover) | **Draft ACK owed** — [`cut1-replacement-authority-design-2026-11-09.md`](../../../specs/backend/cut1-replacement-authority-design-2026-11-09.md) |
| F9 | Synthesis decision | **NARROW** — [`99-synthesis-decision.md`](./99-synthesis-decision.md) |

## Template

Copy [`_template.md`](./_template.md) for each new note.
