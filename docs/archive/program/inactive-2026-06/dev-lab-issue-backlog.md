# Dev Lab issue backlog — manual finds → automated guards

**Status:** Active  
**Parent:** [dev-lab-spec.md](./dev-lab-spec.md) · [testing-and-issue-tracking-spec.md](./testing-and-issue-tracking-spec.md)  
**Rule:** If you manually repro a symptom **twice**, promote it here and add/extend a Dev Lab scenario **before** closing the incident.

---

## Fast lane (daily)

| When | Command | Needs `:3340` |
|------|---------|---------------|
| Every meaningful slice | `pnpm dev:lab:smoke` | Yes |
| Before handoff / merge claim (UX, DM, shell, relay) | `pnpm verify:handoff` | Yes |
| Domain owner touched (hydrate/persist) | `pnpm verify:thread-history` or `verify:p5-persistence` | No |
| Milestone / pre-tag only | [unified-verification-matrix.md](./unified-verification-matrix.md) L4 | Manual |

**Do not** run the full manual matrix during iteration — it is L4 product truth, not a dev loop.

---

## Promotion workflow

```text
Manual find → docs/incidents/ + M0 JSON → fix canonical owner → domain verify:*
  → Dev Lab scenario (this backlog) → pnpm verify:handoff → close register row
```

Capture at repro time:

```javascript
copy(window.obscurM0Triage?.captureJson(300))
window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary
window.obscurDevRuntimeIssues?.getRecentIssues()
```

---

## Symptom → guard map

| Symptom / manual class | Matrix / notes | Dev Lab scenario | Digest / other gate | Status |
|------------------------|----------------|------------------|---------------------|--------|
| Auth lock / shell not unlocked | §0 | `auth-unlock`, `shell-health` (smoke) | — | **Guarded** (core/smoke) |
| Fatal boundary on main routes | §0 UV-RUNTIME-1 | `nav-matrix`, `chats-chrome`, `network-chrome` | — | **Guarded** (core) |
| Settings tab crash | Settings sweep | `settings-tab-sweep` | — | **Guarded** (core) |
| Relay tab toggle / tab ping loop | UV-RUNTIME-1 manual | `relay-toggle-stress` | — | **Guarded** (core) |
| Synthetic DM send fails | DM rows | `dm-send-synthetic` | `runtime-digest-gates` | **Guarded** (core) |
| DM history shrinks after nav away/back | O-2 class | `dm-history-monotonic` | `selfAuthoredDmContinuity` | **Guarded** (core) |
| DM history lost after reload | O-2 / P5 | `dm-reload-history` | `selfAuthoredDmContinuity` | **Guarded** (core + CLI reload) |
| Native DM lost after WebView reload | Tauri only | `dm-native-persist` (CLI `--cdp`) | M0 native capture | **Partial** (CDP manual) |
| Native DM lost after cold quit | Tauri only | *(none)* | `capture:runtime:native` | **Backlog** |
| Membership digest drift | MEM / coordination | `digest-membership-gates` | `membershipSendability`, `communityLifecycleConvergence` | **Guarded** (core) |
| Join/leave roster truth (two users) | §4 communities | `membership-join-leave` (CLI) | M8 probes | **Partial** (probes only) |
| Leave zombie / stay-left repair gate | E-REL manual | `membership-leave-rejoin-zombie` (full) | — | **Guarded** (full, synthetic) |
| BOT keyword flood rate limit | BOT-1 / SEC-B4 | `sec-bot-keyword-flood` (full) | inbound flood sim | **Partial** (synthetic, no relay) |
| BOT unregistered trigger save | BOT-2 | `sec-bot-keyword-flood` (full) | allowlist sanitizer | **Partial** (synthetic) |
| TRUST fin-cold / dismiss / accepted peer / phish / conn burst | TRUST-1..4, SPAM-1 | `trust-matrix` + `trust-fixtures` | dm-kernel trust port | **Guarded** (Dev Lab scripted) |
| Profile switch scope isolation | AUTH-4 | `auth4-scope-probe`, `auth4-scope-probe-live` (CLI) | `accountSwitchScopeConvergence` | **Partial** |
| Membership reload stability | E-REL manual | `membership-leave-rejoin-live` (CLI) | scope probe | **Partial** (no leave UI yet) |
| Search → profile navigation | Search / network | `search-profile-jump` | `searchJumpNavigation` | **Guarded** (full) |
| Vault route crash | Vault | `vault-unlock` | — | **Guarded** (full) |
| Group send crash (stub era) | ACC group backend | `group-stub-send` | — | **Guarded** (full, toast only) |
| Real group send / ingest | §8 | *(none)* | `verify:thread-history` | **Deferred** (backend stubbed) |
| Dev runtime fault spam | DevTools | `runtime-issues-clean` | `obscurDevRuntimeIssues` | **Guarded** (full) |
| Tester2 → Tester1 DM | Two-user DM | `two-actor-dm` (CLI) | — | **Guarded** (full, CLI) |
| Post-reload shell unhealthy | Cold start | `cold-reload` (benchmark tail) | — | **Guarded** (benchmark) |
| Render loop / max update depth | STAB-R | — | `pnpm verify:stability` | **Guarded** (L2, not Dev Lab) |
| Account switch scope drift | Import/bootstrap | — | `accountSwitchScopeConvergence` (allowlist once) | **Watch** |
| Route stall / blank shell | Nav perf | — | `uiResponsiveness` digest | **Backlog** scenario |

**Status legend:** **Guarded** = scenario in suite · **Partial** = probe/smoke only · **Backlog** = manual still required · **Deferred** = accepted stub / out of scope · **Watch** = digest only

---

## Adding a row

1. File incident: `docs/incidents/YYYY-MM-DD-<slug>.md` + JSON bundle.
2. Add a row to the table above (symptom, scenario id or **Backlog**).
3. Implement scenario → [dev-lab-spec.md](./dev-lab-spec.md) checklist + `dev-lab-suite-manifest.json`.
4. Re-run `pnpm verify:handoff` and attach artifact path to incident close note.

---

## Related commands

```bash
pnpm dev:desktop:online     # Terminal A
pnpm dev:lab:smoke          # ~30s each slice
pnpm verify:handoff         # stability + dev-lab unit + core benchmark
pnpm dev:lab:full           # pre-tag (adds full-only + CLI scenarios)
```

Artifacts: `test-results/dev-lab/dev-lab-benchmark-latest.json`
