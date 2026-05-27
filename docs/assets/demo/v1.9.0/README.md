# v1.9.x — Lane K manual verification matrix

**Environment:** [manual-verification-environment.md](../../../program/manual-verification-environment.md)  
**Spec:** [v1.9.0-kernel-backend-spec.md](../../../program/v1.9.0-kernel-backend-spec.md) §B2–B3  
**Required from patch:** v1.9.2 (coordination directory) — rows marked **—** until then.

**Coordination URL:** Set `NEXT_PUBLIC_COORDINATION_URL` at build (shown under Settings → Relays → Community membership sync) for coordinated-mode rows.

---

## Matrix

| ID | Scenario | Mode | Tester 1 | Tester 2 | Pass criteria |
|----|----------|------|----------|----------|---------------|
| K-M1 | A leaves community; B online same relay | `coordination_preferred` | Leave NEWTEST-style group | Observe Participants modal | B shows A under **Excluded**; re-invite enabled ≤60s |
| K-M2 | A leaves; B offline; B opens app later | `coordination_preferred` | Leave | Reopen after 5+ min | B applies head on subscribe; same as K-M1 |
| K-M3 | A leaves | `nostr_only` | Leave | Observe | UI shows honest limit copy; no “relay-confirmed member” for leaver |
| K-M4 | Sovereign + `nos.lol` create | `sovereign_room` | Create group | — | Create flow warns re roster parity |
| K-M5 | DM delete-for-me | — | Delete message | New window / restore | Message stays hidden (B4 / DM-001) |
| K-M6 | Community roster after reload | — | Refresh group home | — | Member count stable; no collapse to 1 (B4 / R2) |

---

## Pass column (fill on sign-off)

| ID | v1.9.2 | v1.9.3 | v1.9.5 | Notes |
|----|--------|--------|--------|-------|
| K-M1 | | | | |
| K-M2 | | | | |
| K-M3 | | | | |
| K-M4 | | | | |
| K-M5 | | | | |
| K-M6 | | | | |

**Band exit (K3):** K-M1, K-M2, K-M3 Pass on tagged v1.9.3+; K-M5/K-M6 Pass on v1.9.5.

---

## Evidence

Attach screenshots to `docs/assets/demo/v1.9.0/evidence/` with naming `K-M{n}-tester{1|2}-{date}.png`.
