# Current Session Handoff — Obscur (v2 slim kernel + workspace kernel)

- Last Updated (UTC): 2026-06-08T06:05:00Z
- Last commit: (pending) — v1.9.7 auth gates + Dev Lab TRUST-1 cold-DM

## Next atomic step

**v1.9.7 — auth subtraction (login assist withdrawn)**

Scope: [v1.9.7-scope.md](../program/v1.9.7-scope.md)

1. ~~Remove login assist UI + vault + Tauri commands~~ — landed
2. ~~Run~~ `pnpm verify:session-persistence-policy` + `pnpm verify:profile-picker` + auth vitest — **passed 2026-06-08**
3. **Desktop smoke:** key import → password unlock → lock → password-only return login
4. Tag **v1.9.7** when maintainer satisfied

**Dev Lab TRUST-1 (in-app):** `trust-cold-dm-banner` + `sendSyntheticDmFromZombiePersona` — stranger DM delivery verified on desktop.

**Then:** [v1.9.5 Phase B manual matrix](../program/v1.9.5-phase-b-manual-matrix.md) — AUTH-4, TRUST-1..3 (Dev Lab), SEC-R1, BOT-1/2.

**Withdrawn:** [local-login-assist-charter.md](../program/local-login-assist-charter.md) (LLA-1 — autofill/save prompts)

**Deferred (unchanged):** Auth Assistant · restart restore (AUTH-SESSION-1) · silent remember-me

Reference: [v1.9.6-session-persistence-redesign.md](../program/v1.9.6-session-persistence-redesign.md) · [obscur-auth-assistant-charter.md](../program/obscur-auth-assistant-charter.md)

### v1.9.6 landed (kept)

- Password-only return login (no username on Log In tab)
- Stay signed in checkbox + native keychain consent path
- Profile picker auth routing + locked title-bar profile switcher
- Lock → `clear_native_session`; Log out → `logout_native`

### E-REL community membership — complete (2026-06-12)

Charter: [relationship-sync-experiment.md](../program/relationship-sync-experiment.md) · Gate: `pnpm verify:relationship-sync-experiment`

### Prior focus (paused)

**v1.9.5 Phase B — manual matrix + Phase C maintainer sign-off** — see archive sections below.

## Programmatic gate (run before claiming progress)

```bash
pnpm verify:v2-slim
pnpm verify:session-persistence-policy
pnpm verify:profile-picker
```

## Desktop dev

```bash
taskkill //F //IM obscur_desktop_app.exe
pnpm dev:desktop:no-coord -- --rebuild   # after auth/Rust changes
pnpm dev:desktop:online                  # online stack
```

## Do not

- Re-introduce login assist / autofill / save-prompt paths without a new charter + feasibility review
- Patch-debug AUTH-SESSION-1 cold restore (`rules/11`)
- Manual A/B soak as progress gate

---

<!-- Archive: Path B, Tier 4, workspace kernel sections unchanged — see git history if needed -->
