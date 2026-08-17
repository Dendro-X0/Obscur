# Demo Segment B — Create identity · Profile · lock / unlock (v1.9.16)

**Status:** Recording plan (maintainer) · follows Segment A (~45 s)  
**Continues from:** Welcome / auth card after install  
**Tone:** Calm · moderate pace · short lines (leave air between sentences)  
**Budget:** Target **~90–150 s** trimmed · full video still **&lt; 10 min**  
**Output:** `demo_02_create_identity_lock_v1.9.16.mp4` → stitch after Segment A

**Not in this segment:** DM · relays · Tor · multi-profile · restore / import · group chat.  
**Off-camera:** Saving the passphrase / private key to a password manager or paper — advise verbally; do **not** film the external store.

---

## Prereq

| # | Check |
|---|--------|
| 1 | Cold launch **v1.9.16** → welcome card (**Create New Identity** / Log In / Restore) |
| 2 | Window capture on **Obscur** only |
| 3 | Mic on · desktop audio muted |
| 4 | Know Settings paths: **Profile** (tour) · **Identity** (private key) · **Security → Lock Now** |
| 5 | Passphrase: use **Generate Code** on camera, **or** a compliant manual value (≥12 chars / ≥4 words) — never speak it |

---

## Shot list + voiceover

### 1 — Welcome hold

**On screen:** Auth welcome card (logo · Create New Identity · Log In with Key · Restore).

| VO |
|----|
| First launch — a local identity on this device. |
| Not a cloud account. |

≈ 6–8 s + 2 s hold.

---

### 2 — Username

**On screen:** **Create New Identity** → step “pick a name” → type a short username → **Continue**.

| VO |
|----|
| Display name is just a label on this machine. |

≈ 5–8 s.

---

### 3 — Password · strength · generator

**On screen:** Master password step.  
1. Type a weak short password briefly so the **strength meter** reacts (optional 2–3 s).  
2. Clear · click **Generate Code** · strength goes strong · confirm field fills.  
3. Toggle eye if you want viewers to see masked vs revealed once — **do not read it aloud**.  
4. Tick the acknowledgement checkbox · click **Generate Safe Identity** (or equivalent primary).

| VO |
|----|
| The passphrase unlocks this profile here. |
| There’s a strength check — and a generator if you want a strong code. |
| Store that passphrase somewhere safe offline — I won’t show that step. |

≈ 20–30 s on tape.

---

### 4 — Recovery honesty (private key)

**On screen (pick one):**  
- Amber warning copy on the create step (acknowledgement / recovery reminder), **and/or**  
- After you’re in the app: **Settings → Identity** · show **Private Key** area (copy/export controls visible — **do not paste the key into chat or leave it unmasked long**).

| VO |
|----|
| There is no email reset. |
| Your private key is the recovery path — store it like the passphrase, never share it. |

≈ 8–12 s. Prefer Identity tab **after** enter UI so create stays focused.

---

### 5 — Enter main shell

**On screen:** Create finishes · main shell (empty chats OK) · hold 2 s.

| VO |
|----|
| We’re in — this profile’s local workspace. |

≈ 4–6 s.

---

### 6 — Settings → Profile

**On screen:** Open **Settings** → **Profile** tab · pause so display name / profile fields are readable.

| VO |
|----|
| Profile settings — where this account’s public face lives. |

≈ 6–8 s. Keep it a tour, not a deep edit.

---

### 7 — Lock

**On screen:** Still in Settings → open **Security** → **Lock Now** (locks without signing out).  
If your UI also exposes lock from the shell chrome, either path is fine — **Lock Now** is the clear beat.

| VO |
|----|
| Lock when you step away — the account stays on the device. |

≈ 5–8 s.

---

### 8 — Unlock

**On screen:** Lock screen → enter the **same** passphrase (silent) → unlock → main shell or Settings again · hold 2 s · end.

| VO |
|----|
| Unlock with the passphrase we set. |
| Same local identity — no server login. |

≈ 8–12 s.

---

## Full read-through (copy card)

> First launch — a local identity on this device.  
> Not a cloud account.  
>  
> Display name is just a label on this machine.  
>  
> The passphrase unlocks this profile here.  
> There’s a strength check — and a generator if you want a strong code.  
> Store that passphrase somewhere safe offline — I won’t show that step.  
>  
> There is no email reset.  
> Your private key is the recovery path — store it like the passphrase, never share it.  
>  
> We’re in — this profile’s local workspace.  
>  
> Profile settings — where this account’s public face lives.  
>  
> Lock when you step away — the account stays on the device.  
>  
> Unlock with the passphrase we set.  
> Same local identity — no server login.

**Speech:** ~110 words · ~50–70 s spoken · with UI ≈ **90–150 s** trimmed.

---

## Do not say / do not show

| Avoid | Why |
|-------|-----|
| Reading passphrase or private key aloud | Recovery material on the recording |
| Leaving private key fully visible for long | Same |
| “Forgot password” / email recovery | Product has none |
| “Account on our servers” | Local identity |
| Filming password-manager save | You already planned off-camera — keep it VO-only |
| Tor / DM / relays | Later segments |

---

## Pass when

Viewer sees: **welcome → create (name + strength/generator) → recovery honesty → shell → Profile → Lock → Unlock**, and understands passphrase + private key are **self-custody**.

---

## After recording

1. Shotcut trim · target **~90–150 s**  
2. Note duration next to Segment A (~45 s)  
3. Optional next: clearnet shell / DM tour (Tor **OFF**)
