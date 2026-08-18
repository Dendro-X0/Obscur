# Demo Segment D — Discovery · npub · friend code · contact request (v1.9.16)

**Status:** Ready to record · requires **contact-request handshake fix build** · follows Segment C · **Tor OFF**  
**Continues from:** Unlocked **empty-roster** DemoUser (no contacts)  
**Tone:** Calm · moderate pace · short lines  
**Budget:** **~90–150 s** with VO · full video still **&lt; 10 min**  
**Output:** `demo_04_discovery_add_contact_v1.9.16.mp4` → stitch after Segment C

**Nav:** Sidebar **Search** (`/search`) → title **Discovery** → tab **Add Friend**.  
**Friend code source (off camera):** Tester2 → Settings → **Profile** → **Friend Code** (`OBSCUR-……`).  
**npub source (off camera):** Tester2 → Settings → **Identity** (public npub only).

**Covers:** How a new account finds people — **npub** (always) and **friend code** `OBSCUR-XXXXXX` (after alias publish) — then **Send Invitation**. Private keys never go in Discovery.

**Not in this segment:** Accepting the request on Tester2 (optional — show Tester2 accepting in a take 2 if desired) · group join · Tor ON · multi-profile (Segment E) · DM (Segment F).

**Handshake honesty:** After Send Invitation, DemoUser's Network stays **empty** until Tester2 accepts. That is the correct two-way handshake behavior — do not skip or edit around this; it is the product truth to show.

**Tor:** **OFF**. Clearnet relays open.

---

## Story arc

You don't need a shared address book. Paste a public npub or a short friend code; Obscur resolves **one** person. Your private key never belongs in the search box.

---

## Prereq (two profiles)

| # | Check |
|---|--------|
| 1 | **Release exe built after 2026-08-18** — must include contact-request handshake fix · old builds auto-trust on send — do **not** record on pre-fix binary |
| 2 | **DemoUser** — empty contacts · Tor OFF · Relays ≥1 open |
| 3 | **Tester2** (or second window) — profile **saved/published** so kind 0 + friend-code alias are on the same public pool |
| 4 | Off camera: copy Tester2 **npub** and **Friend Code** (`OBSCUR-……`) from Profile / Identity — do not film Tester2's private key |
| 5 | Capture **DemoUser** window only for the main take |

**Honesty:** If this build is **older than the alias slice**, friend-code search can fail on public relays. Then film **npub only** and say the short code is the same idea once published. Do not paste nsec.

---

## Shot list + voiceover

### 1 — Empty network (DemoUser)

**On screen:** Chats / Network empty.

| VO |
|----|
| New account — no contacts yet. |
| Discovery is how you find someone you already know. |

≈ 6–8 s.

---

### 2 — Open Discovery · Add Friend

**On screen:** Discovery · tab **ADD FRIEND** · Safe Mode visible.

| VO |
|----|
| Add Friend is exact match — not a public people directory. |
| Private keys do not belong here. |

≈ 8 s.

---

### 3 — Resolve by npub

**On screen:** Paste Tester2 npub · Search · Exact Match card (name · fingerprint · Send Invitation). **Do not** click Send yet if you will also show friend code.

| VO |
|----|
| An npub is their public identity. |
| Confirm the fingerprint matches who you expect — display names can be copied. |

≈ 12–15 s.

---

### 4 — Resolve by friend code

**On screen:** Clear · paste `OBSCUR-……` · Search · same person.

| VO |
|----|
| A friend code is a short alias they can change. |
| It still resolves to that same public identity — not their private key. |

≈ 10–12 s.

**If resolve fails:** skip this shot; do not improvise "the network is down." npub take already proved discovery.

---

### 5 — Send invitation

**On screen:** **Send Invitation** · request delivered state · Network tab stays **empty** — no TRUSTED badge appears yet.

| VO |
|----|
| That's a contact request — they still have to accept. |
| Until they do, they don't appear in your contacts. |

≈ 6–8 s.

**Camera note:** Network must show **no new contact** after sending — this is the correct fixed behavior. If the peer appears as TRUSTED immediately, stop and rebuild from the post-2026-08-18 binary before recording.

---

### 6 — Close

**On screen:** Discovery or request pending state.

| VO |
|----|
| Public identity you can share. |
| Private key you never search. |

≈ 4–6 s.

---

## Full read-through

> New account — no contacts yet.  
> Discovery is how you find someone you already know.  
> Add Friend is exact match — not a public people directory.  
> Private keys do not belong here.  
> An npub is their public identity.  
> Confirm the fingerprint matches who you expect — display names can be copied.  
> A friend code is a short alias they can change.  
> It still resolves to that same public identity — not their private key.  
> That's a contact request — they still have to accept.  
> Until they do, they don't appear in your contacts.  
> Public identity you can share. Private key you never search.

---

## Do not say / show

| Avoid | Why |
|-------|-----|
| Paste nsec / hex private key | Product forbids it; looks like a backdoor |
| "Anyone can browse all Obscur users" | Discovery is token-based, not a global directory |
| Enable Tor | Segment C honesty: optional, env-blocked here |
| Claim friend codes are anonymous | They map to a public npub |
| Claim contact appears immediately after Send | Pre-fix behavior — must use post-2026-08-18 build |

---

## Pass when

1. Empty account can open Discovery.  
2. **npub** resolves one person.  
3. **Friend code** resolves the same person **or** is honestly skipped with alias not yet on this build.  
4. Send Invitation is the add action.  
5. After sending, Network stays empty — **no auto-trust** — peer appears only after they accept.  
6. Private key is never used as a search token.

---

## Stitch

| # | File | Topic |
|---|------|--------|
| A | `demo_01_…` | Site · install (~45 s) |
| B | `demo_02_…` | Create · lock (~52 s) |
| C | `demo_03_…` | Relays · E2EE · Tor off |
| D | `demo_04_discovery_add_contact_v1.9.16.mp4` | Discovery · add · pending state |
| E | [segment-e-multi-profile-v1.9.16.md](./segment-e-multi-profile-v1.9.16.md) | Second profile window · Tester2 sign-in |
| F | [segment-f-accept-dm-v1.9.16.md](./segment-f-accept-dm-v1.9.16.md) | Accept request · DM |
