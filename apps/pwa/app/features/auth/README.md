# `features/auth` — Auth door UI

**Plane:** Auth (shell UX)  
**Rewrite band:** [platform-boundary-map](../../../../../specs/backend/platform-boundary-map-2026-11.md) · [P6 fences](../../../../../specs/backend/platform-p6-plane-readme-fences-design-2026-11.md)

## Owns

- `AuthScreen` / lock presentation / daily-door copy (passphrase primary · Advanced key)
- Identity persistence helpers and unlock UX that talk **to** kernel ports
- P2 daily-door fence helpers (`auth-daily-door-p2-fence`)

## Does not own

- Session mutation authority — `features/auth-kernel`
- Profile registry / window binding — `features/profiles`
- Protocol send/list — `features/protocol-adaptation`

OAuth-as-root identity remains forbidden under the rewrite band.
