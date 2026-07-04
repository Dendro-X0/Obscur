# Community dev profiles specification (2026-06)

**Status:** R5 implementation spec  
**Phase:** R5 — [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md)  
**Resolves:** COM-RUN-08

---

## 1. Problem

`NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` in `apps/pwa/.env.local` allows membership directory tests **without** a working Nostr relay. Maintainers validate join/reconcile UI, then discover chat/invite fail in production-like runs — false confidence (COM-RUN-08).

---

## 2. Two maintainer profiles

| Profile | Environment | Purpose | COM-MEM-2 |
|---------|-------------|---------|-----------|
| **full-stack** | `NEXT_PUBLIC_COORDINATION_URL` set; relay `:7000` running; `DEV_COORDINATION_ONLY` **false** | End-to-end community soak | **Required** |
| **coordination-only** | `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` | Directory/reconcile/coordination API tests | **Must not claim Pass** |

### full-stack setup

```text
Terminal 1: pnpm dev:coordination
Terminal 2: pnpm dev:desktop:no-coord -- --rebuild
Relay: ws://localhost:7000 listening
apps/pwa/.env.local: COORDINATION_URL=http://127.0.0.1:8787
                     DEV_COORDINATION_ONLY_WORKSPACE unset or false
```

### coordination-only setup

Same as above but `DEV_COORDINATION_ONLY_WORKSPACE=true`. Chat and invite-with-room-key are **expected disabled** with banner copy.

---

## 3. UI requirements (R5)

| Element | Behavior |
|---------|----------|
| Dev badge | Visible on group home + settings when `isCoordinationOnlyWorkspaceDevMode()` |
| Badge copy | “Coordination-only dev mode — chat and invite require full-stack profile” |
| Trust assessment | Existing hints in `community-trust-policy.ts` — link to this doc |

Production builds (`NODE_ENV=production`): dev escapes disabled per `isPathBWorkspaceDevEscapeAllowed()`.

---

## 4. Documentation requirements

| Doc | Update |
|-----|--------|
| [community-relay-technical-issues-register-2026-06.md](./community-relay-technical-issues-register-2026-06.md) | Fixture section lists both profiles |
| [dev-lab-spec.md](./dev-lab-spec.md) | COM-MEM-2 requires full-stack |
| README / handoff | Point maintainers to full-stack for community ship claims |

---

## 5. Deliverables (R5)

| ID | Deliverable |
|----|-------------|
| D-1 | `CommunityDevModeBadge` component |
| D-2 | Mount badge on group-home when coordination-only |
| D-3 | i18n keys for badge + tooltip |
| D-4 | Doc cross-links (this spec + register) |

No change to production trust gates.

---

## 6. Acceptance

- [ ] Maintainer cannot mistake coordination-only run for COM-MEM-2 Pass
- [ ] Badge visible in screenshots when using `.env.local` dev flag

---

## 7. Verification

Manual: enable coordination-only → badge visible; disable → badge absent.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial dev profiles spec |
