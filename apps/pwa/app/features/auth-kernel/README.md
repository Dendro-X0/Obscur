# `features/auth-kernel` — Auth plane ports

**Plane:** Auth (door + session)  
**Rewrite band:** [platform-boundary-map](../../../../../specs/backend/platform-boundary-map-2026-11.md) · [P6 fences](../../../../../specs/backend/platform-p6-plane-readme-fences-design-2026-11.md)

## Owns

- Kernel **ports** and mutation entry (`auth-kernel-ports`, surface actions)
- Manual lock / boot restore eligibility / sign-out cleanup
- Device unlock + registration policy adapters
- Legacy bridge removal criteria (allowlisted only)

## Does not own

- Auth **screen chrome** / lock UI layout — that is `features/auth`
- Profile **slots** / isolation — `features/profiles`
- PDK / SQLite open — Storage plane (`features/storage`) after identity unlock

Shell UI should call `useAuthKernelSurfaceActions` / ports — not scatter raw adapters.
