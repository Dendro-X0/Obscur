# Obscur v2 — Phase 3 signing policy (maintainer sign-off)

**Status:** Signed 2026-07-04  
**Phase:** 3 row **P3-2**  
**Applies to:** `release-assets/` artifacts from [manifest.json](../../release-assets/manifest.json)  
**Archive detail:** [local-signing-strategy.md](../archive/program/inactive-2026-06/local-signing-strategy.md)

---

## Decision (2026-07-04)

| Surface | Phase 3 policy | Rationale |
|---------|----------------|-----------|
| **Desktop NSIS** | **Unsigned accepted** | Maintainer indie path; public repo + SHA-256 manifest is trust anchor |
| **Desktop minisign / updater** | **Deferred** | Not required for local demo install or Phase 3 exit |
| **Android release JKS** | **Deferred** | Debug APK sufficient for Phase 3; release keystore before public sideload campaign |
| **Android debug APK** | **Allowed** | Gradle debug keystore — no secrets in repo |

This aligns with the 2026-06-01 maintainer decision in archived signing strategy: **functionality first**, honest copy over store badges.

---

## User-facing honesty (required)

Include in demo / website / support copy:

1. Windows installer may show **unknown publisher** / SmartScreen — expected for unsigned builds.
2. Trust verification: compare installer SHA-256 to [release-assets/manifest.json](../../release-assets/manifest.json).
3. Android sideload builds are **debug or self-signed release** — not Play Store verified.

Link: [obscur-v2-known-limitations.md](./obscur-v2-known-limitations.md)

---

## When to revisit (pre–v2.0.0 tag / Phase 6)

| Trigger | Action |
|---------|--------|
| In-app updater channel on `main` | Wire minisign per archive strategy |
| Public website download | Publish pubkey fingerprint + signed `.sig` if channel enabled |
| Android demo to non-dev users | Release JKS + `apksigner verify` record in manifest |

---

## P3-1 artifact under this policy

| Field | Value |
|-------|--------|
| File | `Obscur_1.9.10_x64-setup.exe` |
| SHA-256 | `d814ab21c9b927644ec567c9e305bde482a53c1b1b9069b357aa10bdc990813f` |
| Commit | `4d000257` |
| NSIS Authenticode | **None** (Layer B deferred) |
| Minisign `.sig` | **None** (Layer A deferred) |

---

## Maintainer checklist

- [x] Unsigned desktop policy documented (this file)
- [x] Manifest records `signingPolicy: "unsigned"`
- [x] Limitations sheet links honest copy
- [ ] Minisign keys — **not required** for Phase 3 exit
- [ ] Android release keystore — **not required** for Phase 3 exit

---

## Revision history

| Date | Change |
|------|--------|
| 2026-07-04 | P3-2 sign-off — unsigned accepted for desktop Phase 3 |
