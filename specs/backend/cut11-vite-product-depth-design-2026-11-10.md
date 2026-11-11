# Design — Cut 11 Vite product-depth (identity bootstrap + home session)

**Date:** 2026-11-10  
**Status:** **CLOSED** (2026-11-10) · **11.0–11.5 L1 + checklist** · Continuity Pass still not claimed  
**Parents:** Cuts 3–10 · [rewrite-replacement-posture-2026-11-09.md](./rewrite-replacement-posture-2026-11-09.md)

```text
HANDOFF ATOMIC STEP: Cut 11 Vite product-depth (user GO after Cut 10 CLOSED)
PAUSED / CANCELLED: Soft L3 Fixed · Tor Verified · Matrix promote · Continuity Pass · M5 linked devices
CANONICAL OWNER:     apps/desktop-ui AuthDoor · PrivateHomeSessionDoor · vite identity/home session
PROOF BEFORE DONE:   per-slice L1; ≠ Continuity Pass · ≠ Soft L3
SURFACE:             Create passphrase identity · configure private home · product honesty copy
ACK 11.0:            2026-11-10 — proceed 11.1 (user GO; Soft L3 stays paused)
```

## 1. Why this cut

Vite is the production desktop face (Cut 5), Continuity M1–M4 landed (Cuts 7–10), but the shell still reads as a **lab unlock** against a hard-coded expected pubkey and has **no UI to create identity or set private-home URL** (M2 Continuity / H-dc fail closed without env).

| Residue | As-built | Why unviable |
|---------|----------|--------------|
| **K-LAB-AUTH-COPY** | “Vite lab auth door” · lab meta | Production face honesty gap |
| **K-NO-CREATE** | Unlock only; empty device stuck / LAB pubkey fallback | Cannot onboard on Vite alone |
| **K-NO-HOME-UI** | Home session env/localStorage only | Continuity M2 / H-dc unusable without operator CLI |

**Not this cut:** Soft L3 Fixed · Continuity Pass · M5 · Next wipe · Tor Verified · Matrix promote · full Settings parity.

## 2. Goal

1. **Create account** on AuthDoor when no local identity (passphrase → generate + encrypt + store).  
2. **Private home session door** — save baseUrl (+ optional bearer) for Continuity M2 / H-dc.  
3. **Product honesty copy** — Soft L3 paused · Continuity Pass not claimed; drop “lab auth door” on production face.  
4. Soft L3 / Tor / Matrix stay **paused**.

## 3. Deliver (slices)

| Slice | Deliver | Proof |
|-------|---------|-------|
| **11.0** | This design **ACK** | GO ACK · **DONE 2026-11-10** |
| **11.1** | Vite identity create + write helpers | L1 · **DONE** (`verify:cut11-1`) |
| **11.2** | AuthDoor create/unlock product face | L1 · **DONE** (`verify:cut11-2`) |
| **11.3** | writeVitePrivateDcSession + PrivateHomeSessionDoor | L1 · **DONE** (`verify:cut11-3`) |
| **11.4** | Wire PrivateTrustHome + App honesty | L1 · **DONE** (`verify:cut11-4`) |
| **11.5** | Lab checklist · **≠ Continuity Pass** | Soak · **DONE** (`verify:cut11-5`) |

## 4. Law

```text
1. Empty device → Create account (Plane 1–2), not Continuity invent.
2. Private home config is transport/home session — not Continuity Pass.
3. Soft L3 remains paused; Continuity Pass not claimed.
4. No apps/pwa feature imports into desktop-ui.
5. Unlock still ≠ Continuity.
```

## 5. Non-goals

- Soft L3 Fixed / dual CDP  
- Continuity Pass promote  
- M5 linked devices  
- Full Next Settings surface  

## 6. Proof plan

| Layer | Cut 11 “done” |
|-------|----------------|
| **L1** | Identity create · AuthDoor · home session · wire contracts |
| **L2** | Optional operator create→unlock→home save soak |
| **L3+** | Deferred |

## 7. References

- AuthDoor — `apps/desktop-ui/src/auth/AuthDoor.tsx`  
- Vite identity — `vite-passphrase-device-unlock.ts`  
- Home session — `vite-private-dc-session.ts`  
