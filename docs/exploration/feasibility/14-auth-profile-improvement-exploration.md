# Feasibility — Auth & Profile improvement exploration

**ID:** F-auth-profile  
**Status:** draft (as-built critique + target improvements)  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-hub · F-alt · F-PSE · F-stack · `auth-continuity-audience-deliberation-2026-11.md` · `sandboxed-storage-security-design-2026-11.md`  
**As-built anchors:** `AuthGateway` · `auth-kernel-bound-profile-auth` · `readActiveDesktopProfileId` · `desktop-profile-preview-enrichment` · single-door / PDK bind  
**Claim language:** **explored** ≠ rewrite started ≠ Continuity Pass ≠ OAuth

## 1. Scope

- **In:** How Auth and Profile systems work today; how to improve them for **performance**, **feasibility**, **security**, and **UX** under the staged-hub rewrite (F-alt).
- **Out:** Implementing unlock/UI this phase; Soft L3; Continuity/BKP-2 shipping; biometric MFA.

## 2. Basics — as-built shape

### What “Auth” and “Profile” mean (must stay separate)

| Module | Job | Must not own |
|--------|-----|--------------|
| **Auth** | Prove the human may open **this workspace** (session capability) | Carrier login; CRM; message history |
| **Profile** | Hard-isolated workspace slot (keys, DB path, vault, prefs) | Protocol display name as isolation root |
| **Linked identity** (hub) | Per-app pubkey/MXID bound to a profile | Replacing the profile door |

Existing deliberation already splits **three planes** (keep):

1. **Daily unlock** — device password → identity session + local PDK  
2. **Recovery** — recovery file / advanced key → one-time bind to device password  
3. **Continuity** — cross-device history (paused; must not pollute unlock UX)

Single-door (Planes 1–2) and `isShellReady = unlocked && !devicePasswordBindPending` are the right UX/security direction.

### As-built pain (from code structure)

```text
AuthGateway (React) ── orchestrates ──► redirects ×4
                    ├── auto-unlock / remember-me / native restore
                    ├── reload overlay + settle polling
                    ├── device-password bind gate
                    └── profile count = max(isolation snapshot, storage, registry)

Profile id resolution ── many fallbacks ──► sync inject → window boot →
                         legacy last-known → registry active → default

Auth kernel ports ── bound create/import/unlock/lock ──► still finalize via
                     window-runtime-supervisor + identity root
```

| Observation | Why it hurts |
|-------------|--------------|
| **AuthGateway is a god-component** | Perf (many effects), feasibility (hard to cut), security review cost |
| **Multiple profile-id oracles** | Wrong-slot unlock / cross-window races; UX flicker |
| **Display enrichment scans localStorage** | O(keys) on picker; fragile hints across slots |
| **Auth + runtime + identity triple ownership** | Bridge tax; dual paths (`isAuthKernelAuthority` forks) |
| **Secrets and session policy live near UI** | Against F-stack “secrets in Rust kernel” ideal |

## 3. Capabilities map — target improvements

| Need | Today | Better target |
|------|-------|---------------|
| One unlock door | Mostly (single-door + bind) | Keep; move orchestration out of React |
| Hard profile isolation | Desktop windows + scoped paths (good law) | One **ProfileRegistry** owner; no legacy global last-known |
| Hub multi-protocol | Profile ≈ Nostr-shaped account in places | Profile = workspace; carriers = linked identities |
| Fast cold start | Restore overlay + polling + multi-candidate unlock | Kernel session restore API; bounded attempts; no token laundry in UI |
| Secure at-rest | PDK / desktop at-rest direction | Profile-scoped encrypted DB+vault DEKs in kernel (F8/F-hub) |
| Clear UX | Planes documented; Continuity still confusable | Explicit copy: Unlock ≠ Backup ≠ Carrier login |
| Feasible rewrite cut | Entangled TS tree | **Cut 0:** Auth+Profile kernel ports before carrier apps |

## 4. Fit to planes (improvement laws)

| Plane | Improvement law |
|-------|-----------------|
| Auth | Single state machine in kernel: `locked → recovering → binding_pdk → unlocked → locking`. UI only renders + submits intents. |
| Profile | Immutable `profileId` for window lifetime after bind; switch profile = new window or explicit tear-down (already desktop-leaning — keep). |
| Storage | Unlock yields **capability handle** to DB/vault; UI never holds long-term key material. |
| Relationship | Unrelated to Auth except “who may mutate graph.” |
| Message / Transport | Zero auth coupling; linked identities attach **after** shell ready. |

## 5. Libraries / stacks

| Area | Direction |
|------|-----------|
| Ideal home | Rust workspace kernel (F-stack) — auth session, PDK unwrap, profile registry |
| Desktop shell | Keep Tauri window↔profile binding; thin IPC |
| TS UI | Auth screens as pure views; delete parallel auto-unlock pipelines over time |
| Forbidden | OAuth/email/SMS as root; biometric as required MFA |

## 6. Feasibility verdict

`fit-with-adapter` — Auth/Profile are the **first staged-hub cut** (before Nostr/Matrix peer apps). Improving them is higher ROI than carrier work while Soft L3 CRM-on-history remains paused.

### 6.1 Ranked improvement program (docs → later cuts)

| Priority | Change | Perf | Security | UX | Feasibility |
|----------|--------|------|----------|-----|-------------|
| **P0** | **One profile-id owner** — kill legacy global last-known; AuthGateway stops `max()` of three registries | ✓ | ✓ | ✓ | High (subtract) |
| **P0** | **Extract Auth session orchestrator** from `AuthGateway` into a non-React module/kernel port (redirects become pure functions of snapshot) | ✓ | ✓ | ✓ | Medium |
| **P1** | **Secrets stay off UI heap by default** — passphrase → IPC → kernel; no multi-token candidate loops in the gateway | ✓ | ✓✓ | ✓ | Medium (rewrite-aligned) |
| **P1** | **Workspace vs linked identity** vocabulary in UI + schema (profile ≠ nostr account ≠ matrix user) | — | ✓ | ✓✓ | High (docs+types) |
| **P2** | **Profile picker hints** from registry/DB index, not full localStorage scan | ✓ | — | ✓ | High |
| **P2** | **Honest Continuity entry** outside daily unlock (Plane 3 sibling only) | — | ✓ | ✓✓ | Spec exists |
| **P3** | Move Auth+Profile into Rust kernel crates as F-stack Cut 0 | ✓✓ | ✓✓ | — | Large — F9 gated |

### 6.2 Recommended target UX (daily)

```text
[ Profile picker ] → [ Device password ] → (optional one-time PDK bind) → Workspace shell
                         │
                         └─ Advanced: recovery file / key  (not the daily face)
```

Carrier “apps” appear **inside** the shell after unlock — they never present a second root login that replaces the workspace door (aggregator law).

### 6.3 Security invariants (Auth/Profile-specific)

1. No OAuth-as-root.  
2. Cross-profile read deny (already S5 law) — keep under rewrite.  
3. `AccountActiveInOtherProfileWindow` fail-closed stays.  
4. Failed auto-unlock must not delete recovery material (already noted in gateway — preserve).  
5. Remember-me / native session is **explicit consent**, profile-scoped.  
6. Shell content mounts only on `shell_ready` (unlocked + PDK bind complete).

### 6.4 Performance invariants

1. Unlock path: no relay I/O, no CRM hydrate, no carrier connect until shell_ready policy says so.  
2. Profile switch: do not decrypt foreign vaults “just in case.”  
3. Picker: O(profiles) from registry, not O(localStorage keys).  
4. One restore owner — no competing auto-unlock + boot-restore + remember-me races (subtract until one wins).

## 7. Risks / traps

- Polishing AuthGateway effects instead of subtracting owners.  
- Treating Continuity as unlock so users expect chat after password on a new PC.  
- Equating “profile username” with Nostr `kind:0` as the isolation key.  
- Enabling all carrier apps at unlock (F-PSE always-on tax).  
- Dual authority forever (`auth-kernel` flag vs legacy) — pick one cut and delete the other.

## 8. Open questions

1. Cut 0 boundary: TS orchestrator extraction first, or wait for Rust auth crate?  
2. Multi-window: keep 1:1 window↔profile forever, or allow locked switcher in-window with full tear-down?  
3. Stay-signed-in default for private-trust primary surface — on or off?  
4. Should linked-identity secrets (Matrix access token, nsec) live in vault sealed blobs vs separate keychain items?  
5. F8: SQLCipher-class DB vs OS file encryption + app DEK — pick before Cut 0 persistence.

## 9. References

- `apps/pwa/app/features/auth/components/auth-gateway.tsx` — shell_ready, restore, redirects  
- `apps/pwa/app/features/auth-kernel/auth-kernel-bound-profile-auth.ts` — bound create/unlock/lock  
- `apps/pwa/app/features/profiles/services/read-active-desktop-profile-id.ts` — multi-oracle profile id  
- `apps/pwa/app/features/profiles/services/desktop-profile-preview-enrichment.ts` — picker hint scan  
- `specs/backend/auth-continuity-audience-deliberation-2026-11.md` — three planes  
- `docs/exploration/feasibility/12-hub-workspace-vault-adapters.md`  
- `docs/exploration/feasibility/13-architecture-alternatives-hub-critique.md`  
- `docs/exploration/feasibility/11-performance-security-encryption-standards.md`
