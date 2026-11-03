# v1.5.7 — Community governance manual matrix (G1)

Desktop PWA or Tauri shell. Record outcomes in this file or linked evidence when closing **v1.5.7**.

**Prerequisites:** Two Obscur identities (A, B) for rename; three (A, B, C) for expel. Shared sealed community with room keys distributed.

**Automated pre-check (CI, not a substitute for G1):** `pnpm release:test-pack` includes `community-governance-reducer`, `community-governance-sealed`, `community-display-name`, `community-provisional-membership-cache`, `community-terminal-membership-cache`, `community-member-evidence-tier`, `relay-publish-user-copy`, and `upload-user-copy` unit tests.

**Desktop regression (U4):** [v1.5.8 demo matrix](../v1.5.8/README.md).

---

## G1.1 — Two-member rename (governance)

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 1 | A | Open community → Management → General; change display name; **Propose** (not solo save) | Governance proposal visible; banner/tab badge |
| 2 | B | Open same community → Governance tab | Sees open `update_descriptor` proposal |
| 3 | B | Vote **Approve** | Proposal resolves **accepted**; descriptor/name updates for both |
| 4 | Both | Network list + home title | Human name (not raw hex group id) |

**Pass:** B’s approve triggers sealed `governance.resolved` / accepted and persisted descriptor.

---

## G1.2 — Three-member expel (governance)

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 1 | A | Management → member C → **Propose expulsion** | Proposal published; A auto-approve vote |
| 2 | B | Governance → vote **Approve** | Quorum met; C expelled; not in active roster |
| 3 | C | Re-open community (if still has keys) | No longer active member / appropriate access denial |

**Pass:** Expel uses governance path (not legacy `vote-kick`) when `members.length > 2`.

---

## G1.4 — Invite accept + membership evidence tiers (two accounts)

**Prerequisites:** A (admin), B (invitee); sealed community with room key; B not currently terminal-blocked on device.

| Step | Actor | Action | Expected |
|------|-------|--------|----------|
| 1 | A | Invite B via connections; B sees invite card in DM | Outgoing invite visible on A; incoming on B |
| 2 | B | Accept invite | Card shows **Acceptance recorded** + **Chat evidence · provisional** banner (amber) |
| 3 | B | Open community home → **Community Participants** | B may show **Provisional** badge until relay roster catches up |
| 4 | A | Same participant list | After relay sync, B shows **Relay-confirmed** (provisional badge drops) |
| 5 | B | Leave community once, then A re-invites and B accepts | If B stuck hidden: **Excluded from active roster** section shows **Terminal**; **Clear terminal cache** → confirm → **Reconcile membership** restores visibility when relay allows |
| 6 | A + B | A sends a **second** invite after an earlier accept in the same DM thread | New invite stays **Pending** on A until B responds; B sees **NewTest 1** (not generic **Private Group**) and can **Accept** or **Complete join on relay** |

**Pass:** Invite title matches community name; A/B card status agree for the same invite; stale accept does not block a new invite.

---

## G1.3 — Tie close (optional, code v1.5.7+)

| Step | Action | Expected |
|------|--------|----------|
| 1 | In a 4+ member room, reach **equal** approve and reject counts both ≥ quorum | Proposal closes **rejected**; no descriptor/expel side effects |

---

## Sign-off

| Check | Date | Notes |
|-------|------|-------|
| G1.1 | | |
| G1.2 | | |
| G1.3 | | |
| G1.4 | | Membership evidence / re-invite |
