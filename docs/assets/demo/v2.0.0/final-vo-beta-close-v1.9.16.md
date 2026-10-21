# Final VO + open-beta close — v1.9.16 showcase (9:41 master)

**Status:** Post-edit finalization · **Beta build:** `shell-2026-08-23T17:15:41Z`  
**Master:** Trimmed timeline **00:09:41.467** (Shotcut or equivalent)  
**Deliverable:** Narrated MP4 for website hero (`apps/website/public/hero-media/showcase.mp4`)  
**Pairs with:** Segment briefs A–J · [v2.0.0-beta-release.md](../../../releases/v2.0.0-beta-release.md) · [obscur-v2-known-limitations.md](../../../program/obscur-v2-known-limitations.md)

---

## Editor workflow (mute + VO)

1. **Mute source audio** — Disable or set gain to **−∞** on every clip’s original audio track (UI clicks, mic bleed, room tone).
2. **Add one narration track** — Single VO lane under the picture; normalize to **−16 LUFS** integrated (or −14 if the site player is quiet); peak ≤ **−1 dBTP**.
3. **Record or import VO** — Match the trimmed cut; use segment briefs for section wording where clips still align.
4. **Do not duck under silence** — Cut VO tight to visuals; 0.3–0.5 s pause between major beats is enough.
5. **Append beta close** — See below (~12–18 s VO + 3–5 s hold on end card → **~10:00–10:05** total is ideal for hero).
6. **Export**
   - **Video:** H.264 · 1920×1080 or source resolution · **~8–12 Mbps** · yuv420p  
   - **Audio:** AAC **192 kbps** · 48 kHz · stereo or mono  
   - **Filename:** `showcase.mp4` → `apps/website/public/hero-media/showcase.mp4`  
   - Optional poster: `showcase.poster.jpg` (frame from end card or hero still)

Site resolver: `site-content.ts` prefers `hero-media/showcase.mp4` and sets `hasAudio: true` when present.

---

## End card — on-screen text (pick one layout)

**Title (large):**  
`Obscur — Open Beta`

**Body (2–3 lines):**  
`This build is an open beta. You may hit bugs and missing polish.`  
`We’re iterating quickly — feature depth and reliability will keep improving.`  
`Feedback welcome:`  
`github.com/Dendro-X0/Obscur`

**Footer (small):**  
`Verify installer SHA-256 · Known limitations on obscur.app/limitations`

**Visual:** Dark background matching app shell (`#0C0C0E`) · subtle purple accent · no motion required.

---

## Closing voiceover — recommended (~15 s)

Read after the last product beat (data portability / shell), over end card or fading app chrome:

> Obscur is in **open beta** — sovereign desktop software: your keys, E2EE, infra you choose.  
> Clearnet private-trust is the pitch; Tor is optional; we are not a dark-web messenger.  
> Voice is audio today — no video conference yet.  
> You may still hit bugs and rough edges. Verify your download, read the known limitations, and thanks for trying the stack.

**Pace:** Calm · ~95 wpm · not apologetic — factual and inviting.

---

## Closing voiceover — short (~8 s)

If you need to stay near **9:50** total:

> This is an **open beta** — expect bugs and ongoing improvements.  
> We welcome feedback on GitHub. Thanks for watching.

---

## Closing voiceover — with feedback CTA (~12 s)

> Obscur is **open beta** software: active development, honest limits, room to grow.  
> If something breaks or you want a feature, open an issue on GitHub — we read them.  
> Check the limitations page before you deploy for real. Thanks for watching.

---

## Links to show or mention (website copy alignment)

| Resource | URL |
|----------|-----|
| Download + checksums | `/download` |
| Known limitations | `/limitations` |
| GitHub issues (feedback) | `https://github.com/Dendro-X0/Obscur/issues` |
| Releases | `https://github.com/Dendro-X0/Obscur/releases` |

---

## Honesty guardrails (beta close)

**Say:** open beta · iterating · feedback welcome · verify hash · read limitations  

**Do not say:** “production-ready for everyone” · “bug-free” · “feature-complete” · Play Store / signed publisher (unless shipped)

---

## Pass when

1. No original timeline audio audible.  
2. VO levels consistent start to finish.  
3. Beta disclaimer VO + on-screen text in final **~12–20 s**.  
4. Total runtime **≤ ~10:30** (9:41 product + close).  
5. `showcase.mp4` plays with sound on site hero (user-initiated play).
