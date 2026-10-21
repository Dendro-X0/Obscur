# Demo Segment J — Data portability · custom data path (v1.9.16)

**Status:** Ready to record · **final segment** · follows Segment I (communities)  
**Continues from:** **DemoUser** unlocked on packaged **v2.0.0-beta** exe (`shell-2026-08-23T17:15:41Z` or newer)  
**Tone:** Calm · moderate pace · closing beat — ownership, not cloud rental  
**Budget:** **~60–90 s** with VO · keep total stitched demo **≤ ~11 min** (ten segments is enough)  
**Output:** `demo_10_data_portability_v1.9.16.mp4` → stitch last

**Covers:** Customizable Obscur data folder · export encrypted account backup · import preflight · profile-scoped portability · where files land on disk.

**Not in this segment:** Full data-folder migration with restart mid-take · relay/coordination export · Tor · nsec plaintext export (separate dangerous flow under Identity → Advanced).

---

## Story arc

Obscur is local-first: your messages, profiles, and vault live on **your** disk. You choose the folder, export an encrypted backup, and import it elsewhere — same machine or another — without a central account server.

Close the demo: *you own the stack and the bytes*.

---

## Prereq

| # | Check |
|---|--------|
| 1 | Packaged exe rebuilt after UI work (member list, Esc, relay save) — stamp in `apps/pwa/out/obscur-shell-manifest.json` |
| 2 | **DemoUser** unlocked · Tor OFF · coordination optional (not needed for this segment) |
| 3 | Know current data path: **Settings → Storage → Data location** (read-only on camera is OK) |
| 4 | Exports folder empty or note one prior export — export creates a new timestamped file |
| 5 | Off-camera dry-run: **Settings → Identity → Export backup** → Explorer opens on `.obscur-account-export` / `.json` file |
| 6 | Optional second profile window for import proof — **not required** if time-tight; preflight dialog alone is enough |

---

## Reliability gate (maintainer — 2026-08-22)

| Area | Verdict | Evidence |
|------|---------|----------|
| Unified export → data-root `exports/` | **Green** | `portability-tier1.test.ts` · `data-root-export-service` native write |
| Import preflight (match / mismatch / invalid) | **Green** | `portability-import-preflight.test.ts` (3 tests) |
| Data-root path resolution / reconnect UI | **Green** | `obscur-data-root-path-resolution.test.ts` · `data-root-unavailable-recovery.test.tsx` |
| Storage resilience contract | **Green** | `storage-resilience-v1.9.9.contract.test.ts` |
| Full backup restore merge edge cases | **Yellow** | `encrypted-account-backup-service.test.ts` has unrelated failing rows — do not claim “every restore path verified on camera” |
| Delete-for-me after restore | **Honest limit** | ACC-01 — say “backup restores account data”; don’t promise delete-for-me survives restore |

**Recording-safe path:** Export + show file location + scroll Storage paths + open Import → preflight → cancel (or import into **Tester2** window off the main narrative).

---

## Navigation map (on-screen)

| Beat | Path | Action |
|------|------|--------|
| Data ownership | **Settings → Storage** | Scroll **Obscur data folder** — show **Data location**, **Exports**, **Archives**, **Vault** paths |
| Custom path (visual only) | Same card | Point at **Change folder** / **Reconnect** — **do not complete** unless rehearsed restart |
| Quick backup | **Settings → Identity** | **Export backup** → toast + Explorer reveal |
| Import UX | **Settings → Identity** | **Import backup** → file picker → **preflight** dialog (review → cancel or proceed on Tester2) |
| Advanced (optional 5 s) | **Settings → Profile** → scroll | **Manual portability** manifest preview · naming preset |
| Alt entry | **Manage Profiles** (`/profiles`) | Same quick actions panel when unlocked |

---

## Shot list + voiceover

### 1 — Local-first framing (DemoUser · Settings open)

**On screen:** Settings sidebar · land **Storage**.

| VO |
|----|
| Everything Obscur stores locally — profiles, SQLite, vault, exports. |
| You pick where those bytes live; nothing requires our cloud. |

≈ 8–10 s.

---

### 2 — Custom data path

**On screen:** **Obscur data folder** card · highlight **Data location** · **Exports** · **Archives** · **Vault** lines (monospace paths).

| VO |
|----|
| Under Storage, the data folder is yours — move it to another drive, a synced folder, or portable media. |
| Changing the folder restarts the app; Obscur copies or reconnects to what’s already there. |

≈ 12–15 s.

**Do not** complete migration on camera unless you rehearsed the restart cut.

---

### 3 — Export encrypted backup

**On screen:** **Settings → Identity** · **Portability** quick actions · click **Export backup** · success banner · Explorer opens on export file.

| VO |
|----|
| Export backup writes an encrypted bundle — chats, contacts, communities, settings — not a plaintext private key. |
| It lands in your Obscur exports folder; you can copy that file anywhere. |

≈ 15–18 s.

---

### 4 — Import + preflight (light touch)

**On screen:** **Import backup** · pick the file you just exported (or a staged file) · **preflight** dialog — account match, scope list · **Cancel** (or switch to Tester2 window if doing full proof off-voice).

| VO |
|----|
| Import runs through a preflight check — same account, wrong account, or workspace scope — before anything merges. |
| That’s how you move a profile between folders or machines without guessing. |

≈ 12–15 s.

---

### 5 — Close (title card or shell)

**On screen:** Return to main shell or static end card · optional `/download` lower-third.

| VO |
|----|
| Obscur is a stack you deploy and a data folder you control. |
| Verify the installer hash, run your relay, export when you need portability — thanks for watching. |

≈ 8–10 s.

---

## Full read-through (~75 s)

> Everything Obscur stores lives on your machine — profiles, database, vault, exports.  
> You choose the folder; there’s no required cloud account.  
> In Storage, the data path is customizable — move it to another drive or portable disk; the app restarts after a move.  
> Export backup creates an encrypted bundle with your chats, contacts, and settings — saved under exports, ready to copy.  
> Import shows a preflight review so you know what account and scope you’re merging before anything applies.  
> You own the infrastructure and the files — verify downloads, run your relay, export when you need to move. Thanks for watching.

---

## Do not say / show

| Avoid | Why |
|-------|-----|
| “Cloud sync built in” | Not product truth |
| Export plaintext nsec in same breath as backup | Different flow · dangerous |
| Complete data-folder migration without restart plan | Breaks recording session |
| “Restore always perfect” / delete-for-me survives restore | ACC-01 |
| “Import any random JSON” | Preflight rejects invalid bundles |
| Add an 11th segment | User cap ~10 min total — **J closes the arc** |

---

## Pass when

1. Viewer sees **Storage → data location + exports path**.  
2. Viewer sees **Identity → Export backup** with file revealed.  
3. Viewer sees **Import preflight** (even if cancelled).  
4. VO states **local-first + customizable path + encrypted export** without over-claiming restore edge cases.  
5. Total program stays **~10–11 min** with Segments A–J.

---

## Stitch order (final)

| # | File | Topic |
|---|------|--------|
| … | … | A–I per existing briefs |
| J | `demo_10_data_portability_v1.9.16.mp4` | Data path · export · import preflight · close |

---

## Editor note

If Segment J runs long, trim **Manual portability** (Profile tab) and **Manage Profiles** sidebar — Storage + Identity quick actions are sufficient for the portability story.
