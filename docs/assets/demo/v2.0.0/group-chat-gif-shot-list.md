# Group chat GIF shot list — v1.9.10 (Docker relay demo)

**Parent:** [gif-inventory.md](./gif-inventory.md) · [private-trust-local-setup.md](../private-trust-local-setup.md)  
**Audience:** Maintainer screen recording (ShareX / ScreenToGif)  
**Last updated:** 2026-07-10

---

## Goal

Demonstrate **managed workspace** group chat on a **local private-trust stack** (coordination + Docker Nostr relay) — no VPS required. Split into **short GIFs** (8–15 s each) rather than one long capture.

**Honest limits in voiceover or caption:**

- Roster may differ between profiles (ACC-02 accepted).
- Sidebar preview may lag thread (R3 fixed for common paths — mention if visible).
- Demo uses `ws://localhost:7000` — production uses team `wss://` relay.

---

## Pre-flight (before any group GIF)

| # | Terminal / step | Pass when |
|---|-----------------|-----------|
| 1 | Docker Desktop running | `docker ps` works |
| 2 | `pnpm dev:coordination` | `curl http://127.0.0.1:8787/health` → ok |
| 3 | `pnpm dev:relay:docker` | `curl http://127.0.0.1:7000` → any response (426/400 OK) |
| 4 | `pnpm dev:desktop:no-coord -- --rebuild` | Static shell current · CDP `:9230` |
| 5 | `.env.local` from `apps/pwa/.env.example` | `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` |
| 6 | Two profiles ready | Tester1 (`:9230`) · Tester2 (second window `:9231` or profile switch) |
| 7 | Fresh workspace name | e.g. `DemoGroup-<MMDD>` — avoid stale NewTest roster |

**Purge stale workspace (optional):** Obscur quit → `pnpm purge:workspace --match DemoGroup`

---

## Recommended GIF sequence (group suite)

Record in order — later steps depend on workspace from earlier steps.

### G1 — `group_relay_setup_1.gif` (Settings → Relays)

| Beat | Action | Frame must show |
|------|--------|-----------------|
| 1 | Settings → **Relays** | Relay list visible |
| 2 | `ws://localhost:7000` **Connected** | Badge green / active count |
| 3 | Public relays **disabled** | nos.lol / damus off |
| 4 | Coordination URL visible | `127.0.0.1:8787` or env URL |

**Reuses existing asset?** Partial overlap with `relay_overview_1.gif` + `relay_enable_disable_1.gif` — keep separate **group-context** cut if this GIF opens the group demo reel.

---

### G2 — `group_create_managed_workspace_1.gif` (Create group)

| Beat | Action | Frame must show |
|------|--------|-----------------|
| 1 | Network / Chats → **Create group** | Create dialog open |
| 2 | Host: `127.0.0.1` or `localhost:7000` | **Connected** in host picker — not Disconnected |
| 3 | Mode: **Managed Workspace** | Only option selected |
| 4 | Name + Create | Success · group appears in list |

**Fail if:** Create disabled → coordination down, relay disconnected, or public relay selected.

---

### G3 — `group_invite_member_1.gif` (Invite flow)

| Beat | Action | Frame must show |
|------|--------|-----------------|
| 1 | Tester1 opens new group home | Community / group chrome |
| 2 | **Invite** → select Tester2 | Invite sent toast |
| 3 | Cut to Tester2 DM | Invite message visible |
| 4 | Tester2 **Accept** | Trust gate passes (no red coordination banner) |

**Dual-window:** Record Tester1 invite, then switch window for accept — or two short clips merged in editor.

---

### G4 — `community_group_send_receive_1.gif` (P0 — chat proof)

| Beat | Action | Frame must show |
|------|--------|-----------------|
| 1 | Both open same group thread | Compose enabled — **no** “Room key missing” |
| 2 | Tester1 sends `demo-<timestamp>` | Bubble in T1 thread |
| 3 | Tester2 thread | Same message visible |
| 4 | Optional: sidebar preview | OK if laggy — do not hide |

**This is the primary website “Communities” card target.**

---

### G5 — `group_participants_settings_1.gif` (Participants + group settings)

| Beat | Action | Frame must show |
|------|--------|-----------------|
| 1 | Open **Participants** | Both testers listed active |
| 2 | Group settings / membership panel | Roles, relay host, reconcile button |
| 3 | Voiceover ACC-02 | “Roster display may differ on another profile — see limitations.” |

---

## Single-GIF alternative (if time-constrained)

Combine G2→G4 into one **`community_group_full_flow_1.gif`** (≤20 s, ≤30 MB). Prefer **split GIFs** for website gallery granularity.

---

## File hygiene

| Rule | Detail |
|------|--------|
| Path | `docs/assets/gifs/<name>_1.gif` |
| Extension | **`.gif` only** — rename any `*.gif.gif` exports |
| Overwrite | Replace April v1.3.15 files when v1.9.10 capture is better |
| Register | Update [gif-inventory.md](./gif-inventory.md) row · set **Freshness: v1.9.10** |

---

## After capture

1. Add rows to `gif-inventory.md` § v1.9.10 library.
2. Update [README.md](../../../../README.md) § Communities with `community_group_send_receive_1.gif`.
3. When Phase 4 deploy unpauses: `apps/website/src/app/site-content.ts` feature cards.
4. Optional PNG stills → `docs/assets/demo/v2.0.0/evidence/P5-group-<date>.png`

---

## Troubleshooting (quick)

| Symptom | Fix |
|---------|-----|
| `localhost:7000` Disconnected | `pnpm dev:relay:docker` · Docker running |
| Create blocked | Coordination health · `db:migrate` if D1 schema missing |
| Join / publish failed | Restart desktop after rebuild · check `.env.local` |
| UI shows old language labels | Static shell stale → `--rebuild` (see static-shell-stale) |
