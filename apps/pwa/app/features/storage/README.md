# `features/storage` — Storage plane

**Plane:** Storage (at-rest + inbound sandbox)  
**Rewrite band:** [platform-boundary-map](../../../../../specs/backend/platform-boundary-map-2026-11.md) · [sandboxed-storage-security](../../../../../specs/backend/sandboxed-storage-security-design-2026-11.md) · [P6 fences](../../../../../specs/backend/platform-p6-plane-readme-fences-design-2026-11.md)

## Owns

- Native storage-at-rest / vault-at-rest / profile data key session
- Inbound media **policy · quarantine paths · preview gate · export consent** (P2-S; S2/S4 L3 soaks via `__OBSCUR_STORAGE_SOAK__`)
- Soft-lock unlock mode coordination with Auth (does not unlock identity)

## Does not own

- Auth door UX or identity decrypt — Auth plane
- Profile slot registry — `features/profiles`
- Protocol adapters / send — PAL

Cross-profile quarantine read must fail closed (S5). Not an antivirus / Tor Verified claim.
