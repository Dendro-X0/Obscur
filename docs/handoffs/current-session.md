# Current Session Handoff — Obscur Engine Lab

- Last Updated (UTC): 2026-07-18T08:25:00Z

## Next atomic step

**Full Release — v1.9.14 multi-OS** · 2026-07-18

| Field | Value |
|-------|--------|
| Done | Tagged **v1.9.14** · Full Release red (Win/Linux/Android) · macOS/Web/iOS green · local `pnpm ci:local:desktop-win` **PASS** after corrupt `cc` registry repair · installer `release-assets/windows/Obscur_1.9.14_x64-setup.exe` |
| Next | Get Actions Build Desktop Bundles stderr (Win+Ubuntu) via `gh` auth or paste · classify one failure class · fix or cache-bust · then land multi-OS `release-assets/` + regenerate manifest (still 1.9.12) |
| Proof | [specs/ci/2026-07-18-v1.9.14-full-release-investigation.md](../../specs/ci/2026-07-18-v1.9.14-full-release-investigation.md) · `pnpm ci:local:desktop-win` PASS · Actions run 29635736220 |
| Local note | Signing decode error from `.env.signing.local` is maintainer-only; package script tolerates when NSIS exists. CI does not inject Tauri updater secrets. |

**Paused:** community roster · `v2.0.0` tag.

---

## Prior atomic step — v2.0.0 fast-track (paused)

| Field | Value |
|-------|--------|
| Done | D3 path A documented · domain mismatch (`obscur.app` ≠ messenger) · CI triage |
| Next | Resume after website guide MVP + relay assessment |
| Plan | [v2.0.0-fast-track-2026-07.md](../../specs/backend/v2.0.0-fast-track-2026-07.md) |

---

## Prior atomic step — P14 L3 soak (superseded)

| Field | Value |
|-------|--------|
| Outcome | **Accepted without Row B** — maintainer GIF recording (DM + group) · 2026-07-17 |
| Note | Runbook remains for optional future soak |

---

## Prior atomic step — product track charter (archive)

| Field | Value |
|-------|--------|
| Done | [obscur-ecosystem-charter.md](../program/obscur-ecosystem-charter.md) — protocol identity · stress posture · personas · auth constraints · operator-sovereign scale |
| Next | (superseded by v2.0.0 fast-track) |

---

## Prior atomic step — P14-S slice B (archive)

| Field | Value |
|-------|--------|
| Done | Apply-pack confirm when list non-empty · template pre-fill + scroll/focus · Tor ready badge · Tor apply gate |
| Next | L3 soak · Relays → Transport rename (optional) |
| Proof | `transport-preset-apply-policy.test.ts` · `transport-preset-catalog-panel.test.tsx` · `transport-preset-match.test.ts` |

---

## Prior atomic step — P14-S slice A (archive)

| Field | Value |
|-------|--------|
| Done | Active/partial/available pack badges · active mix summary · adapter chips on endpoints · collapsed API/community/metrics |
| Next | Slice B — apply confirm · template pre-fill · Tor inline gate |
| Proof | `transport-preset-match.test.ts` · `relay-endpoint-adapter.test.ts` · `transport-preset-catalog-panel.test.tsx` |

---

## Train (public path)

```text
1.9.12 MESH-TRUST → 1.9.13 VAULT-LES (verified) → 1.9.14 POOL+PRESETS → v2.0.0 gate
```

---

## Prior atomic step — LES R6b / V13-5 (archive · verified)

| Field | Value |
|-------|--------|
| Outcome | Preview stable · Remove from Vault · Secure Upload / chat Save / grid |
| Evidence | Maintainer desktop soak 2026-07-17 |

---

## Prior atomic step — LES V13-5 catalog delete (archive)

| Field | Value |
|-------|--------|
| Outcome | Rust `delete_object` + `desktop_les_delete` + TS SDK; UI Remove from Vault |

---

## Prior atomic step — LES R6a grid reuse (archive)

| Field | Value |
|-------|--------|
| Outcome | Adapter `les-vault-media-adapter` + `useLesVaultMedia` → `VaultMediaGrid` |

---

## Prior atomic step — LES R5 cutover (archive)

| Field | Value |
|-------|--------|
| Outcome | Legacy vault write APIs tombstoned; LES-only data plane |

---

## Prior atomic step — LES R4 chat Save (archive)

| Field | Value |
|-------|--------|
| Outcome | Messaging Save → LES; no `saveFileToLocalVault` |

---

## Prior atomic step — LES R3 cold-hydrate L3 (archive · PASS)

| Field | Value |
|-------|--------|
| Gate | `pnpm verify:les-l3` PASS |
| Tests | `l3_cold_hydrate_after_commit_…` · `l3_cold_hydrate_multiple_objects_…` |

---

## Prior atomic step — LES R2 Secure Upload UI (archive)

| Field | Value |
|-------|--------|
| Outcome | Native `/vault` → LES Secure Upload + catalog grid |

---

## Prior atomic step — PROD v1.9.12 demo-safe (archive · COMPLETE)

| Field | Value |
|-------|--------|
| Status | **Shipped** — tag `v1.9.12` · installer + manifest |
| Commit | packaging follow-up on `main` |
| Installer | `release-assets/windows/Obscur_1.9.12_x64-setup.exe` · sha256 `96fa632546d64935afe7936de49368ae6ff35373561d56aaf377c00d52111e1f` |
| Deferred | Vault → 1.9.13 · community PAUSED · C13 L3 BLOCKED |

---

## Prior atomic step — CONDUIT-MESH-C7 L3 WS soak (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **PASS** — Row A (Settings Conduit Mesh / E2EE / NOSTR_WS) · Row B dual-window |
| Runbook | [conduit-mesh-c7-l3-soak-runbook.md](../program/conduit-mesh-c7-l3-soak-runbook.md) |
| Evidence | markers `C7-L3-ws-20260715D` / `…D-reply` · B1 **1243ms** · B2 **1463ms** · relays `wss://nos.lol` + `wss://relay.damus.io` · stamp `shell-2026-07-15T13:55:42Z` · Tor disabled for soak |
| Note | Tor-on broke public WS earlier (`RELAY_CONNECT_FAILED`); Tor left off for C7 |

---

## Prior atomic step — CONDUIT-MESH-C14 L3 SSE soak (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **PASS** — S1+S2+B1+B2 |
| Runbook | [conduit-mesh-c14-l3-sse-soak-runbook.md](../program/conduit-mesh-c14-l3-sse-soak-runbook.md) |
| Evidence | health `sse` · CDP `Accept: text/event-stream` · markers `C14-L3-sse-20260715A` / reply · B1 **1876ms** · B2 **2470ms** · stamp `shell-2026-07-15T13:55:42Z` |

---

## Prior atomic step — CONDUIT-MESH-C13 L3 Tor SOCKS (archive · BLOCKED · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **BLOCKED** — env Tor circuits |
| Runbook | [conduit-mesh-c13-l3-tor-socks-soak-runbook.md](../program/conduit-mesh-c13-l3-tor-socks-soak-runbook.md) |
| Evidence | SOCKS `:9050` up · desktop `ready` via TCP probe · HS onion published · Tor stuck **10%** TLS handshake failures |
| L1 | still green — `pnpm verify:conduit-mesh-c13` |
| Retry | When host can bootstrap Tor to 100% |

---

## Prior atomic step — CONDUIT-MESH-C14 SSE stream (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **L1 landed** — SSE prefer-path; long-poll/C10 remain fallbacks |
| Charter | [conduit-mesh-c14-sse-stream-charter.md](../program/conduit-mesh-c14-sse-stream-charter.md) |
| Design | [conduit-mesh-c14-sse-stream-design.md](../../specs/backend/conduit-mesh-c14-sse-stream-design.md) |
| L1 | `pnpm verify:conduit-mesh-c14` |
| Scope | `Accept: text/event-stream` · fetch ReadableStream parse · health `sse` capability |
| L3 | [conduit-mesh-c14-l3-sse-soak-runbook.md](../program/conduit-mesh-c14-l3-sse-soak-runbook.md) — **PASS** 2026-07-15 |

---

## Prior atomic step — CONDUIT-MESH-C13 Tor SOCKS (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **L1 landed** — routed `ConduitMeshFetch` + `mesh_http_fetch_via_socks` + onion→`tor_required` |
| Charter | [conduit-mesh-c13-tor-socks-drivers-charter.md](../program/conduit-mesh-c13-tor-socks-drivers-charter.md) |
| Design | [conduit-mesh-c13-tor-socks-drivers-design.md](../../specs/backend/conduit-mesh-c13-tor-socks-drivers-design.md) |
| L1 | `pnpm verify:conduit-mesh-c13` |
| Scope | Per-conduit SOCKS HTTP; PWA browser WS/SOCKS still limited; native WS uses existing Tor NetRuntime |
| L3 | Tor-on desktop publish/receive via onion HTTP — **not claimed** |

---

## Prior atomic step — CONDUIT-MESH-C12 HTTP long-poll stream (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **L1 landed** — long-poll on `GET /mesh/v1/stream`; C10 poll fallback when health omits `long_poll` |
| Charter | [conduit-mesh-c12-http-stream-charter.md](../program/conduit-mesh-c12-http-stream-charter.md) |
| Design | [conduit-mesh-c12-http-stream-design.md](../../specs/backend/conduit-mesh-c12-http-stream-design.md) |
| L1 | `pnpm verify:conduit-mesh-c12` |
| Scope | Health `capabilities: ["pull","long_poll"]` · store `waitForList` · driver prefer stream · SSE deferred |
| L3 | Latency soak vs 3s poll — **not claimed** |

---

## Prior atomic step — CONDUIT-MESH-C11 mesh-native DM wire codec (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **L1 landed** — charter + design + codec + HTTP publish/inbound bridge |
| Charter | [conduit-mesh-c11-mesh-native-dm-codec-charter.md](../program/conduit-mesh-c11-mesh-native-dm-codec-charter.md) |
| Design | [conduit-mesh-c11-mesh-native-dm-codec-design.md](../../specs/backend/conduit-mesh-c11-mesh-native-dm-codec-design.md) |
| L1 | `pnpm verify:conduit-mesh-c11` |
| Scope | HTTP `team_relay` stores `obscur_mesh_dm_wire_v1` in ciphertext; inbound accepts native **or** legacy Nostr wire; DM pipeline unchanged |
| L3 | Re-run C10 runbook with native wire in gateway POST — **not claimed** |

---

## Prior atomic step — CONDUIT-MESH-C10 L3 HTTP-only DM soak (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **Landed** — Row A **PASS** · Row B **PASS** (B1+B2) · L1 **PASS** |
| Charter | [conduit-mesh-c10-http-pull-subscribe-charter.md](../program/conduit-mesh-c10-http-pull-subscribe-charter.md) |
| L3 runbook | [conduit-mesh-c10-l3-http-soak-runbook.md](../program/conduit-mesh-c10-l3-http-soak-runbook.md) |
| Investigation | [conduit-mesh-c10-l3-dm-scope-cors-investigation.md](../../specs/backend/conduit-mesh-c10-l3-dm-scope-cors-investigation.md) |
| L1 | `pnpm verify:conduit-mesh-c10` **PASS** (12 tests) · `dm-relay-transport.test.ts` **PASS** |
| L3 blockers fixed (cumulative) | (1)–(8) prior · **(9)** HTTP-only caps hybrid targets · **(10)** pull `recipientPublicKeyHex` filter · **(11)** re-arm inbound interests after `configureConduits` + HTTP writable arm |
| Row B evidence (PASS) | Markers `C10-L3-soak-20260715I` (T1→T2) + `…I-reply` (T2→T1) · both `delivered` · gateway filtered pull n=1 · shell `shell-2026-07-15T10:36:16Z` |
| Ops notes | Restart mesh gateway between soaks (presence flood) · force HTTP-only enabled list (account sync re-enables `wss://`) |
| Boot | Terminal A: `MESH_HTTP_PORT=8788 pnpm -C apps/relay-gateway dev` · Terminal B: `pnpm dev:desktop -- --online --skip-build` (after rebuild) |
| **Next** | Pick next roadmap slice (C11 mesh-native codec / C12 long-poll / etc.) — C10 L3 closed |

---

## Prior atomic step — CONDUIT-MESH-C10 Row B target + receive (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **Superseded by sign-off above** |
| Hypothesis | Hybrid peer WS targets escape HTTP-only pool — **confirmed**; later receive blocked by presence drown + inbound stop on remount |
| Fixes | `resolveTargetRelayUrls` HTTP-only early return · gateway/pull audience filter · `configureConduits` re-arms interests · DM arm uses writable HTTP snapshot |

---

## Prior atomic step — DEV-SHELL-FRESHNESS-GUARD (archive · 2026-07-15)

| Field | Value |
|-------|--------|
| Status | **Landed** — infrastructure; unblocks stale-desktop C10 loops |
| Design | [dev-shell-freshness-guard-design-2026-07.md](../../specs/backend/dev-shell-freshness-guard-design-2026-07.md) |
| Owners | `apps/desktop/src-tauri/src/dev_shell_freshness.rs` · `scripts/lib/static-shell-stale.mjs` · `scripts/run-obscur-dev-clean.mjs` |
| L1 | Node `static-shell-stale.test.mjs` (6/6) · `cargo test -p obscur_desktop_lib dev_shell_freshness` (5/5) |
| L3 | Cold rebuild stamp parity: `CLIENT_BUILD_STAMP` = manifest = DOM (`build-pwa-shell.mjs` single revision capture) |
| Pipeline | Predev `obscur-dev-clean` (kill target PIDs + purge HTTP/Code caches only) → expanded `STATIC_SHELL_SOURCE_ROOTS` (`packages/obscur-*`) → static-dev stamp inject + PWA mismatch banner |
| Out of scope | IndexedDB/session wipe · `dev:desktop:live` · C10 transport logic |

---

## Prior atomic step — CONDUIT-MESH-C9 Tor host integration (archive)

| Field | Value |
|-------|--------|
| Status | L1 landed 2026-07-14 |
| Charter | [conduit-mesh-c9-tor-host-integration-charter.md](../program/conduit-mesh-c9-tor-host-integration-charter.md) |
| L1 | `pnpm verify:conduit-mesh-c9` |

---

## Queued — Conduit Mesh follow-ups (post-L1 close)

| Slice | Doc | Type | Owner |
|-------|-----|------|-------|
| **L1 close** | [conduit-mesh-l1-band-close-2026-07.md](../program/conduit-mesh-l1-band-close-2026-07.md) | Band status | **Closed** |
| **C10 L3** | [conduit-mesh-c10-l3-http-soak-runbook.md](../program/conduit-mesh-c10-l3-http-soak-runbook.md) | HTTP-only DM | **PASS** |
| **C14 L3** | [conduit-mesh-c14-l3-sse-soak-runbook.md](../program/conduit-mesh-c14-l3-sse-soak-runbook.md) | SSE latency soak | Maintainer |
| **C13 L3** | [conduit-mesh-c13-l3-tor-socks-soak-runbook.md](../program/conduit-mesh-c13-l3-tor-socks-soak-runbook.md) | Tor SOCKS HTTP | Maintainer |
| **C7 L3** | [conduit-mesh-c7-l3-soak-runbook.md](../program/conduit-mesh-c7-l3-soak-runbook.md) | WS mesh default | Maintainer |
| **C11–C14 L1** | charters in `docs/program/` | Code | **Landed** |

---

**Status:** **LES radical redesign** — dismantle Vault implementation · reconstruct · goal preserved

| Field | Value |
|-------|--------|
| Design | [vault-les-radical-redesign-2026-07.md](../../specs/backend/vault-les-radical-redesign-2026-07.md) |
| Old path | Frozen — do not patch |
| Flag | Old chat-save stays false until LES R4+L3 |

---

## EXIT — CodaCtrl lane D (Obscur-side)

**Status:** **EXIT (Obscur)** — no further Obscur code expected unless CodaCtrl defines new hook requirements.

| Field | Value |
|-------|--------|
| Runbook | [codactrl-obscur-agent-runbook-2026-07.md](../program/codactrl-obscur-agent-runbook-2026-07.md) |
| WEB-R2 | **Mitigated** — `data-codactrl-sha256` hooks on `/download` |
| RIW-8 | **Draft shipped** — `signalExtractMappings` in FLS rule pack; **CodaCtrl repo** must wire extractor |
| WEB-R1 / WEB-R3 | **Documented** — workspace alignment + probe routing in runbook |
| Proof (Obscur) | `pnpm docs:check` · `pnpm -C apps/website build` PASS · DOM hooks on `localhost:3000/download` |
| External blocker | `client_web_surface_probe` `downloadShaPresent: false` until **CodaCtrl daemon** reads `[data-codactrl-sha256]` |
| Release track | Phase 4 deploy **PAUSED** · Phase 5 GIF **maintainer-later** · `v2.0.0` tag **not yet** (separate from lane D) |

---

## Prior atomic step — VAULT-SANDBOX-1 Phase 6 (archive · pre-pause)

| Field | Value |
|-------|--------|
| Release | [v1.9.12-scope.md](../program/v1.9.12-scope.md) |
| Design | [vault-chat-save-phase6-design-2026-07.md](../../specs/backend/vault-chat-save-phase6-design-2026-07.md) |
| Plan | [vault-encryption-sandbox-plan-2026-07.md](../../specs/backend/vault-encryption-sandbox-plan-2026-07.md) |
| L3/L4 runbook | [vault-sandbox-l3-verification-2026-07.md](../../specs/backend/vault-sandbox-l3-verification-2026-07.md) |
| Flag | `VAULT_SAVE_FROM_CHAT_ENABLED = false` until G8 + L3 chain |
| L1 | `pnpm verify:vault-sandbox-l1` · `pnpm verify:storage-encryption-v1.9.8` |
| Demo path | Secure Upload until Phase 6 flag flip |
| Outcome | **Not verified** — client dogfood stopped by maintainer (2026-07-14) |

---

## Prior atomic step — CodaCtrl lane D (archive)

| Field | Value |
|-------|--------|
| Runbook | [codactrl-obscur-agent-runbook-2026-07.md](../program/codactrl-obscur-agent-runbook-2026-07.md) |
| WEB-R2 | **Mitigated** — `data-codactrl-sha256` hooks on `/download` |
| RIW-8 | **Draft** — `signalExtractMappings` in FLS rule pack (CodaCtrl repo to consume) |
| WEB-R1 / WEB-R3 | **Documented** — workspace alignment + probe routing in runbook |
| Proof | `pnpm docs:check` · `pnpm -C apps/website build` PASS · DOM hooks verified on `localhost:3000/download` |
| Probe note | `client_web_surface_probe` still `downloadShaPresent: false` — **CodaCtrl daemon** must read `[data-codactrl-sha256]` |
| Phase 4–6 | Deploy PAUSED · GIF maintainer-later · tag **not yet** |

**R5 — VERIFIED t4 (2026-07-04)**

| Field | Value |
|-------|--------|
| Commit | `60c9bb3c` — `resolveRoomKeyHexForGroupRelayIngest` · ingest hooks pass `localPrivateKeyHex` |
| Investigation | [o4-ingest-chrome-r5-investigation-2026-07.md](../../specs/backend/o4-ingest-chrome-r5-investigation-2026-07.md) |
| Design | [o4-ingest-chrome-r5-design-2026-07.md](../../specs/backend/o4-ingest-chrome-r5-design-2026-07.md) |
| L1 | **PASS** — ingest + room-key-owner (26/26) |
| Warm t4 | `csess-58ce611e907b` · send `R5-o4-ingest-t4-070T1746` · thread + sidebar preview · digest no `decrypt_failed` · `mainThreadSystemCards: 0` |
| Cold t4 | `csess-b7f42e294e5e` · post-`taskkill` unlock · marker visible in thread + sidebar |
| Chain | `chain-r5-o4-ingest-chrome-2026-07-04` · `r5-t4-thread-send` · `r5-t4-coldrestart` |
| Does not prove | Tester2 background ingest on `:9231` without community-home visit |

**R3 — committed (2026-07-04 · Option B)**

| Field | Value |
|-------|--------|
| Commit | `3cf79dbe` — list-time SQLite preview hydrate |
| Investigation | [sidebar-preview-stale-r3-investigation-2026-07.md](../../specs/backend/sidebar-preview-stale-r3-investigation-2026-07.md) |
| Design | [sidebar-preview-stale-r3-design-2026-07.md](../../specs/backend/sidebar-preview-stale-r3-design-2026-07.md) |
| L1 | **PASS** — `group-sidebar-preview-sqlite-hydrate.test.ts` (5/5) |
| t4 | **PASS** — `csess-264849283e3c` · Group tab · preview `R1-room-key-health-t4-070T1410` (required static `--rebuild`) |

**R2 — VERIFIED t4 (2026-07-04 post-fix regression)**

| Field | Value |
|-------|--------|
| Investigation | [auth-keychain-restore-failed-r2-investigation-2026-07.md](../../specs/backend/auth-keychain-restore-failed-r2-investigation-2026-07.md) |
| Design | [auth-keychain-restore-failed-r2-design-2026-07.md](../../specs/backend/auth-keychain-restore-failed-r2-design-2026-07.md) |
| Fix | `materializePasswordProtectedIdentityBeforeUnlock` in `identity-passphrase-unlock.ts` |
| L1 | **PASS** — identity-passphrase-unlock + data-root-identity-repair (7/7) |
| Chain | `chain-r2-auth-cold-unlock-2026-07-04` · n0–n2 (pre-fix) · n3 warm post-fix · **n4 cold post-fix PASS** |
| Cold | `taskkill` → relaunch rebuilt shell → password unlock → main shell + compose (no Import Key) |
| Sessions | `csess-0452d809a249` (warm) · `csess-afc2304a45ec` (cold t4) |
| Does not prove | Auto keychain unlock without password · passwordless skip path · packaged NSIS |

**Maintainer policy (2026-07-04):** Runtime repair band **EXIT** (R1–R3 + R5 **VERIFIED t4** · R4 **A**) · Phase 4 deploy **unpaused for maintainer smoke** · release prep (`v2.0.0` tag, demo kit) still gated on Phase 4 sign-off.

Repair queue:

| Priority | ID | Status |
|----------|-----|--------|
| R1 | `group-room-key-missing` | **VERIFIED t4** |
| R2 | `auth-keychain-restore-failed` | **VERIFIED t4** |
| **R3** | Sidebar preview stale | **VERIFIED t4** (`csess-264849283e3c` · `3cf79dbe`) |
| **R5** | O-4 ingest chrome | **VERIFIED t4** (`60c9bb3c` · `csess-58ce611e907b` / `csess-b7f42e294e5e`) |
| R4 | COM-RUN-01 roster | **A** @ ACC-02 |

Protocol: [obscur-runtime-issue-tracker-2026-07.md](../program/obscur-runtime-issue-tracker-2026-07.md) · register `.codectx/verify/issues-register.summary.json`

**R1 — VERIFIED t4 (2026-07-04 round `2026-07-04-r1-room-key-health-t4`)**

| Field | Value |
|-------|--------|
| Root cause | Health hook used `roomKeyStore.getRoomKey()` only; send used `resolveRoomKeyForCommunityAction` (local → coordination materialize) |
| Fix (uncommitted) | `resolveRoomKeyHexForMembershipHealthPanel` · hook + `group-home-page-client` passes `privateKeyHex` · health copy omits `room_key_missing` when `ready && chatEnabled` |
| L1 | `community-coordination-room-key-owner.test.ts` · `community-membership-health-copy.test.ts` |
| Fixture | Tester1 · NewTest 2 · `b93f53e23d8c4456835afd3f4d3a627b` · docker `:7000` · coordination `:8787` |
| Warm | Send `R1-room-key-health-t4-070T1410` · digest `room_key_missing_send_blocked` empty · no “Room key missing” chrome |
| Cold | `taskkill obscur_desktop_app.exe` → relaunch → Import Key unlock → message + compose still OK (**feeds R2**) |
| Chain | `chain-r1-room-key-health-2026-07-04` · `n0-r1-health-send-pass` → `n1-post-restart-hydrate` |
| Sessions | `csess-94f4ca6d3332` (warm) · `csess-3b202577b4d1` (post-restart) |
| Export | `.codactrl/verify/issue-report/export-manifest.json` |
| Residual | R3 sidebar still “No messages yet” while thread hydrated — separate row |

| Field | Value |
|-------|--------|
| Phase 2 | **EXIT** 2026-07-04 |
| Phase 3 | **EXIT** (installers recorded) |
| Phase 4 | **Local smoke PASS** — Vercel preview gate · then **EXIT** |
| Release prep | **PAUSED** — website public deploy, demo kit, `v2.0.0` tag after Phase 4 smoke |
| Phase 1D row 3 | **DONE** — P3a–d SQLite restart soaks (2026-07-04) |
| Phase 1D row 2 | **DONE (partial)** — SEC §1–§5 signed @ SHA `4d000257` · SEC-V4 **A** @ REL-002 |
| Phase 1D row 1 | **DONE** — lane closure (2026-07-04) |
| Phase 1C | **EXIT 2026-07-04** — rows 1–2 t4 · row 3 **A** · row 4 K-M1 partial + K-M2 t4 |
| Phase 1C row 1 | **VERIFIED t4** — O-2 DM cold restart post Phase 1B |
| Phase 1C row 2 | **VERIFIED t4** — dual-profile group send/receive + COM-RUN-11 invite role matrix |
| COM-RUN-11 matrix (r28) | T1 **Cancel Invitation** · T2 **Accept** + **Decline** on pending re-invite (`cap-31f114ad3167` / `cap-33003c21753b`) |
| Message (t4) | `COM-RUN-11-phase1c-round25-070T0540` · docker `COM-RUN-11-phase1c-docker-070T0717` |
| Phase 1C row 4 | **PARTIAL t3** — K-M1 coordination leave OK · excluded UI missing · K-M2 re-invite **VERIFIED t4** |
| K-M2 rejoin (r30) | T2 Accept · coord `join` seq 4 · dual send `COM-RUN-11-phase1c-rejoin-070T0746` · T2 receive **PASS** (`cap-4c6782ab6716`) |
| Chain | `…` → `n7-k-m2-rejoin-t4` → `n8-phase1d-p3-coldrestart-t3` |
| Sessions | T1 `csess-44f67ea7565d` (`:9230` post cold-restart) · prior T1/T2 `csess-5810c264fdbf` / `csess-abe4b5ce9374` |
| COM-RUN-01 | **Accepted** @ ACC-02 (Phase 1D row 1) — integration study band; no patch |
| Cancelled | COM-RUN-02 repair |

---

## Session status

**Maintainer policy (2026-07-04):** Runtime repair band **EXIT**. Phase 4 website deploy smoke is next; full release prep remains gated on Phase 4 sign-off. PWA remains out of production scope; native desktop/mobile only when feasible.

**Phase 4 — local smoke PASS · Vercel preview gate**

| Row | Status |
|-----|--------|
| W4-1…W4-4 | **Done** · L1 build PASS · local HTTP smoke PASS |
| Editorial P0 | **Done** — `/`, `/download`, `/limitations` editorial lane |
| Deploy smoke | **PASS (local t2)** — `chain-phase4-website-2026-07-04` |
| Vercel preview | **Pending** — maintainer deploy + public URL smoke |

Charter: [obscur-v2-phase4-website-charter.md](../program/obscur-v2-phase4-website-charter.md) — prerequisite **met** (runtime band exit)

**Phase 3 — EXIT (2026-07-04)** · packaging frozen until Phase 4 / release gate

| Row | Result |
|-----|--------|
| P3-1 | Windows NSIS @ `release-assets/windows/Obscur_1.9.10_x64-setup.exe` |
| P3-2 | Unsigned accepted @ [obscur-v2-phase3-signing-policy.md](../program/obscur-v2-phase3-signing-policy.md) |
| P3-3 | Android debug APK built · SHA `04afc48f…` · 292,511,220 bytes · path in [manifest.json](../../release-assets/manifest.json) |

**P3-3 build (2026-07-04):** `pnpm build:android:debug:emulator` (CARGO_BUILD_JOBS=2, Gradle workers=2) · output path in [install/build guide](../program/obscur-v2-install-build-guide.md) · compile fixes: mobile gate on `read_portable_sidecar`, `native_keychain` stubs on Android (**uncommitted**).

**Phase 3 — P3-2 signing policy DONE (2026-07-04)**

| Field | Value |
|-------|--------|
| Policy | **Unsigned accepted** (desktop NSIS + deferred minisign/JKS) |
| Sign-off | [obscur-v2-phase3-signing-policy.md](../program/obscur-v2-phase3-signing-policy.md) |
| Register | P-sign → **A** in [version-roadmap-scope.md](../program/version-roadmap-scope.md) |

**Phase 3 — P3-1 desktop package DONE (2026-07-04)**

| Field | Value |
|-------|--------|
| Command | `pnpm desktop:package` @ commit `4d000257` |
| Artifact | `release-assets/windows/Obscur_1.9.10_x64-setup.exe` (9,065,402 bytes) |
| SHA-256 | `d814ab21c9b927644ec567c9e305bde482a53c1b1b9069b357aa10bdc990813f` |
| Manifest | [release-assets/manifest.json](../../release-assets/manifest.json) |
| Signing | **Unsigned accepted** @ [obscur-v2-phase3-signing-policy.md](../program/obscur-v2-phase3-signing-policy.md) |
| Stale removed | `Obscur_1.9.3_x64-setup.exe` |

**Phase 2 — EXIT (2026-07-04)**

| Row | Task | Status |
|-----|------|--------|
| D2-1 | Canonical index | **Done** |
| D2-2 | `pnpm docs:check` | **Done** |
| D2-3 | Limitations sheet | **Done** |
| D2-4 | SQLite honesty | **Done** |
| D2-5 | Install/build guide | **Done** — [obscur-v2-install-build-guide.md](../program/obscur-v2-install-build-guide.md) |

Charter: [obscur-v2-phase2-docs-charter.md](../program/obscur-v2-phase2-docs-charter.md)

**Phase 1D row 3 — P3a–d SQLite restart soaks DONE (2026-07-04)**

| Gate | Result |
|------|--------|
| L1 `verify:phase2` | **PASS** — 69 tests (P3a/P3b authority contracts) |
| L1 `verify:p5-persistence` | **PASS** — 79 tests · contract drift fixed (`accountSyncChatStatePort`, `vi.hoisted` mock) |
| P3b DM cold restart | **VERIFIED t3** — Phase 1C O-2 t4 + post-kill digest `O2-phase1c-coldrestart-070T0559` (`n8`) |
| P3d community cold restart | **VERIFIED t3** — taskkill → relaunch → key unlock · NewTest 2 sidebar + full thread + **2 members** · `COM-RUN-11-phase1c-rejoin-070T0746` (`cap-a3d28075b2cc`) |
| Chain | `n8-phase1d-p3-coldrestart-t3` |
| Register | P3a–d → **V** in [version-roadmap-scope.md](../program/version-roadmap-scope.md) |

Note: sidebar preview stale (“No messages yet”) while thread hydrate intact — display-only; SQLite read authority OK.

**Phase 1D — EXIT (2026-07-04)** — rows 1–3 complete (row 2 partial SEC-V4 **A**).

**Phase 1D row 2 — SEC maintainer checklist §1–§5 DONE partial (2026-07-04)**

| Gate | Result |
|------|--------|
| SEC-V1 E2EE | **PASS** — `verify-e2ee-boundaries.mjs` (fixed stale `outgoing-dm-publisher` path) |
| SEC-V2 transport/gateway | **PASS** — allowlist + Slice C room-key owner |
| SEC-V3 profile isolation | **PASS** |
| SEC-V4 restore leak | **A** @ REL-002 — 3× AB-15 contract drift |
| SEC relay + trust | **PASS** — 57 + 92 tests |
| SEC-V5 exit contract | **PASS** |
| Checklist | [v1.9.5-security-validation-checklist.md](../archive/program/inactive-2026-06/v1.9.5-security-validation-checklist.md) signed |

**Phase 1D row 1 — Lane closure DONE (2026-07-04)**

Evidence: Phase 1C chain `chain-com-run-11-phase1c-2026-07-04` → `n7-k-m2-rejoin-t4` · register [version-roadmap-scope.md](../program/version-roadmap-scope.md).

| Lane | Flipped | Count |
|------|---------|-------|
| K | K3 **A** · K4 **V** · K5 **A** | 3 |
| C | C-4.1 **V** · C-4.2 **V** | 2 |
| T | REL-001/003/004 **V** · REL-002 **A** · MEM-003/004 **V** · MEM-002/005/006 **A** · MED-001/002 **A** | 11 |

COM-RUN-01 → **Accepted** @ ACC-02 in [unified-verification-issues-register.md](../program/unified-verification-issues-register.md).

**Phase 1C — EXIT (2026-07-04)**

| Row | Outcome |
|-----|---------|
| 1 O-2 DM cold restart | **VERIFIED t4** |
| 2 O-4 / COM-RUN-11 dual-profile | **VERIFIED t4** (rounds 25–28) |
| 3 COM-RUN-01 roster | **A** — PAUSED; integration study |
| 4 K3 leave / re-invite | K-M1 **PARTIAL t3** · K-M2 **VERIFIED t4** (round 30) |

Gate note: `verify:engine-lab` blocked with desktop CDP session running (exe lock); client t4 evidence is authoritative for Phase 1C exit.

**Phase 1C row 4 — K-M2 re-invite VERIFIED t4 (2026-07-04 round 30)**

| Deliverable | Detail |
|-------------|--------|
| T2 Accept | **PASS** — pending invite from r28; toast *Acceptance recorded* (`cap-bca452deb27a`) |
| Coordination | **PASS** — `join` delta **seq 4** for Tester2 pubkey after leave/re-invite |
| T2 group state | Sidebar **NewTest 2** · header **2 members · 2 online** |
| T1 send | **PASS** — `COM-RUN-11-phase1c-rejoin-070T0746` · `ws://localhost:7000` (`cap-4d9a1b952e18`) |
| T2 receive | **PASS** — `client_validate_assert` textVisible (`cap-4c6782ab6716`) |
| Chain | `n7-k-m2-rejoin-t4` |

**Phase 1C row 4 — K3 coordination leave PARTIAL t3 (2026-07-04 round 29)**

| Deliverable | Detail |
|-------------|--------|
| T2 leave (r28) | **PASS** — coordination `leave` delta seq 3 · subject `3db055b4…d946830f` |
| T1 reconcile | **PASS** — toast: 3 coordination updates applied (`cap-b96788c569e6`) |
| T1 participants UI | **FAIL** — Online: Tester1 only; **Excluded from active roster** section absent; `Tester2` not visible (`cap-e88ab266984a`) |
| Coordination API | `GET …/membership/deltas` confirms leave at seq 3 |
| Blocker | Roster display owner — COM-RUN-01 **PAUSED** (integration study, not patch) |
| Chain | `n6-k-m1-leave-partial` |

**Phase 1C row 2 — COM-RUN-11 invite role matrix VERIFIED t4 (2026-07-04 round 28)**

| Deliverable | Detail |
|-------------|--------|
| Setup | T2 **Leave community** → T1 fresh invite (leave-reinvite path; no nuclear purge) |
| T1 inviter | **PASS** — `Cancel Invitation` on pending card (`cap-31f114ad3167`) |
| T2 invitee | **PASS** — `Accept` + `Decline` visible (`cap-33003c21753b` / `cap-1e2f851cbb16`) |
| Chain | `n5-com-run11-invite-matrix` |
| Note | Pending invite live — accept not clicked (matrix captured pre-accept) |

**Phase 1C row 2 — docker relay re-check VERIFIED t4 (2026-07-04 round 27)**

| Deliverable | Detail |
|-------------|--------|
| Stack | Docker relay `pnpm dev:relay:docker` · `nostr-relay-1` on `:7000` after Docker Desktop restart |
| Preflight | `client_stack_preflight` `requireDualWindow: true` → **ready** (7/7) |
| T1 send | **PASS** — `COM-RUN-11-phase1c-docker-070T0717` · publish `ws://localhost:7000` (`cap-50890868b11a`) |
| T2 receive | **PASS** after **Apply operator bundle** (T2 was `1/6` relays until local workspace relay connected) · `cap-cef90daf5c88` |
| Chain | `n4-docker-relay-dual-send` appended |

**Phase 1C row 2 — COM-RUN-11 dual-profile VERIFIED t4 (2026-07-04 round 25)**

| Deliverable | Detail |
|-------------|--------|
| Purge | Nuclear EBWebView wipe both profiles; relay backup still rehydrated NewTest 2 history on unlock |
| Setup | Key re-import · T1 fresh invite → T2 Accept+Decline card · accept recorded |
| T2 invite UX | **PASS** — Accept + Decline on live card (`b4683d19…`); roomKey in DM gift-wrap |
| T1 send | **PASS** — `COM-RUN-11-phase1c-round25-070T0540` (`cap-50f87c2d8e55`) |
| T2 receive | **PASS** — `client_validate_assert` textVisible (`cap-907cd6d9eb14`) |
| T2 group | 2 members · historical + fresh message visible · compose enabled |
| Charter gap | Local/nuclear purge insufficient for clean baseline — relay backup rehydrates community |
| Chain | `n2-fresh-invite-accept` · `n3-dual-send-t4` |
| Register | `verify:issue:agent:3aa8584ac1e8095f` · status **fixed** |

**Phase 1C row 2 — COM-RUN-11 dual-profile PARTIAL t3 (2026-07-04 round 24)** — superseded by round 25 above.

| Deliverable | Detail |
|-------------|--------|
| T1 send | **PASS** — `COM-RUN-11-phase1c-070T0522` |
| T2 receive/send | **FAIL** — `room_key_missing` · chain node `n1-t1-send-t2-no-key` |

**Phase 1C row 1 — O-2 DM cold restart VERIFIED t4 (2026-07-04)**

| Deliverable | Detail |
|-------------|--------|
| Flow | Send `O2-phase1c-coldrestart-070T0559` → `taskkill obscur_desktop_app.exe` → relaunch → password unlock → message visible |
| eventId | `168d95740472995d` |
| Chain | `chain-o2-cold-restart-phase1c-2026-07-04` · `n0-pre-restart-send` → `n1-post-restart-hydrate` |
| Register | `verify:issue:agent:10ae33ad355320dc` · status **fixed** · proof tier **t4** |
| Boot path | `/profiles` → `/sign-in` (password required; no native auto-unlock) |

**Community — Phase 1B Slice C — L3 landed (2026-07-04)** — desktop CDP send after coordination-only key recovery

| Deliverable | Detail |
|-------------|--------|
| Orchestrator | `scripts/slice-c-l3-desktop.mjs` · `pnpm verify:slice-c-l3` |
| Fixture | `scripts/publish-coordination-room-key-wrap-fixture.mjs` + membership join delta before wrap |
| Spec | `apps/pwa/tests/e2e/slice-c-l3-coordination-send.spec.ts` (Playwright CDP `:9230` · shell `:1430`) |
| Pass criteria | Pre-send `localRoomKeyCount=0` · no `room_key_missing_send_blocked` · post-send key materialized · message visible |
| Evidence | `test-results/phase1b-slice-c-l3-2026-07-03.json` — `pass: true` · `invalidEntries: 0` · wrapSeq 7 |
| Digest | Added `groups.coordination_room_key_*` to cross-device digest config (requires shell rebuild for event capture) |
| Exit gate | `pnpm verify:fls-alignment` — **PASS** (0 navigation gate violations) |

**Phase 1B exit recorded (2026-07-04)** — Slice C C1–C5 + L3 + FLS alignment.

**Community — Phase 1B Slice C — C5 landed (2026-07-03)** — invite steward coordination wrap

| Deliverable | Detail |
|-------------|--------|
| Owner | `ensureRoomKeyHexForInviteDistribution` + `publishStewardCoordinationRoomKeyWrapsForInvitees` |
| UI | `invite-connections-dialog` — resolve coordination key before generate; steward wrap per invitee (best-effort) |
| ACL note | Steward wrap requires invitee **active** in coordination; pre-join invites still rely on DM + C2b self-wrap |
| Tests | `community-coordination-room-key-owner.test.ts` (15 pass) |

**Community — Phase 1B Slice C — C4 landed (2026-07-03)** — group-service action-time room-key resolve

| Deliverable | Detail |
|-------------|--------|
| Owner | `group-service.sendSealedMessage` → `resolveRoomKeyForCommunityAction` before fail |
| Flow | local store miss → resolve `communityId` from param/ledger → coordination fetch+materialize → send |
| Kernel | `workspace-kernel-write-port` passes `communityId` into send |
| Tests | `group-service.test.ts` (5 pass) |
| L3 | Requires fixture wrap backfill + cleared local key (C5 steward wrap optional for invitees) |

**Community — Phase 1B Slice C — C3 landed (2026-07-03)** — directory post-refresh room-key materialize

| Deliverable | Detail |
|-------------|--------|
| Hook | `materializeCoordinationRoomKeysAfterDirectoryRefresh` after directory save when materialization changes |
| Context | Optional `roomKeyMaterialization` on `refreshCoordinationMembershipDirectory` |
| Callers | `workspace-kernel-membership-port` create/join · `refreshCommunityMembershipTruth` |
| Policy | Skips when directory unchanged or context missing; resolves `groupId` from ledger when omitted |
| Tests | `community-coordination-membership-directory-store.test.ts` (7 pass) |

**Community — Phase 1B Slice C — C2b landed (2026-07-03)** — self-wrap after create/join

| Deliverable | Detail |
|-------------|--------|
| Hook | `publishSelfCoordinationRoomKeyWrapAfterJoin` called from `workspace-kernel-membership-port` |
| When | After coordination join sync + directory refresh (create + join success paths) |
| Policy | Best-effort — wrap failure does not roll back join; local key still present |
| Tests | `workspace-kernel-membership-join.test.ts` (4 pass) · w1 contract updated |

**Community — Phase 1B Slice C — C2 landed (2026-07-03)** — PWA room-key wrap owner (headless)

| Deliverable | Detail |
|-------------|--------|
| Owner | `community-coordination-room-key-owner.ts` — wrap, publish, fetch, materialize, resolve |
| Scheme | NIP-04 inner JSON `{ v, groupId, roomKeyHex }` + Schnorr wrap signature |
| Telemetry | `groups.coordination_room_key_wrap_published`, `_materialized`, `_resolve` |
| Tests | `community-coordination-room-key-owner.test.ts` (10 pass) |
| Gate | `pnpm vitest run app/features/groups/services/community-coordination-room-key-owner.test.ts` ✓ |

**Community — Phase 1B Slice C — C1 landed (2026-07-03)** — coordination room-key wrap Worker + contracts

| Deliverable | Detail |
|-------------|--------|
| Migration | `apps/coordination/migrations/0003_member_room_key_wraps.sql` |
| Handlers | `membership-room-key-wrap.ts` — POST append + GET list (limit 200, sinceSeq) |
| ACL | `membership-room-key-wrap-acl.ts` — self-wrap + bootstrap steward for active members |
| Contracts | `@dweb/coordination-contracts` — `signRoomKeyWrap` / `verifyRoomKeyWrapSignature` (`obscur.nip04_room_key_wrap.v1`) |
| Tests | `membership-room-key-wrap.test.ts` (10 pass) + directory mock fix |
| Gate | `pnpm -C apps/coordination test` ✓ |

**Community — COM-RUN-02 CANCELLED (2026-07-03)** — room-key restore band abandoned

| Field | Value |
|-------|--------|
| Maintainer decision | Profile-scoped room-key gates + restore/repair loops are **failed design** — cancel band, redesign community crypto |
| Charter | [community-membership-redesign-charter-2026-07.md](../program/community-membership-redesign-charter-2026-07.md) |
| Subtracted | UI no longer blocks chat/invite on missing local key; invite send may generate key at action time (interim) |
| Do not | Patch `room-key-restore-repair`, health cascade gates, or COM-RUN-02 investigation closeout |

**Community — COM-RUN-02 room key restore band (2026-07-03)** — ~~group chat unblock after recovery~~ **superseded by cancellation above**

**Community — maintainer manual L4 Pass (2026-06-25)** — NewTest 2 managed workspace runtime band

| Field | Value |
|-------|--------|
| Maintainer sign-off | **Pass** — manual verification passed (2026-06-25) |
| Git SHA | `4d000257` (last commit) + **uncommitted** community slice (health subtraction, relay bootstrap, kind-5 delete ingest) |
| Fixture | NewTest 2 · `ws://localhost:7000` · `managed_workspace` · full-stack (`pnpm dev:desktop:online`) |
| Verified | Sealed group **send** (COM-MEM-2 §3 step 6); **Remove from workspace** delete e2e (kind 5 ingest); community home/chat/invite when room key present (COM-RUN-04 UX subtraction) |
| Not re-recorded this sign-off | COM-MEM-2 steps 3–4 (invite/join), 7 (cold restart), 8 (leave/re-invite); COM-MSG cold restart; roster parity (deprioritized per [membership-graph-integration-study-2026-06.md](../program/membership-graph-integration-study-2026-06.md)) |
| L1 proof | `group-thread-relay-ingest.test.ts` (kind-5 suppress path); membership UI action policy tests |
| Next | Optional: record steps 3–4 / 7–8 in [COM-MEM-2 spec](../archive/program/inactive-2026-06/community-verification-com-mem-2-spec-2026-06.md) for full **V** on K3–K5 |

**Conduit Mesh — C6 nostr_ws driver landed** — optional NIP wire adapter + headless wire port

| Deliverable | Detail |
|-------------|--------|
| Added | [conduit-mesh-c6-nostr-ws-charter.md](../program/conduit-mesh-c6-nostr-ws-charter.md) |
| Added | `NOSTR_WS_CONDUIT_WIRE_V1`, `createNostrWsConduitDriver`, `createInMemoryNostrWsWire` |
| Gate | `pnpm verify:conduit-mesh-c6` ✓ |

**Conduit Mesh — C5 pool retirement landed** — W53 parity harness + mesh pool hook

| Deliverable | Detail |
|-------------|--------|
| Added | [conduit-mesh-c5-pool-retirement-charter.md](../program/conduit-mesh-c5-pool-retirement-charter.md) |
| Added | `runW53SmokeParityHarness`, `useConduitMeshRelayPool`, `NEXT_PUBLIC_OBSCUR_CONDUIT_MESH_POOL` |
| Gate | `pnpm verify:conduit-mesh-c5` ✓ |

**Conduit Mesh — C4 adapter wiring landed** — team_relay + coordination_http drivers + in-memory fetch router

| Deliverable | Detail |
|-------------|--------|
| Added | [conduit-mesh-c4-adapter-wiring-charter.md](../program/conduit-mesh-c4-adapter-wiring-charter.md) |
| Added | `custom-http`, `team-relay`, `coordination-http` conduit drivers; `createConduitDriverFromDescriptor` |
| Gate | `pnpm verify:conduit-mesh-c4` |

**Conduit Mesh — C3 Tor policy landed** — fail-closed `tor_required`, probe integration spec

| Deliverable | Detail |
|-------------|--------|
| Added | [conduit-mesh-c3-tor-policy-charter.md](../program/conduit-mesh-c3-tor-policy-charter.md) |
| Added | [conduit-mesh-c3-tor-probe-integration.md](../program/conduit-mesh-c3-tor-probe-integration.md) |
| Added | `tor-policy.ts` in contracts; runtime `getTorState` wiring |
| Gate | `pnpm verify:conduit-mesh-c3` |

**Conduit Mesh — C2 headless runtime landed** — `@obscur/conduit-mesh` lane switch + evidence ledger

| Deliverable | Detail |
|-------------|--------|
| Added | [conduit-mesh-c2-runtime-charter.md](../program/conduit-mesh-c2-runtime-charter.md) |
| Added | `packages/obscur-conduit-mesh` — `createConduitMesh`, mock drivers, snapshot builder |
| Gate | `pnpm verify:conduit-mesh-c2` |

**Conduit Mesh — C1 contracts landed** — `@obscur/conduit-mesh-contracts` types + verify gate

| Deliverable | Detail |
|-------------|--------|
| Added | [conduit-mesh-c1-contracts-charter.md](../program/conduit-mesh-c1-contracts-charter.md) |
| Added | `packages/obscur-conduit-mesh-contracts` — Envelope, Evidence, ConduitDescriptor, MeshSnapshot, MeshPort, custom HTTP v1 |
| Gate | `pnpm verify:conduit-mesh-c1` |

**Conduit Mesh — experimental transport concept (design only)**

| Deliverable | Detail |
|-------------|--------|
| Added | [obscur-conduit-mesh-concept-2026-06.md](../program/obscur-conduit-mesh-concept-2026-06.md) — post-relay fabric: multi-media conduits, evidence ledger, lane switching, Tor policy |
| Pivot | Resume dev on **network infrastructure**; community/member sync and W53 deletion **set aside** until mesh slice C1+ |
| Band | ENGINE-LAB experimental — conceptual only; no implementation charter yet |

**UI reconnect — desktop static build green** — fixed PWA build blockers for kernel strict-mode desktop test

| Deliverable | Detail |
|-------------|--------|
| Fixed | Duplicate import (`dm-controller`), client-safe `@obscur/engine-host/tauri` imports, build type drift |
| Fixed | `relay-runtime-supervisor` debounce field, `transport-kernel-recovery-port` reason codes |
| Added | `@dweb/auth` dep on `@obscur/engine-host` |
| Gate | `pnpm -C apps/pwa build:static` green |
| Dev | `pnpm dev:desktop:transport-smoke` (W53 env + online stack) |

**Default order — maintainer manual band** — W53 smoke + kernel UI integration test tooling

| Deliverable | Detail |
|-------------|--------|
| Added | `scripts/dev-desktop-transport-smoke.mjs` · `pnpm dev:desktop:transport-smoke` |
| Added | [obscur-kernel-ui-desktop-test-checklist.md](../program/obscur-kernel-ui-desktop-test-checklist.md) |
| Updated | [CURRENT.md](../CURRENT.md), [.env.example](../../apps/pwa/.env.example), [ARCHIVED-UI.md](../../apps/pwa/ARCHIVED-UI.md) |
| Gate | `pnpm verify:standalone-legacy-subtraction-prep` · `pnpm docs:check` |

**Verify alias consolidation** — all `verify:transport-engine-w0`–`w68` point to flat script; W53 maintainer runbook added

| Deliverable | Detail |
|-------------|--------|
| Updated | `package.json` — w0–w68 + `verify:transport-engine` → `scripts/verify-transport-engine.mjs` |
| Added | [transport-engine-w53-maintainer-smoke-runbook.md](../program/transport-engine-w53-maintainer-smoke-runbook.md) |
| Updated | Sign-off template/record — pre-flight gate `verify:transport-engine-w68` |
| Gate | `pnpm verify:transport-engine-w53` (alias) · `pnpm docs:check` |

**Docs hygiene** — `docs:check` green after legacy-subtraction link repairs

| Deliverable | Detail |
|-------------|--------|
| Fixed | [obscur-native-sqlite-policy.md](../program/obscur-native-sqlite-policy.md) — `chat-state-store-legacy`, `hydrate-indexed-scan`, `group-provider-port` |
| Fixed | [CHANGELOG.md](../../CHANGELOG.md), [v1.9.10-release.md](../releases/v1.9.10-release.md) — v1.9.8 checklist archive path |
| Gate | `pnpm docs:check` |

**Docs + changelog checkpoint** — kernel refactoring status documented; prep band indexed; redundant w55–w59 nested verify chains removed

| Deliverable | Detail |
|-------------|--------|
| Added | [transport-engine-standalone-legacy-subtraction-index.md](../program/transport-engine-standalone-legacy-subtraction-index.md) |
| Updated | [CURRENT.md](../CURRENT.md), [CHANGELOG.md](../../CHANGELOG.md), [obscur-backend-engine-roadmap.md](../program/obscur-backend-engine-roadmap.md), [program/README.md](../program/README.md) |
| Updated | `verify:transport-engine-w55`–`w59` → flat script (was nested pnpm chain) |
| Assessment | B0–B5 + transport w0–w54 + prep w55–w68 **complete**; physical legacy deletion **blocked** on W53 smoke |
| Gate | `pnpm verify:transport-engine-w68` · `pnpm verify:standalone-legacy-subtraction-prep` |

**transport-engine-w68 complete** — prep band w55–w67 closed; sign-off `BLOCKED`; band **PAUSED** awaiting W53 smoke; `verify:transport-engine-w68` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-deletion-subtraction-prep-band-closure-readiness.ts` |
| Added | `transport-engine-w68-standalone-legacy-subtraction-prep-band-closure.md` |
| Added | `scripts/verify-standalone-legacy-subtraction-prep.mjs` (read-only prep report) |
| Updated | Pre-deletion dry-run requires `prepBandClosureReady` |
| Preserved | Production `-legacy.ts`, facade, gate-closed pins (gate closed) |
| Gate | `verify:transport-engine-w68` (flat script; included in `verify:engine-lab`) |

**transport-engine-w67 complete** — B5 exit verification criteria pinned; sign-off `BLOCKED`; exit not complete; `verify:transport-engine-w67` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-deletion-b5-exit.ts` — 6 exit criteria |
| Added | `transport-kernel-standalone-deletion-b5-exit-readiness.ts` |
| Added | `transport-engine-w67-standalone-legacy-b5-exit-verification.md` |
| Updated | Pre-deletion dry-run requires `b5ExitVerificationReady` |
| Preserved | Production `-legacy.ts`, facade, gate-closed pins (gate closed) |
| Gate | `verify:transport-engine-w67` (flat script; included in `verify:engine-lab`) |

**transport-engine-w66 complete** — mechanical subtraction commit manifest pinned; sign-off `BLOCKED`; no execution; `verify:transport-engine-w66` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-deletion-mechanical-subtraction-commit.ts` — 7-step commit manifest |
| Added | `transport-kernel-standalone-deletion-mechanical-subtraction-commit-readiness.ts` |
| Added | `transport-engine-w66-standalone-legacy-mechanical-subtraction-commit.md` |
| Updated | Pre-deletion dry-run requires `mechanicalSubtractionCommitReady` |
| Preserved | Production `-legacy.ts`, facade, gate-closed pins (gate closed) |
| Gate | `verify:transport-engine-w66` (flat script; included in `verify:engine-lab`) |

**transport-engine-w65 complete** — gate-closed existence pin migration manifest pinned; sign-off `BLOCKED`; no pin flip; `verify:transport-engine-w65` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-deletion-existence-pin-migration.ts` — w55–w64 pin inventory |
| Added | `transport-kernel-standalone-deletion-existence-pin-migration-readiness.ts` |
| Added | `transport-engine-w65-standalone-legacy-existence-pin-migration.md` |
| Updated | Pre-deletion dry-run requires `existencePinMigrationReady` |
| Preserved | Production `-legacy.ts`, facade, gate-closed pin assertions (gate closed) |
| Gate | `verify:transport-engine-w65` (flat script; included in `verify:engine-lab`) |

**transport-engine-w64 complete** — thin port template + post-subtraction baseline pinned; sign-off `BLOCKED`; no production deletion; `verify:transport-engine-w64` green

| Deliverable | Detail |
|-------------|--------|
| Added | `relay-standalone-publish-port-thin.ts` — frozen post-deletion port body |
| Added | `transport-kernel-standalone-deletion-post-subtraction-baseline.ts` |
| Added | `transport-engine-w64-standalone-legacy-production-deletion-execution.md` |
| Updated | Pre-deletion dry-run requires thin port template readiness |
| Preserved | Production `-legacy.ts`, facade, current port legacy import (gate closed) |
| Gate | `verify:transport-engine-w64` (flat script; included in `verify:engine-lab`) |

**transport-engine-w63 complete** — port delegates to subtracted module when deletion env is on; sign-off `BLOCKED`; no production deletion; `verify:transport-engine-w63` green

| Deliverable | Detail |
|-------------|--------|
| Added | `shouldRouteSubtractedStandalonePublishPort()` + port delegation wiring |
| Added | `execute-transport-standalone-legacy-subtraction.mjs` maintainer gate script |
| Added | `transport-engine-w63-standalone-legacy-port-swap-rehearsal.md` |
| Preserved | Production `-legacy.ts`, facade, default port legacy path (gate closed) |
| Gate | `verify:transport-engine-w63` (flat script; included in `verify:engine-lab`) |

**transport-engine-w62 complete** — subtracted port module pinned; sign-off `BLOCKED`; no production deletion; `verify:transport-engine-w62` green

| Deliverable | Detail |
|-------------|--------|
| Added | `relay-standalone-publish-port-subtracted.ts` + unit tests |
| Added | `transport-engine-w62-standalone-legacy-mechanical-production-subtraction.md` |
| Updated | Dry-run baseline requires subtracted port without legacy import |
| Preserved | Production `-legacy.ts`, facade, current port legacy import (gate closed) |
| Gate | `verify:transport-engine-w62` (flat script; included in `verify:engine-lab`) |

**transport-engine-w61 complete** — archive-aware contract read pins migrated; sign-off `BLOCKED`; no production deletion; `verify:transport-engine-w61` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-standalone-legacy-contract-read.ts` |
| Added | `transport-engine-w61-standalone-legacy-production-deletion-execution.md` |
| Migrated | w14/w15/w19/w23/w40/w47/w52/w55 semantic reads to archive-aware resolver |
| Preserved | Production `-legacy.ts`, facade, port legacy import (gate closed) |
| Gate | `verify:transport-engine-w61` (flat script; included in `verify:engine-lab`) |

**verify:engine-lab green** — flat `scripts/verify-transport-engine.mjs` replaces nested w60 chain; harness mocks updated for w57 blocked path; full gate passes on Windows

| Fix | Detail |
|-----|--------|
| Added | `scripts/verify-transport-engine.mjs` — flat w0–w60 vitest + cargo gate |
| Updated | `verify:transport-engine-w60` → flat script (no nested `pnpm` chain) |
| Updated | w35/w39/w50 harness mocks — `shouldBlockStandaloneLegacyPublishFallback` |

**engine-lab contract drift fixed** — w40 chat-state import pin + workspace-kernel w0/w4 exit contracts now read `workspace-kernel-manifest.md`; `verify:legacy-subtraction` and `verify:workspace-kernel` green

| Fix | Detail |
|-----|--------|
| Updated | `legacy-subtraction-w40.contract.test.ts` — accept features-path `chat-state-store-legacy` import |
| Updated | `workspace-kernel-w0-exit` + `w4-exit` — manifest is canonical proof surface, not `current-session.md` |

**transport-engine-w60 complete** — legacy archive fixture + contract-pin resolver; sign-off `BLOCKED`; no production deletion; `verify:transport-engine-w60` green

| Deliverable | Detail |
|-------------|--------|
| Added | `engine-lab/fixtures/transport-kernel-standalone-publish-legacy.archive.ts` |
| Added | `transport-kernel-standalone-deletion-contract-pins.ts` |
| Added | `transport-engine-w60-standalone-legacy-mechanical-deletion-preparation.md` |
| Updated | Dry-run requires archive present in baseline |
| Preserved | Production `-legacy.ts`, facade, port legacy import (gate closed) |
| Gate | `verify:transport-engine-w60` (now included in `verify:engine-lab`) |

**transport-engine-w59 complete** — subtraction dry-run baseline green; sign-off `BLOCKED`; no file deletion; `verify:transport-engine-w59` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-deletion-subtraction-dry-run.ts` |
| Added | `transport-engine-w59-standalone-legacy-physical-deletion-execution.md` |
| Updated | Manifest includes w58 contract pins |
| Baseline | Dry-run ready; `readyForPhysicalDeletion` false until gate opens |
| Preserved | `-legacy.ts`, facade, port legacy import (gate closed) |
| Gate | `verify:transport-engine-w59` (now included in `verify:engine-lab`) |

**transport-engine-w58 complete** — subtraction manifest pinned; sign-off `BLOCKED`; no file deletion; `verify:transport-engine-w58` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-deletion-subtraction-manifest.ts` |
| Added | `transport-engine-w58-standalone-legacy-file-deletion-execution.md` |
| Documented | Deletion targets, port paths, contract migrations, preserved semantics owner |
| Preserved | `-legacy.ts`, facade, port legacy import (gate closed) |
| Gate | `verify:transport-engine-w58` (now included in `verify:engine-lab`) |

**transport-engine-w57 complete** — fail-closed port wired for deletion approval env; sign-off `BLOCKED`; no file deletion; `verify:transport-engine-w57` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-publish-blocked.ts` + subtraction charter |
| Added | `shouldBlockStandaloneLegacyPublishFallback()` in publish-port |
| Updated | `relay-standalone-publish-port.ts` — blocked path before legacy fallback |
| Preserved | `-legacy.ts`, facade, port legacy import (gate closed) |
| Gate | `verify:transport-engine-w57` (now included in `verify:engine-lab`) |

**transport-engine-w56 complete** — deletion execution gate implemented; sign-off `BLOCKED`; no file deletion; `verify:transport-engine-w56` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-deletion-gate.ts` + execution charter |
| Added | `transport-engine-smoke-sign-off-recorded.md` (`Decision: BLOCKED`) |
| Gate | PASS sign-off + `NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED=1` |
| Preserved | `-legacy.ts`, facade, port fallback unchanged |
| Gate | `verify:transport-engine-w56` (now included in `verify:engine-lab`) |

**transport-engine-w55 complete** — deletion charter (design-only); `verify:transport-engine-w55` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w55-standalone-legacy-deletion-charter.md` |
| Documented | Deletion gate (W54 PASS + W48 + smoke + W56 approval) |
| Preserved | `-legacy.ts`, facade, port fallback import unchanged |
| Gate | `verify:transport-engine-w55` (now included in `verify:engine-lab`) |

**transport-engine-w54 complete** — smoke sign-off template; `verify:transport-engine-w54` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w54-smoke-evidence-sign-off-template-charter.md` |
| Added | `docs/handoffs/transport-engine-smoke-sign-off-template.md` (unfilled template) |
| Preserved | No smoke execution; no `Decision: PASS` in handoff; no standalone deletion |
| Gate | `verify:transport-engine-w54` (now included in `verify:engine-lab`) |

**transport-engine-w53 complete** — live desktop publish smoke charter; `verify:transport-engine-w53` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w53-live-desktop-publish-smoke-charter.md` |
| Documented | Authority + network env matrix + 8-step manual smoke checklist |
| Preserved | Gates off by default; no standalone deletion; no automation |
| Gate | `verify:transport-engine-w53` (now included in `verify:engine-lab`) |

**transport-engine-w52 complete** — standalone quarantined to `-legacy.ts`; `verify:transport-engine-w52` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-publish-legacy.ts` (implementation owner) |
| Added | Facade `transport-kernel-standalone-publish.ts` (re-exports) |
| Wired | `relay-standalone-publish-port.ts` imports from `-legacy` |
| Added | `transport-engine-w52-standalone-owner-quarantine-execution.md` + contract |
| Preserved | Export names; gates off by default; no deletion |
| Gate | `verify:transport-engine-w52` (now included in `verify:engine-lab`) |

**transport-engine-w51 complete** — quarantine charter (design-only); `verify:transport-engine-w51` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w51-standalone-owner-quarantine-charter.md` |
| Documented | W52 quarantine target (`-legacy` rename) + preconditions |
| Preserved | `transport-kernel-standalone-publish.ts` at current path; port imports unchanged |
| Gate | `verify:transport-engine-w51` (now included in `verify:engine-lab`) |

**transport-engine-w50 complete** — authority gate wired into port via `shouldRouteHostTransportPublish`; `verify:transport-engine-w50` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w50-authority-gated-port-host-routing.md` + contract + harness |
| Wired | `relay-standalone-publish-port.ts` routes host when authority or shim gate on |
| Added | `shouldRouteHostTransportPublish()` combiner in publish-port policy |
| Preserved | Gates off by default; no standalone deletion; no silent fallback |
| Gate | `verify:transport-engine-w50` (now included in `verify:engine-lab`) |

**transport-engine-w49 complete** — Phase D authority gate policy defined; `verify:transport-engine-w49` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w49-maintainer-gated-port-default-flip-charter.md` |
| Added | `shouldUseHostTransportPublishAuthority()` in `transport-kernel-publish-port.ts` |
| Preserved | Port routes standalone by default; shim unchanged; no authority flip |
| Gate | `verify:transport-engine-w49` (now included in `verify:engine-lab`) |

**transport-engine-w48 complete** — W41 exit evidence review + maintainer gate documented; Phase D flip remains PAUSED; `verify:transport-engine-w48` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w48-pre-authority-flip-exit-evidence-review.md` |
| Mapped | W41 checklist items → W24–W47 evidence + verify gates |
| Documented | Maintainer gate + subtraction plan (not executed) |
| Preserved | Port default standalone; shim off; no authority flip |
| Gate | `verify:transport-engine-w48` (now included in `verify:engine-lab`) |

**transport-engine-w47 complete** — network publish parity harness compares standalone owner vs host shim on fixture sets; `verify:transport-engine-w47` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w47-network-publish-parity-harness-charter.md` |
| Added | `transport-engine-network-publish-parity.ts` harness helpers |
| Added | Contract + harness (quorum_not_met, relay_degraded, full-success fixtures) |
| Preserved | Standalone owner canonical; shim gate off; no authority flip |
| Gate | `verify:transport-engine-w47` (now included in `verify:engine-lab`) |

**transport-engine-w46 complete** — `@obscur/engine-host` routes `publishRelayEvent` to async `engine_invoke_transport_publish_relay_event` when network lab env is on; `verify:transport-engine-w46` green

| Deliverable | Detail |
|-------------|--------|
| Added | `shouldRouteTransportPublishToAsyncDesktopCommand` + routing in `tauri-engine-host.ts` |
| Added | `transport-engine-w46-ts-host-async-publish-routing-charter.md` + contract + harness |
| Behavior | Network env on → async desktop relay pool path; off → sync dry-run `engine_invoke` |
| Preserved | Shim gate off by default; standalone owner canonical; no authority flip |
| Gate | `verify:transport-engine-w46` (now included in `verify:engine-lab`) |

**transport-engine-w45 complete** — desktop async `engine_invoke_transport_publish_relay_event` injects `RelayPool` attempts into libobscur network assembly; `verify:transport-engine-w45` green

| Deliverable | Detail |
|-------------|--------|
| Added | `assemble_transport_publish_relay_event_network_with_attempts` public API in `engine_invoke.rs` |
| Added | `commands/transport_engine.rs` — async command mirrors `protocol_publish_with_quorum` attempt loop |
| Added | `transport-engine-w45-desktop-async-publish-command-charter.md` + contract |
| Behavior | Network env on + desktop async command → real relay pool evidence; sync `engine_invoke` still headless |
| Preserved | Dry-run default; shim off; standalone owner canonical; TS host routing deferred to W46 |
| Gate | `verify:transport-engine-w45` (now included in `verify:engine-lab`) |

**transport-engine-w44 complete** — desktop relay pool injection charter (design); `verify:transport-engine-w44` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w44-desktop-relay-pool-injection-charter.md` + contract |
| Pinned | W43 headless collector remains for sync path; `protocol_publish_with_quorum` preserved |
| Gate | `verify:transport-engine-w44` |

**transport-engine-w43 complete** — Rust network publish wired via `publish_with_quorum_attempts` behind lab gate; `verify:transport-engine-w43` green

| Deliverable | Detail |
|-------------|--------|
| Added | `assemble_transport_publish_relay_event_network` + quorum report mapper in `engine_invoke.rs` |
| Added | `transport-engine-w43-rust-network-publish-protocol-wiring.md` + harness parity |
| Behavior | Network env on → protocol assembly with headless `No writable relay connection` attempts |
| Preserved | Dry-run default; shim off; standalone owner canonical |
| Gate | `verify:transport-engine-w43` (now included in `verify:engine-lab`) |

**transport-engine-w42 complete** — Rust network publish lab gate + env-gated dispatch stub; `verify:transport-engine-w42` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w42-rust-network-publish-lab-gate-charter.md` |
| Added | `is_transport_host_publish_network_enabled` + `dispatch_transport_publish_relay_event` in `engine_invoke.rs` |
| Added | Network env on → `transport_publish_network_not_wired`; default → dry-run assembly |
| Added | TS mirror `isTransportHostPublishNetworkEnvEnabled()` + harness |
| Preserved | No network I/O; shim off by default; standalone owner canonical |
| Gate | `verify:transport-engine-w42` (now included in `verify:engine-lab`) |

**transport-engine-w40–w41 complete (accelerated batch)** — network publish wiring charter + pre-authority-flip exit charter; `verify:transport-engine-w41` green

| Wave | Deliverable |
|------|-------------|
| **w40** | `transport-engine-w40-rust-network-publish-wiring-charter.md` — protocol `publish_with_quorum_attempts` wiring plan |
| **w41** | `transport-engine-w41-pre-authority-flip-exit-charter.md` — exit checklist before port authority flip |

| Preserved | Dry-run assembly remains active; shim off by default; standalone owner canonical |
| Gate | `verify:transport-engine-w41` (now included in `verify:engine-lab`) |

**transport-engine-w38–w39 complete (accelerated batch)** — engine-lab shim gate + integration harness; `verify:transport-engine-w39` green

| Wave | Deliverable |
|------|-------------|
| **w38** | `transport-engine-w38-engine-lab-shim-gate-charter.md` + three-part `shouldUseHostTransportPublishShim` policy |
| **w39** | Integration charter + harness (port → shim → dry-run quorum failure shape) |

| Gate policy | `isEngineLabStrictMode()` + `isTransportKernelPublishOwner()` + `NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM=1` |
| Preserved | Shim off by default; standalone owner remains production default; Rust dry-run only |
| Gate | `verify:transport-engine-w39` (now included in `verify:engine-lab`) |

**transport-engine-w37 complete** — Rust dry-run result assembly for valid `publishRelayEvent` invokes; `verify:transport-engine-w37` green

| Deliverable | Detail |
|-------------|--------|
| Added | `assemble_transport_publish_relay_event_dry_run` in `engine_invoke.rs` — structured per-relay failures, no network I/O |
| Added | `transport-engine-w37.contract.test.ts` + harness parity (`quorum_not_met` alignment) |
| Preserved | Shim gate default off; standalone owner remains default port routing |
| Gate | `verify:transport-engine-w37` (now included in `verify:engine-lab`) |

**transport-engine-w33–w36 complete (accelerated batch)** — port shim charter + policy gate + gated shim wiring + dry-run assembly charter; `verify:transport-engine-w36` green

| Wave | Deliverable |
|------|-------------|
| **w33** | `transport-engine-w33-host-publish-port-shim-charter.md` + contract |
| **w34** | `shouldUseHostTransportPublishShim()` policy gate (default `false`) |
| **w35** | `transport-kernel-host-publish-shim.ts` + gated routing in `relay-standalone-publish-port.ts` + harness |
| **w36** | `transport-engine-w36-rust-publish-dry-run-assembly-charter.md` (design-only) |

| Preserved | Shim gate default off; Rust valid invokes still `transport_publish_not_wired`; standalone owner remains default |
| Gate | `verify:transport-engine-w36` (now included in `verify:engine-lab`) |

**transport-engine-w29–w32 complete (accelerated batch)** — parity harness exit + migration charter pins + Rust payload validation + result assembly charter; `verify:transport-engine-w32` green

| Wave | Deliverable |
|------|-------------|
| **w29** | `transport-engine-w29-publish-parity-harness-exit-charter.md` + contract pinning W24–W28 harness exit |
| **w30** | Contract pinning existing `transport-engine-w30-host-publish-owner-migration-charter.md` |
| **w31** | Rust `invalid_payload` validation for `publishRelayEvent` + charter + harness + cargo tests |
| **w32** | `transport-engine-w32-rust-publish-result-assembly-charter.md` (design-only; no assembly impl) |

| Preserved | Rust valid invokes still `transport_publish_not_wired`; port still routes to `transport-kernel-standalone-publish.ts` |
| Gate | `verify:transport-engine-w32` (now included in `verify:engine-lab`) |

**transport-engine-w28 complete** — mocked `transport_publish_invoke_failed` host invoke path in parity harness; `verify:transport-engine-w28` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w28.contract.test.ts` — typed adapter fails closed on generic invoke errors as `transport_publish_invoke_failed` |
| Added | Invoke request round-trip + default message fallback when host omits `errorMessage` |
| Preserved | Rust `publishRelayEvent` remains `transport_publish_not_wired`; no runtime owner/authority changes |
| Gate | `verify:transport-engine-w28` (now included in `verify:engine-lab`) |

**transport-engine-w27 complete** — mocked `transport_publish_not_wired` host invoke path in parity harness; `verify:transport-engine-w27` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w27.contract.test.ts` — typed adapter fails closed on `transport_publish_not_wired` |
| Added | Invoke request round-trip + explicit not-wired error message preservation |
| Preserved | Rust `publishRelayEvent` remains `transport_publish_not_wired`; no runtime owner/authority changes |
| Gate | `verify:transport-engine-w27` (now included in `verify:engine-lab`) |

**transport-engine-w26 complete** — mocked valid host-result acceptance path in parity harness; `verify:transport-engine-w26` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w26.contract.test.ts` — well-formed `TransportPublishRelayEventResult` accepted via typed host adapter |
| Added | Invoke request round-trip assertion (`buildTransportPublishRelayEventRequest`) + shared mapper parity on accepted result |
| Preserved | Rust `publishRelayEvent` remains `transport_publish_not_wired`; no runtime owner/authority changes |
| Gate | `verify:transport-engine-w26` (now included in `verify:engine-lab`) |

**transport-engine-w25 complete** — parity harness extended with reason/status fixtures + invalid-shape rejection; `verify:transport-engine-w25` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w25.contract.test.ts` — `quorum_not_met` + `relay_degraded` reason/status parity fixtures |
| Added | Mocked-host invalid-shape rejection test (`transport_publish_invalid_result`) |
| Preserved | Rust `publishRelayEvent` remains `transport_publish_not_wired`; no runtime owner/authority changes |
| Gate | `verify:transport-engine-w25` (now included in `verify:engine-lab`) |

**transport-engine-w24 complete** — first executable headless publish parity harness slice landed (fixture parity + fail-closed host path); `verify:transport-engine-w24` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-w24.contract.test.ts` — executable fixture parity for normalization + quorum/result fields |
| Added | Headless fail-closed assertion: `publishRelayEventViaTransportEngineHost(...)` returns `transport_engine_host_unavailable` outside Tauri |
| Preserved | Rust `publishRelayEvent` remains `transport_publish_not_wired`; no runtime owner/authority changes |
| Gate | `verify:transport-engine-w24` (now included in `verify:engine-lab`) |

**transport-engine-w23 complete** — headless publish parity harness charter pinned; runtime owners unchanged; `verify:transport-engine-w23` green

| Deliverable | Detail |
|-------------|--------|
| Added | `docs/program/transport-engine-w23-publish-parity-harness-charter.md` — parity harness dimensions + constraints |
| Added | `transport-engine-w23.contract.test.ts` — pins parity charter, semantic baseline owners, and Rust not-wired stub |
| Preserved | Standalone publish owner + shared outcome mapper remain baseline semantics; no authority/runtime wiring changes |
| Gate | `verify:transport-engine-w23` (now included in `verify:engine-lab`) |

**transport-engine-w22 complete** — Rust host publish wiring charter pinned; runtime remains stubbed; `verify:transport-engine-w22` green

| Deliverable | Detail |
|-------------|--------|
| Added | `docs/program/transport-engine-w22-host-publish-rust-charter.md` — Rust-side wiring responsibilities + constraints |
| Added | `transport-engine-w22.contract.test.ts` — asserts charter presence + keeps `transport_publish_not_wired` stub intact |
| Preserved | `engine_invoke.rs` `publishRelayEvent` branch still returns `transport_publish_not_wired` (no wiring yet) |
| Gate | `verify:transport-engine-w22` (now included in `verify:engine-lab`) |

**transport-engine-w21 complete** — typed host adapter for publishRelayEvent added; still non-wired at runtime; `verify:transport-engine-w21` green

| Deliverable | Detail |
|-------------|--------|
| Added | `publishRelayEventViaTransportEngineHost(...)` in `features/transport-kernel/transport-engine-host-port.ts` — parses `EngineInvokeResult.data` into `TransportPublishRelayEventResult` |
| Added | `TransportPublishRelayEventHostResult` union type with explicit error codes (`transport_engine_host_unavailable`, `transport_publish_not_wired`, `transport_publish_invalid_result`, `transport_publish_invoke_failed`) |
| Added | `transport-engine-w21.contract.test.ts` — pins typed adapter + fail-closed behavior; asserts Rust stub remains not wired |
| Gate | `verify:transport-engine-w21` (now included in `verify:engine-lab`) |

**transport-engine-w20 complete** — publishRelayEvent result/evidence contract pinned (types + export + contract test); no wiring; `verify:transport-engine-w20` green

| Deliverable | Detail |
|-------------|--------|
| Added | `TransportPublishRelayEventResult` + `TransportPublishRelayEventRelayResult` in `packages/obscur-engine-contracts/src/transport-engine-methods.ts` |
| Added | `isTransportPublishRelayEventResult(...)` type guard exported from `@obscur/engine-contracts` |
| Added | `transport-engine-w20.contract.test.ts` — pins result/evidence contract as contract-only slice |
| Gate | `verify:transport-engine-w20` (now included in `verify:engine-lab`) |

**transport-engine-w19 complete** — host publish parity verification charter + contract pinned; no wiring; `verify:transport-engine-w19` green

| Deliverable | Detail |
|-------------|--------|
| Added | `docs/program/transport-engine-w19-host-publish-parity-charter.md` — defines parity obligations before wiring |
| Added | `transport-engine-w19.contract.test.ts` — pins charter + shared mapper owner + not-wired stub |
| Gate | `verify:transport-engine-w19` (now included in `verify:engine-lab`) |

**transport-engine-w18 complete** — non-wired transport host publish invoke surface landed at the desktop + host boundary; runtime owner unchanged; `verify:transport-engine-w18` green

| Deliverable | Detail |
|-------------|--------|
| Added | `invokeTransportPublishRelayEvent(...)` in `features/transport-kernel/transport-engine-host-port.ts` |
| Added | `transport-engine-w18.contract.test.ts` — pins host helper + desktop `engine_invoke` surface |
| Stubbed | `packages/libobscur/src/engine_invoke.rs` recognizes `publishRelayEvent` and returns `transport_publish_not_wired` |
| Preserved | `transport-kernel-standalone-publish.ts` remains canonical native runtime owner; no host publish wiring yet |
| Gate | `verify:transport-engine-w18` (now included in `verify:engine-lab`) |

**transport-engine-w17 complete** — transport-engine host publish contract slice landed (types + request builder + validation), still non-wired at runtime; `verify:transport-engine-w17` green

| Deliverable | Detail |
|-------------|--------|
| Added | `publishRelayEvent` to `TRANSPORT_ENGINE_METHODS` |
| Added | `TransportPublishRelayEventPayload` + `buildTransportPublishRelayEventRequest` |
| Added | `validateEngineInvokeRequest` rules for `publishRelayEvent` (`relayUrls` + `payload`) |
| Preserved | No runtime wiring yet; transport-kernel standalone owner remains canonical native path |
| Contract | `transport-engine-w17.contract.test.ts` |
| Gate | `verify:transport-engine-w17` (included in `verify:engine-lab`) |

**transport-engine-w16 complete** — host publish promotion explicitly deferred by charter with migration criteria; `verify:transport-engine-w16` green

| Deliverable | Detail |
|-------------|--------|
| Added | `docs/program/transport-engine-w16-host-publish-charter.md` — explicit defer decision + migration plan + exit criteria |
| Added | `transport-engine-w16.contract.test.ts` — pins defer decision + read-only host method catalog |
| Preserved | `transport-engine-methods.ts` remains read-only (`listRelayCheckpoints`, `listConfiguredRelayUrls`) in this wave |
| Gate | `verify:transport-engine-w16` (included in `verify:engine-lab`) |

**transport-engine-w15 complete** — standalone publish semantics deduplicated via shared publish outcome mapper; `verify:transport-engine-w15` green

| Deliverable | Detail |
|-------------|--------|
| Updated | `transport-kernel-standalone-publish.ts` now uses `mapLegacyPublishResultToRelayPublishResult` (single quorum semantics owner) |
| Subtracted | Local quorum math duplication (`resolveQuorumRequired`) removed from transport-kernel standalone publish owner |
| Preserved | transport-kernel standalone publish owner remains canonical native path; transport engine host methods stay read-only in this wave |
| Contract | `transport-engine-w15.contract.test.ts` + standalone publish owner unit tests |
| Gate | `verify:transport-engine-w15` (included in `verify:engine-lab`) |

**transport-engine-w14 complete** — native standalone publish moved to a dedicated transport-kernel owner; `verify:transport-engine-w14` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-standalone-publish.ts` — native standalone publish owner with quorum evidence |
| Wired | `relay-standalone-publish-port.ts` uses transport-kernel owner on authority path; legacy runtime remains web-only |
| Preserved | Journal-backed pending outbound accounting in standalone publish port |
| Contract | `transport-engine-w14.contract.test.ts` + standalone publish owner unit test |
| Gate | `verify:transport-engine-w14` (included in `verify:engine-lab`) |

**transport-engine-w13 complete** — native standalone publish now reuses quorum-capable pool publish with transport journal accounting; `verify:transport-engine-w13` green

| Deliverable | Detail |
|-------------|--------|
| Updated | `relay-standalone-publish-port.ts` — native path delegates to standalone pool publish instead of raw `sendRelayMessage` loop |
| Added | `relayTransportJournal` pending-outbound accounting for native standalone publish |
| Preserved | `enhanced-relay-pool-port.ts` stays the canonical standalone publish facade |
| Contract | `transport-engine-w13.contract.test.ts` + standalone publish port unit test |
| Gate | `verify:transport-engine-w13` (included in `verify:engine-lab`) |

**transport-engine-w12 complete** — standalone relay publish gated behind transport-kernel port when authority is active; `verify:transport-engine-w12` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-publish-port.ts` — `shouldUseLegacyStandaloneRelayPublish`, `isTransportKernelPublishOwner` |
| Added | `relay-standalone-publish-port.ts` — native publish via `relayNativeAdapter.sendRelayMessage` when authority active |
| Wired | `enhanced-relay-pool-port.ts` exports publish through `relay-standalone-publish-port` |
| Contract | `transport-engine-w12.contract.test.ts` + publish port unit test |
| Gate | `verify:transport-engine-w12` (included in `verify:engine-lab`) |

**transport-engine-w11 complete** — relay pool UI hook subtracted behind port when transport-kernel authority is active; `verify:transport-engine-w11` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-pool-hook-port.ts` — `shouldUseLegacyRelayPoolHook`, `isTransportKernelPoolHookOwner` |
| Added | `relay-pool-hook-port.ts` — canonical `useRelayPoolRuntime` for UI wiring |
| Added | `use-transport-kernel-relay-pool.ts` + `use-enhanced-relay-pool-runtime.ts` — shared runtime hook extraction |
| Wired | `use-relay-pool.ts` uses `useRelayPoolRuntime` only via port |
| Contract | `transport-engine-w11.contract.test.ts` + pool hook port unit test |
| Gate | `verify:transport-engine-w11` (included in `verify:engine-lab`) |

**transport-engine-w10 complete** — headless `createTransportEngine` owner + supervisor path pool port subtraction; `verify:transport-engine-w10` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-engine-port.ts` — `getTransportKernelEngine`, `buildTransportKernelSupervisorEvidence` |
| Added | `relay-pool-runtime-port.ts` — `RelayPoolRuntime` type facade (no legacy hook imports) |
| Wired | `transport-relay-supervisor-evidence` delegates to engine port when authority active |
| Subtracted | Supervisor/recovery/subscribe paths import `relay-pool-runtime-port` not `enhanced-relay-pool-types` |
| Contract | `transport-engine-w10.contract.test.ts` + engine port unit test |
| Gate | `verify:transport-engine-w10` (included in `verify:engine-lab`) |

**transport-engine-w9 complete** — `relay-recovery-controller` quarantined behind recovery port for web-only legacy; `verify:transport-engine-w9` green

| Deliverable | Detail |
|-------------|--------|
| Renamed | `relay-recovery-controller.ts` → `relay-recovery-controller-legacy.ts` |
| Added | `relay-recovery-metrics-refresher.ts` — transport-kernel metrics-only runtime |
| Added | `relay-recovery-adapter-metrics.ts` — shared pool metrics extraction |
| Port | `createRelayRecoveryRuntime()` picks legacy controller (web) or metrics refresher (native) |
| Wired | `relay-runtime-supervisor` uses `createRelayRecoveryRuntime` only via port |
| Contract | `transport-engine-w9.contract.test.ts` + metrics refresher unit test |
| Gate | `verify:transport-engine-w9` (included in `verify:engine-lab`) |

**transport-engine-w8 complete** — legacy recovery action orchestration subtracted when transport-kernel authority is active; `verify:transport-engine-w8` green

| Deliverable | Detail |
|-------------|--------|
| Extended | `transport-kernel-recovery-port.ts` — `shouldRunLegacyRelayRecoveryOrchestration`, `executeTransportKernelPoolRecovery` |
| Gated | `triggerRecovery`, `scheduleAutoRecovery`, `startWarmup`, browser nudge → transport-kernel path on native |
| Preserved | Legacy controller for metrics refresh only; primary failover still runs before pool recovery |
| Contract | `transport-engine-w8.contract.test.ts` + supervisor authority-path test |
| Gate | `verify:transport-engine-w8` (included in `verify:engine-lab`) |

**transport-engine-w7 complete** — legacy relay recovery snapshot path subtracted when transport-kernel authority is active; `verify:transport-engine-w7` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-kernel-recovery-port.ts` — published recovery owner + legacy subscription gate |
| Subtracted | Duplicate `toPhase` from supervisor → `resolveLegacyRelayRuntimePhase` (web/legacy only) |
| Gated | `subscribeRecoveryState` skipped when transport-kernel owns recovery snapshot |
| Wired | `resolvePublishedRelayRecoverySnapshot` — runtime snapshot uses transport-engine recovery on native |
| Contract | `transport-engine-w7.contract.test.ts` + recovery port unit test |
| Gate | `verify:transport-engine-w7` (included in `verify:engine-lab`) |

**transport-engine-w6 complete** — `isTransportKernelAuthority` flipped to native default; transport-engine owns runtime phase; `verify:transport-engine-w6` green

| Deliverable | Detail |
|-------------|--------|
| Flipped | `transport-kernel-policy.ts` — native authority (opt-out `NEXT_PUBLIC_OBSCUR_TRANSPORT_KERNEL=0`) |
| Added | `transport-kernel-snapshot-port.ts` — `resolveRelayRuntimePhaseForTransportKernel` |
| Wired | `relay-runtime-supervisor` uses transport-engine snapshot phase when authority active |
| Gated | `relay-provider` persistence/hydration/subscribe behind `transportKernelAuthority` |
| Contract | `transport-engine-w6.contract.test.ts` + policy/snapshot unit tests |
| Gate | `verify:transport-engine-w6` (included in `verify:engine-lab`) |

**dm-kernel chat-state I/O authority on native complete** — chat-state ports suppress DM message bodies when sqlite is owner; `verify:dm-kernel` green

| Deliverable | Detail |
|-------------|--------|
| Added | `dm-kernel-chat-state-io-policy.ts` — `isDmKernelChatStateMessageIoSuppressed`, sanitize/project helpers |
| Gated | `messaging-chat-state-message-port`, `read-port`, `account-sync-chat-state-port`, `ui-mirror` |
| Aligned | `message-persistence-service` mirror uses dm-kernel policy (not raw `requiresSqlitePersistence`) |
| Fixed | `account-sync-chat-state-port` legacy import path → features messaging services |
| Contract | `dm-kernel-chat-state-io.contract.test.ts` + policy unit test |
| Gate | `verify:dm-kernel` (27 tests) |

**transport-engine-w5 complete** — engine relay evidence subscribes transient pool connections; `verify:transport-engine-w5` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-relay-pool-subscribe.ts` — resolve + `addTransientRelay` sync |
| Hook | `use-transport-engine-pool-subscribe.ts` — runs after transport bootstrap |
| Wired | `relay-provider` subscribes checkpoint/engine-only URLs not in permanent pool |
| Diagnostics | `relay.transport_engine_pool_subscribe` log when URLs are subscribed |
| Contract | `transport-engine-w5.contract.test.ts` |
| Gate | `verify:transport-engine-w5` (included in `verify:engine-lab`) |

**legacy subtraction w40 complete** — final `app/legacy/` implementation removed; `verify:legacy-subtraction` green

| Deliverable | Detail |
|-------------|--------|
| Deleted | `app/legacy/chat-state-store-legacy.ts` |
| Added | `features/messaging/services/chat-state-store-legacy.ts` |
| Ports | 6 chat-state ports import features implementation only |
| Contract | `legacy-subtraction-w40.contract.test.ts` |
| Queue | **empty** — `app/legacy/` is docs-only |

**transport-engine-w4 complete** — checkpoint evidence + pool hydration from engine persistence; `verify:transport-engine-w4` green

| Deliverable | Detail |
|-------------|--------|
| Added | `loadTransportRelayPersistence`, `resolveEngineCheckpointRelayUrls` |
| Added | `transport-relay-pool-hydration.ts` — hydrates pool when user relays empty |
| Hook | `use-transport-relay-persistence.ts` — URLs + checkpoints in one load |
| Snapshot | `engineCheckpointRelayUrls`, `engineRelayCheckpointCount` |
| Wired | `relay-provider` uses `effectiveDmTransportRelayUrls` for selection/pool |
| Contract | `transport-engine-w4.contract.test.ts` |
| Gate | `verify:transport-engine-w4` (included in `verify:engine-lab`) |

**transport-engine-w3 complete** — supervisor snapshot + recovery evidence from engine URLs; `verify:transport-engine-w3` green

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-relay-supervisor-evidence.ts` — `buildSupervisorTransportEvidence`, phase relay count |
| Snapshot | `engineConfiguredRelayUrls`, `supervisorRelayUrlCandidates`, `engineOnlyRelayUrls` |
| Wired | Supervisor phase/auto-recovery use supervisor candidates when active pool empty |
| Diagnostics | `relay.transport_engine_evidence` log when engine persistence contributes URLs |
| Contract | `transport-engine-w3.contract.test.ts` |
| Gate | `verify:transport-engine-w3` (included in `verify:engine-lab`) |

**transport-engine-w2 complete** — relay supervisor boot loads `listConfiguredRelayUrls` via SDK

| Deliverable | Detail |
|-------------|--------|
| Added | `transport-engine-host-port.ts`, `transport-relay-supervisor-bootstrap.ts` |
| Hook | `use-transport-configured-relay-urls.ts` — loads on `transportBootstrapReady` |
| Wired | `relay-provider.tsx` merges engine URLs into supervisor `allEnabledRelayUrls` |
| Contract | `transport-engine-w2.contract.test.ts` |
| Gate | `verify:transport-engine-w2` (included in `verify:engine-lab`) |

**Post-B5 w39 complete** — enhanced relay pool deleted from legacy; `verify:legacy-subtraction` green

| Deliverable | Detail |
|-------------|--------|
| Deleted | `enhanced-relay-pool-legacy.ts` from `app/legacy/` |
| Added | `features/relays/hooks/enhanced-relay-pool-legacy.ts` |
| Port | `enhanced-relay-pool-port.ts` re-exports features + types facade |
| Contract | `legacy-subtraction-w39.contract.test.ts` |
| Queue | **0 legacy files** — w40 cleared final implementation |

Prior: w38 (group provider), w37 (sealed community), w36 (conversation messages hook).

---

## Settled truth

- **Kernel UI (2026-06-27):** Relay + DM transport arm on unlocked identity (`runtime-transport-owner-policy.ts`); local vault save via `local-media-store.ts` + `save-chat-attachment-to-vault.ts`; attachment context menu + mobile long-press (`attachment-context-menu-handlers.ts`). Manual matrix: checklist rows 4–5, 7–11.
- Chat state mirror: `features/messaging/services/chat-state-store-legacy.ts` via chat-state ports (w40).
- Native DM message I/O: sqlite/dm-kernel authority; chat-state ports strip/suppress message bodies on native (`dm-kernel-chat-state-io-policy`).
- Transport recovery: web legacy controller quarantined in `relay-recovery-controller-legacy.ts`; native uses metrics refresher + transport-kernel pool recovery (`relay-recovery-port`, `transport-kernel-recovery-port`).
- Transport engine w2–w36: boot URLs → supervisor evidence → pool hydration → transient subscribe → authority flip → snapshot owner → recovery snapshot subtraction → action orchestration subtraction → legacy controller quarantine → headless engine owner + pool runtime port → UI pool hook port → standalone publish port → journal-backed native standalone publish → dedicated transport-kernel publish owner → shared publish-outcome semantics → host-publish charter/defer decision → host publish contract slice → non-wired desktop/host invoke stub → parity verification charter pinned → publish result/evidence contract pinned → typed host adapter for publish results → Rust wiring charter pinned (still stubbed) → headless parity harness charter pinned → first executable parity harness slice → reason/status parity + invalid-shape rejection harness → mocked valid host-result acceptance path → mocked failure-mode paths → parity harness exit charter → owner migration charter → Rust payload validation → result assembly charter → port shim charter → shim policy gate → gated host shim wiring → dry-run assembly charter (design-only).
- **0 legacy implementation files** in `app/legacy/`; feature production code imports legacy only through ports.

---

## Checkpoints

<!-- CONTEXT_CHECKPOINTS_START -->
### 2026-07-15T07:45:00Z checkpoint
- Summary: Dev shell freshness guard landed (predev clean, stale roots, stamp gate); C10 L3 Row A PASS dual-window HTTP-only; Row B blocked on Nostr EVENT→WS-only publish — fix landed (HTTP mesh envelope + `#p` audience); shell rebuilt `shell-2026-07-15T07:31:49Z`; Row B re-soak not completed
- Evidence: `pnpm verify:conduit-mesh-c10` PASS; `static-shell-stale` 6/6; `dev_shell_freshness` 5/5; C10 integration publish test; CDP sessions csess-61a6b99b9bde / csess-aed8d69e8d8d; investigation spec updated
- Uncertainty: Row B end-to-end receive not re-proven post-fix; gateway may retain stale envelopes from failed soaks — consider fresh gateway or note count delta only
- Next: CONDUIT-MESH-C10 L3 Row B re-soak — purge both → send `C10-L3-soak-20260715B` → Tester2 receive ≤45s → gateway envelopes → sign-off → C11
### 2026-07-10T05:40:09Z checkpoint
- Summary: Vault sandbox Phases 1-5 in evidence mode (G8); CodaCtrl lane D marked Obscur-side EXIT; docs/CURRENT synced
- Evidence: pnpm verify:vault-sandbox-l1 31/31; verify:storage-encryption-v1.9.8 PASS; commit 7bbaa010
- Uncertainty: not provided
- Next: Maintainer L3/L4 vault-sandbox-l3-verification runbook sections 3-5; CodaCtrl daemon wiring is external
<!-- CONTEXT_CHECKPOINTS_END -->
