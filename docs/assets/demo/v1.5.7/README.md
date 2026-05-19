# v1.5.7 — Community governance manual matrix (G1)

Desktop PWA or Tauri shell. Record outcomes in this file or linked evidence when closing **v1.5.7**.

**Prerequisites:** Two Obscur identities (A, B) for rename; three (A, B, C) for expel. Shared sealed community with room keys distributed.

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
