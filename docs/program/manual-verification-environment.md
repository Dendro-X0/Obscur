# Manual verification environment

**Status:** Active — **deferred during batch implementation**; run [deferred-manual-verification-checklist.md](./deferred-manual-verification-checklist.md) when circumstances allow  
**Related:** [v1.8.x-batch-implementation-lane.md](./v1.8.x-batch-implementation-lane.md), [obscur-2.0-milestone-roadmap.md](./obscur-2.0-milestone-roadmap.md), demo matrices under `docs/assets/demo/`

---

## Canonical setup (maintainer)

| Item | Value |
|------|--------|
| **Surface** | **Desktop app** (Tauri) — primary evidence for community, DM, governance, and UX lanes |
| **Profiles** | **Two** windows in one machine, same desktop build |
| **Account A** | **Tester 1** — use **dark** theme in screenshots |
| **Account B** | **Tester 2** — use **light** theme in screenshots |
| **Third account** | **None** — do not assume a third peer for quorum unless a matrix row explicitly uses relay-only evidence |

### Disposable dev credentials (not production secrets)

These accounts exist only for local/desktop matrix work. They can be recreated in seconds; do **not** reuse this pattern for real users.

| | **Tester 1 (A, dark)** | **Tester 2 (B, light)** |
|---|------------------------|-------------------------|
| Username | `Tester1` | `Tester2` |
| Password | `SyI14^ew1E` | `HT512#scE8` |
| `npub` | `npub1uplk0h9c5k848vfl69dw2jwrr7ecz736dncw30tfqwaw8sv3aftq3rtdrg` | `npub18kc9tdr7qk7lhyyralkqk7hv62sytklhmpju7nv4mxyp0k2xsv8ss7n67a` |
| Hex pubkey | `c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884` | *(derive from nsec below or import via app)* |
| `nsec` / import | `c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884` (hex) | `nsec1gkv6kg9gyfvrg7h7q60usvaqtjq096dxewaw4vpk9y6krrlcglpqat96ta` |

**Auth note (future):** username/password login is convenient for dev matrices; production should keep **key-based identity** as truth and treat passwords as optional profile unlock or device-gate only—not a second identity root.

| **Mobile** | Deferred to **v1.8.x** Lane **M** after install/signing path works (see 2.0 roadmap) |

---

## Agent / dev-server testing (A = device 1, B = device 2)

Treat **Tester 1** and **Tester 2** as **two independent users on two devices**, even when both run on one machine:

| Simulated device | Account | Typical surface | Theme |
|------------------|---------|-----------------|-------|
| Device A | Tester1 | Tauri window **or** browser tab at `http://127.0.0.1:3340` (profile A) | Dark |
| Device B | Tester2 | Second Tauri profile window **or** separate browser profile / incognito | Light |

**`pnpm dev:desktop:online`** serves the **same Next.js app** the Tauri WebView loads (`127.0.0.1:3340`). React kernel, relay pool, auth, and community gates behave the same; differences are **native-only** boundaries:

| Capability | Tauri desktop | Browser at `:3340` |
|------------|---------------|---------------------|
| SQLite DM / protocol persistence | Yes (native commands) | No — chat-state + projection paths only |
| Coordination HTTP | Tauri `plugin-http` + loopback retry | Browser `fetch` (often **better** for G6-4 loopback) |
| Tor relay bridge | Optional native plugin | **Not required** — skip Tor-specific rows on web |
| Multi-profile isolation | Separate profile windows / keychain | Separate browser profiles or two windows + distinct storage |

**Agent convention:** use credentials from the table above to sign in on dev server or desktop; never merge A/B state in one profile. Automated contract tests (`pnpm verify:phase3`, coordination health scripts) complement but do not replace two-user matrix rows.

**Out of scope for web/dev-server passes:** Tor enablement, native keychain, background push — optional desktop features only.

---

## How to run A/B on desktop

1. Launch Obscur desktop twice (two profile windows) or use built-in multi-profile switching per your usual workflow.
2. Lock themes before capturing: **Tester 1 → dark**, **Tester 2 → light** (settings → appearance).
3. For community flows, label screenshots `A-dark` / `B-light` in demo folders.
4. Record **Pass** only when **both** profiles show expected behavior (or the row documents single-profile scope).

---

## What counts as “manual verification done”

**Batch mode (active):** Implementation does **not** wait on manual passes. Use the consolidated [deferred-manual-verification-checklist.md](./deferred-manual-verification-checklist.md) after coding waves land.

**Pre-tag (when you choose to publish):**

1. Exercise applicable checklist sections (§1 minimum for desktop; §5 if mobile matters).
2. File regressions in [v1.5.0-known-issues-and-investigation-queue.md](./v1.5.0-known-issues-and-investigation-queue.md).
3. `pnpm release:test-pack` green on the commit being tagged.

Per-version demo matrices under `docs/assets/demo/` remain reference detail; the deferred checklist is the maintainer entry point.

---

## Mobile verification (later)

When Lane **M** opens:

- **Environment:** Android Studio emulator or USB device with **local/decentralized signing** (no purchased store certificates).
- **Parity:** Same monorepo version as desktop tag; shared kernel behavior, native shell only where documented.
- Extend matrix rows with `M-dark` / `M-light` only after install path is proven — until then, desktop A/B remains authoritative.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-05-21 | Initial environment: Tester 1/2, dark/light, desktop-first, no third account |
| 2026-05-26 | Added disposable Tester1/Tester2 credentials for A/B manual passes |
| 2026-05-26 | Agent testing: two-device model, dev server `:3340` parity notes, Tor out of scope on web |
