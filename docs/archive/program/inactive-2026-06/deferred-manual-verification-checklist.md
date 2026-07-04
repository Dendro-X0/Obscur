# Deferred manual verification checklist

**Status:** Legacy row catalog — **superseded for execution order** by [unified-verification-matrix.md](./unified-verification-matrix.md) (Phase B)  
**Policy:** [concentrated-version-delivery.md](./concentrated-version-delivery.md) — run **once** per concentration unit, not between slices  
**Environment:** [manual-verification-environment.md](./manual-verification-environment.md)  
**Implementation lane:** [v1.8.x-batch-implementation-lane.md](./v1.8.x-batch-implementation-lane.md)

Use this single list instead of opening every `docs/assets/demo/v*/README.md` during development. Check rows when a **named milestone** is code-complete or before tag; skip rows you cannot run (note **blocked** / **skipped** + reason). Do **not** run §6 K-M rows incrementally after each B2/N/perf slice.

**Legend:** `[ ]` not run · `[x]` pass · `[!]` fail · `[-]` skipped / N/A

---

## Prerequisites (pick what you have)

| Setup | Needed for sections |
|-------|---------------------|
| Two desktop windows — Tester1 (dark) + Tester2 (light) | §1–§4 |
| `pnpm dev:desktop:online` | §1–§4 (fastest desktop loop) |
| `pnpm dev:mobile-shell:online` + Chrome device mode | §5 (no APK) |
| Android emulator or USB device + debug APK | §5 install rows |
| `pnpm dev:relay` + coordination `:8787` | §3, §6 |
| GitHub Actions green Full Release + downloaded assets | §7 |

---

## §1 — Desktop core (Wave 0 on `main`, unpublished)

**Profiles:** Tester1 dark + Tester2 light, two windows or two profiles.

| ID | Feature | Steps | Result |
|----|---------|-------|--------|
| D-01 | **Cold start → unlock** | Launch desktop, unlock Tester1; no infinite spinner >45s | `[ ]` |
| D-02 | **Open in new window** | Profile 2 → new window; settings (e.g. theme) **persist**; not welcome/create-identity | `[ ]` |
| D-03 | **No false duplicate session** | Two windows same profile ~10s online; no “Another active session” lockout | `[ ]` |
| D-04 | **DM thread after nav** | Open DM → Settings → back; thread not blank | `[ ]` |
| D-05 | **Group → DM switch** | Open group chat → switch to DM; full bidirectional history without refresh | `[ ]` |
| D-06 | **Secondary profile unlock** | Unlock profile 2; DM list hydrates without hard reload / auth bounce | `[ ]` |
| D-07 | **Relay primary failover** | Disable primary relay; app selects alternate; no update-depth crash | `[ ]` |
| D-08 | **Search jump** | Settings search + chat message search scroll/highlight target | `[ ]` |

---

## §2 — Communities & invites (environment-dependent)

Skip entire section if no relay/coordination. Ref: [v1.8.6 demo](../assets/demo/v1.8.6/README.md), [v1.8.8 demo](../assets/demo/v1.8.8/README.md).

| ID | Feature | Steps | Result |
|----|---------|-------|--------|
| C-01 | **Managed workspace create** | Create with operator relay + coordination; mode/trust gates honest | `[ ]` |
| C-02 | **Invite → accept (DM)** | A invites B; B accepts in DM; status updates on A | `[ ]` |
| C-03 | **Relay join after accept** | B completes relay join; both reach sealed group chat | `[ ]` |
| C-04 | **Local history after restart** | Send messages → restart both clients; history on open | `[ ]` |
| C-05 | **Leave / roster truth** | Leave community; other client roster updates; no ghost re-join | `[ ]` |
| C-06 | **Workspace delete UX (D3)** | Operator workspace delete copy honest | `[ ]` |

**Blocked note:** G6-4 loopback coordination from desktop WebView — use browser `:3340` or staging if desktop POST fails.

---

## §3 — Bots (when implemented)

| ID | Feature | Steps | Result |
|----|---------|-------|--------|
| B-01 | **B1 outbound** | Run outbound bot; message visible in group (operator env) | `[ ]` |
| B-02 | **B2 inbound keyword** | Trigger keyword → bot reply in group | `[ ]` |
| B-03 | **B2 mention** | @bot mention → reply | `[ ]` |
| B-04 | **Steward disable** | Disable bot/trigger in manage hub → no further replies | `[ ]` |

B-01 optional if operator deferred. B-02–04 apply after Wave 2 ships.

---

## §4 — Trust / edge cases (spot-check)

Run only if you hit the symptom in daily use; full register in [known-issues queue](./v1.5.0-known-issues-and-investigation-queue.md).

| ID | Feature | Steps | Result |
|----|---------|-------|--------|
| T-01 | **Profile switch isolation** | A/B same process; A community state not visible in B | `[ ]` |
| T-02 | **Leave outbox** | Leave with relay offline → later flush; stay left | `[ ]` |
| T-03 | **Invite terminal (declined)** | Inviter state clears after decline | `[ ]` |
| T-04 | **Delete for me (honest)** | Delete DM messages → refresh; **document** if they return (accepted limitation) | `[ ]` |

---

## §5 — Mobile shell

**Status:** **Postponed** (2026-06-01) — desktop is primary until wrap-up; APK build path verified, Tier 1 manual deferred.  
**Canonical P1 install smoke:** [android-p1-smoke-checklist.md](./android-p1-smoke-checklist.md) (Tier 0–1 + session record).  
**Fast path:** `pnpm dev:mobile-shell:online` + device toolbar (layout only — not native Tier 1).  
**Install path (wrap-up):** `pnpm p12:android-smoke -- --build --wait-device=180` — start AVD or connect USB **before** running

| ID | Feature | Steps | Result |
|----|---------|-------|--------|
| M-01 | **Auth + unlock** | Reach main shell; no permanent error boundary | `[ ]` |
| M-02 | **Tab bar** | Chats ↔ Settings; tab bar visible on list, hidden in thread | `[ ]` |
| M-03 | **Touch scroll — list** | Pan conversation list without dragging scrollbar | `[ ]` |
| M-04 | **Touch scroll — thread** | Pan message list; pull-to-refresh does not steal scroll | `[ ]` |
| M-05 | **Thread back** | Back returns to list | `[ ]` |
| M-06 | **Title consistency** | Header title matches peer name (not “Unknown contact”) | `[ ]` — uses hint + metadata |
| M-07 | **Restore banners** | First login: status not eating entire viewport (after P13-a) | `[ ]` — single collapsible strip |
| M-08 | **Safe area** | Header/tab bar not clipped by notch/gesture nav | `[ ]` |
| M-09 | **One DM path** | Open thread, send/receive one message | `[ ]` |
| M-10 | **FAB overlap** | No dev FAB over relay footer on production mobile shell | `[ ]` |

Ref: [mobile-ux-audit.md](../assets/demo/v1.8.12/mobile-ux-audit.md)

---

## §6 — Coordination / kernel prep (optional)

| ID | Feature | Steps | Result |
|----|---------|-------|--------|
| K-01 | **Coordination health** | `curl http://127.0.0.1:8787/health` → ok | `[-]` skipped 2026-06-01 |
| K-02 | **Membership directory** | Two profiles; roster matches coordination (K-M1/K-M2) | `[-]` skipped 2026-06-01 |

Ref: [v1.9.0 demo](../assets/demo/v1.9.0/README.md)

---

## §7 — Release / install (when publishing)

Run once before tagging a user-visible release — not on every commit.

| ID | Feature | Steps | Result |
|----|---------|-------|--------|
| R-01 | **Version in About** | Installed build shows expected semver | `[ ]` |
| R-02 | **Desktop asset filenames** | GitHub assets match tag (e.g. `Obscur_1.8.x_*`) | `[ ]` |
| R-03 | **Android APK/AAB names** | Mobile artifacts match tag | `[ ]` |
| R-04 | **One desktop install smoke** | Install MSI/DMG/AppImage; app launches | `[ ]` |
| R-05 | **CI Full Release verify** | Obscur Full Release verify-artifacts green | `[ ]` |

---

## Session record (optional)

Copy when you finish a pass:

```text
Date (UTC):
Build: git SHA / tag / dev:desktop:online
Sections run: §1 §5 …
Passed: D-01 D-02 …
Failed: …
Blocked: C-03 (no relay) …
Notes:
```

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-29 | Initial consolidated checklist — batch lane; defers per-version demo matrices |
