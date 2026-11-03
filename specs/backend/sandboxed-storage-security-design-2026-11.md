# Design — Sandboxed storage & hard profiles (2026-11)

**Status:** Design under rewrite band · **S1–S5 L1 · S2–S5 L3 Pass** · not a Tor Verified claim  
**Parent:** [platform-rewrite-band-charter-2026-11.md](./platform-rewrite-band-charter-2026-11.md)  
**Related as-built:** Media CAS · profile-scoped vault · PDK at-rest · desktop profile isolation · ASE (social-engineering) contract

```text
HANDOFF ATOMIC STEP: Security law sandboxed storage — S1–S5 landed (S2–S5 L3 Pass)
CANONICAL OWNER:     Storage plane (sandbox) · Profiles (isolation) · Shell (render policy)
PROOF:               Per-slice L1–L3; no “uncensorable / unbreachable” marketing
```

## 1. Goals (technical)

| Goal | Meaning | Non-goal |
|------|---------|----------|
| **Censorship / surveillance resistance** | Prefer private-trust / own infra + optional Tor transport; minimize metadata the app *must* leak; no phone-home identity | Claiming global uncensorability; Soft L3 / Tor Verified without proof |
| **Hard profiles** | Compromise of one profile’s keys/session must not freely read another; at-rest PDK; no plaintext cross-profile media/index | Stopping social engineering / shoulder-surfing / coerced unlock |
| **Sandboxed inbound files** | DM/group attachments never execute or freely touch the main app data root; quarantine → verify → explicit open | Scanning every file for “malware” like an AV product |

Social engineering remains a separate band ([antisocial-engineering-contract](../../docs/program/antisocial-engineering-contract.md)).

## 2. Threat model (inbound attachment)

Attacker sends a file (or link-as-file) in DM or group. Desired failures for the attacker:

1. **No automatic execution** (no shell open, no script in WebView from blob URL without policy).
2. **No write into profile DB / LES / key material paths** from attachment decode.
3. **No path traversal** into data-root or sibling profiles.
4. **Type confusion contained** — e.g. “image” that is HTML/SVG with script rendered only in a restricted surface or blocked.
5. **Explicit user consent** before “Open with system” / export out of quarantine.

Out of scope for v1 of this design: full OS app-container (Flatpak/Windows AppContainer) — note as P2+ hardening on desktop if Tauri allows.

## 3. Architecture

```text
Inbound message media
        │
        ▼
┌───────────────────┐
│ Descriptor + hash │  (CAS id — already as-built)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Quarantine store  │  profileId / quarantine / <sha256>
│  - no execute bit │
│  - no auto-open   │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Policy gate       │  allowlist MIME/extension · size · SVG/HTML deny-by-default
└─────────┬─────────┘
          ▼
┌───────────────────┐
│ Render sandbox    │  image/video via controlled components; no file:// to data-root
└─────────┬─────────┘
          ▼
    User “Save / Open externally” → copy out of quarantine with OS picker
```

**Profile hardness (storage):**

- One PDK / keychain entry per `profileId` (as-built direction).
- Quarantine + CAS paths **namespaced by profileId**; no shared world-writable inbound dir.
- Renderer never given absolute paths to other profiles’ roots.

## 4. As-built leverage

| Piece | Use |
|-------|-----|
| Media CAS (`getMediaStoreForProfile`) | Hash-addressed blobs already profile-scoped in memory |
| Vault / LES | Durable media — must not become execute surface |
| `desktop_storage_at_rest_*` | Encrypt resting DB; quarantine files should follow same profile boundary |
| Profile isolation snapshot | Enforce path + window binding |

**Gap (remaining):** Soft L3 / Tor Verified still out of band. S1–S5 cover policy · quarantine persist (L3) · preview (L3) · consent export (L3) · cross-profile deny (L3).

## 5. Slices

| Slice | Work | Proof |
|-------|------|-------|
| **S0** | This design + charter security law | Doc |
| **S1** | Policy module: allow/deny by kind; size cap; SVG/HTML/executable deny default | **Done** L1 — `storage/services/inbound-media-policy.ts` |
| **S2** | On-disk quarantine dir per profile; inbound writes only there; no auto system-open | **Done** L1 + **L3 Pass** — plan+persist+read CDP (`p2s-s2-quarantine-persist-l3-soak-latest`) · `allowSystemOpen: false` · no shell open |
| **S3** | Render path only through allowlisted preview components; blob: URLs revoked on unmount | **Done** L1 + **L3 Pass** — preview gate CDP (`p2s-s3-inbound-preview-l3-soak-latest`) · quarantined/exe block · PNG blob: · no shell open |
| **S4** | Explicit “Open externally” copies to user-chosen path | **Done** L1 + **L3 Pass** — consent gate CDP (`p2s-s4-inbound-export-l3-soak-latest`) · no OS shell auto-open |
| **S5** | Cross-profile negative test: profile A quarantine unreadable from B session | **L1–L3 Pass** — CAS + read deny + AppData CDP soak (`p2s-s5-l3-soak-latest`) |

## 6. Censorship / surveillance stance (platform)

- Default product story: **private-trust** (own relays / company DC) + E2EE where adapter supports it.
- Tor / clearnet = **transport preference** on PAL — not claimed Verified until soak.
- Profile metadata minimization: avoid uploading address books / phone numbers; no analytics identity.

## 7. Non-claims

- Not antivirus.
- Not “impossible to dox” if user posts identity in clear.
- Not Tor Verified / Soft L3 Fixed by this doc alone.

## 8. Status

- Design: **written** (S0)
- S1–S4 + S2b: **landed** (L1) — policy · quarantine paths · preview gate · consent export · AppData quarantine persist
- S2: **L3 Pass** — [p2s-s2-quarantine-persist-l3-soak-2026-11.md](./p2s-s2-quarantine-persist-l3-soak-2026-11.md)
- S3: **L3 Pass** — [p2s-s3-inbound-preview-l3-soak-2026-11.md](./p2s-s3-inbound-preview-l3-soak-2026-11.md)
- S4: **L3 Pass** — [p2s-s4-inbound-export-l3-soak-2026-11.md](./p2s-s4-inbound-export-l3-soak-2026-11.md)
- S5: **L1–L3 Pass** — CAS isolation · fail-closed read · dual-profile AppData CDP soak
