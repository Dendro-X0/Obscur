# Demo Segment I — Communities · create & use group chat (v1.9.16)

**Status:** Ready to record · **CU-UX-2** enables live Quick group on Quiet public relays (packaged) · GIF stitch still OK  
**Continues from:** Segments G–H on packaged exe  
**Tone:** Calm · moderate pace · short lines · one honest infra caveat early  
**Budget:** **~75–100 s** with VO · keep trim under ~110 s  
**Output:** `demo_09_community_group_chat_v1.9.16.mp4` → stitch after Segment H

**Window plan (live only):** Film **DemoUser** for create + invite + first send · cut to **Tester2** for accept + receive.

**Covers:** Managed Workspace create · invite → accept · sealed group send/receive · Docker-vs-VPS honesty.

**Not in this segment:** VPS provisioning walkthrough · public-relay-hosted communities · bots · leave/rejoin · roster parity claims · Tor · voice in groups · Vault.

**Companion:** [private-trust-local-setup.md](../private-trust-local-setup.md) · [group-chat-gif-shot-list.md](./group-chat-gif-shot-list.md) · assets under [`docs/assets/gifs/`](../../gifs/)

---

## Recommendation (2026-08-21)

**Use Path A (GIF stitch) for Part 9.** Packaged production builds keep the Quiet public DM pool on and **leave lab/Docker nodes disabled by design** until you manually add `ws://localhost:7000`. That is intentional product posture (private/intranet relays stay off so they do not poison DM dial) — not a broken Docker install.

Your metrics card showing **`http://127.0.0.1:8788` DISABLED** is the **HTTP mesh gateway preset**, not the Docker Nostr relay. Chat needs **`ws://localhost:7000`**. Right now Docker **is** listening on `:7000`; `:8788` is not.

| Path | When | Result |
|------|------|--------|
| **A — GIF stitch** | Default for Part 9 | Same create → invite → chat story; VO covers Docker demo + VPS for production |
| **B — Live packaged** | Only if you want a fresh exe take | Manually enable `ws://localhost:7000` (steps below) · then film create/invite/chat |

---

## Path A — GIF / MP4 stitch (preferred)

Assets already on disk (dev / private-trust captures):

| Beat | GIF | Prefer for edit (smoother) |
|------|-----|----------------------------|
| Create Managed Workspace | [`group_create_managed_workspace_1.gif`](../../gifs/group_create_managed_workspace_1.gif) | [`web/group_create_managed_workspace_1.mp4`](../../gifs/web/group_create_managed_workspace_1.mp4) |
| Invite + accept | [`group_invite_member_1.gif`](../../gifs/group_invite_member_1.gif) | [`web/group_invite_member_1.mp4`](../../gifs/web/group_invite_member_1.mp4) |
| Send / receive | [`community_group_send_receive_1.gif`](../../gifs/community_group_send_receive_1.gif) | [`web/community_group_send_receive_1.mp4`](../../gifs/web/community_group_send_receive_1.mp4) |
| Optional participants | [`group_participants_settings_1.gif`](../../gifs/group_participants_settings_1.gif) | [`web/group_participants_settings_1.mp4`](../../gifs/web/group_participants_settings_1.mp4) |

**VO order:** infra honesty → create → invite → chat → close (same lines as Path B shots 1–5).

**Say once:** “These beats were recorded on the local Docker private-trust stack used for development. The packaged messenger you saw earlier uses public relays for DMs; group workspaces need a trusted team relay — Docker here for the demo, a VPS or dedicated pool for production.”

Do **not** claim the GIF UI chrome matches every pixel of the current packaged Relays tab.

---

## Path B — Live packaged (optional)

### Why create shows “No enabled relays”

Managed Workspace only lists **enabled non-public** community candidates. Public Quiet relays (primal / nos / damus) are **excluded**. A disabled `http://127.0.0.1:8788` entry does **not** count (wrong URL + disabled + not `ws://` Nostr).

### Fix before rolling camera

1. Confirm Docker Nostr: `docker ps` shows relay on **`7000→8080`** · `curl http://127.0.0.1:7000/` returns any HTTP code.  
2. Coordination still up: `http://127.0.0.1:8787/health`.  
3. Packaged exe → **Settings → Relays** → **Add** `ws://localhost:7000` (not `8788`, not bare `127.0.0.1`).  
4. **Enable** that row · wait until Connected (or healthy probe).  
5. Optional: Operator setup → workspace relay `ws://localhost:7000` · trust local coordination · Apply bundle.  
6. Reopen **Create New Group** → SELECT should list `localhost:7000` · Create enabled.

If the lab bootstrap owner turns `:7000` off again after public remotes stay enabled, re-enable `:7000` once more before create — that adaptive disable is expected when Quiet remotes are on.

---

## Story arc

Communities need a **trusted workspace relay** and a **membership directory** — not the public Quiet DM pool. Show create → invite → chat. Say clearly: Docker is for the demonstration; long-term production should use a VPS or dedicated server pool.

---

## Infra honesty (required VO)

| Say | Do **not** say |
|-----|----------------|
| “For this demo we use a **Docker** Nostr relay — the same stack we use in development.” | “Docker is how you should run Obscur in production.” |
| “For reliable day-to-day operation, prefer a **VPS** or dedicated server pool with `wss://` and HTTPS coordination.” | “Anyone can safely expose localhost:7000 to the internet.” |
| “This segment is only about **creating and using** group chat.” | Full operator HA / multi-region story |

Production contrast: coordination → **`https://`** · workspace relay → **`wss://`**. Local demo: `http://127.0.0.1:8787` + `ws://localhost:7000`.

---

## Prereq (Path B only)

| # | Check |
|---|--------|
| 1 | Packaged release exe · Tor OFF |
| 2 | Docker Desktop · `infra-nostr-relay` on **:7000** (not :8788) |
| 3 | `pnpm dev:coordination` · health on **:8787** |
| 4 | Relays: **`ws://localhost:7000` enabled** · Connected |
| 5 | DemoUser + Tester2 · two windows |
| 6 | Operator trust local if create still blocked |
| 7 | Fresh name e.g. `DemoGroup-0821` |

**Stop when done:** Ctrl+C coordination · `pnpm dev:relay:down`

---

## Shot list + voiceover (Path B live · same VO for Path A over GIFs)

### 1 — Set the scene

| VO |
|----|
| Next — communities. |
| Group chat needs a workspace relay and membership sync — not the public DM pool. |
| This demo uses a Docker relay; for production, use a VPS or dedicated pool. |

≈ 10–14 s.

### 2 — Create Managed Workspace

| VO |
|----|
| Create a managed workspace on the trusted workspace relay. |
| Public relays cannot host this mode. |

≈ 18–22 s.

### 3 — Invite Tester2

| VO |
|----|
| Invite the second profile from the community. |
| Accept on Tester2 — membership joins through coordination. |

≈ 18–22 s.

### 4 — Sealed send / receive

| VO |
|----|
| Both open the group — encrypted chat on the workspace relay. |
| One message is enough to prove create and use. |

≈ 15–20 s.

### 5 — Close

| VO |
|----|
| That’s create and configure for group chat — Docker for the demo; VPS or a dedicated pool when you run it for real. |

≈ 5–7 s.

---

## Pass / fail

| Pass | Fail |
|------|------|
| VO states Docker-for-demo + VPS/pool for production | Viewer thinks Docker is the production recommendation |
| Create → invite → one message visible (live or GIF) | Claiming packaged Quiet relays host Managed Workspace |
| Path B uses `ws://localhost:7000` enabled | Relying on disabled `http://127.0.0.1:8788` |

---

## After record

1. Mark **Status:** Recorded · Path A or B · date.  
2. Optional stills → `evidence/P9-group-<date>.png`.  
3. Stitch as Part 9 after Segment H.

---

## Troubleshooting (Path B)

| Symptom | Fix |
|---------|-----|
| SELECT: “No enabled relays” | Add/enable **`ws://localhost:7000`** — public Quiet relays do not appear here |
| Metrics shows `8788` DISABLED | Ignore for group create — enable **`:7000`** instead |
| `:7000` Disconnected | `pnpm dev:relay:docker` · Docker running |
| Create blocked / coordination | Operator setup → trust local · Apply bundle |
| Lab assist re-disables `:7000` | Re-enable after Quiet remotes settle · then open Create |

Full matrix: [private-trust-local-setup.md](../private-trust-local-setup.md).
