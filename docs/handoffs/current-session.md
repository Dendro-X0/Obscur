# Current Session Handoff

- Last Updated (UTC): 2026-11-11T14:40:00Z
- Session Status: ACTIVE · Official Beta OB5 publishing v2.0.0-beta.11 · Soft L3 paused · Continuity Pass not claimed
- Active Owner: ENGINE-LAB

## Maintainer instruction (binding)

```text
SUPERSEDE (2026-11, maintainer-confirmed): Process docs yield to product design for REWRITE BAND.
Suspended for the band: strangler-only · no-greenfield-as-absolute · no mega-refactor ·
  obscur-session-gate / execution-checklist refusals that block the band ·
  “Do NOT refactor” / “behavior must stay identical” lines that conflict with this charter.
PROMOTION GOAL (unchanged intent): Obscur = platform for building decentralized / private-trust
  communication apps — protocol is a communication layer, not the product identity.
ACTIVE OBJECTIVE: implement planned platform design — auth · profiles · storage modular and
  independent; adapters for Nostr + future carriers (Matrix, private DC / custom servers, later P2P/E2EE/Tor).
SECURITY LAW: censorship/surveillance resistance (private-trust + optional hardened transport) ·
  hard profiles (cross-profile technical isolation) · sandboxed inbound DM/group files (quarantine).
  Spec: specs/backend/sandboxed-storage-security-design-2026-11.md
REWRITE BAND: auth · protocol adaptation · naming · module/file layout · stack/language
  as required to hit the design (prefer in-repo evolution; greenfield only if design charter says so).
KEEP UNTIL DESIGN SAYS OTHERWISE: Tauri desktop shell usable · published beta not silently deleted.
STILL FORBID: OAuth-as-root identity · marketing lie that multi-protocol / Tor Verified / “unbreachable” is done ·
  Continuity / Soft L3 / Matrix *promote* without design+proof ·
  deleting platform safety/system rules · mass-deleting global Cursor skills or all docs/ as first move.
SKILLS/MD: do not delete globally; ignore project process gates that conflict with this charter.
MEDIA: 1:1 voice shipped; do NOT claim video usable (no camera). Lab canvas ≠ production claim.
Public name stays Obscur. Nostr module working name remains Obscur-Nostr until rename charter.
```

## Active Objective

**Replacement-style rewrite band (backend-first).** NARROW product cut kept; **code preservation is not a goal** — unviable foundations may be deleted/replaced on named cuts. Cut 0 spine = keepable wedge; dual old owners must die in Cut 1. Soft L3 contact Pass remains paused. Posture: `specs/backend/rewrite-replacement-posture-2026-11-09.md`.

## Sequencing

```text
DECISION 2026-11 — SUPERSEDE strangler-only / no-mega-refactor for REWRITE BAND (maintainer confirmed)
TRACK A–C / B10 — DONE (L1).
Matrix access-token login — DONE (L1) · lab only · promote still gated
Relays Standard/Advanced + four paths — DONE (L1)
DECISION 2026-10-18 — Launch face = private-trust / own infra (VPN, DC, private relays) · still desired
DECISION 2026-10-18 — Names: Obscur = platform · Obscur-Nostr = Nostr module · rename only via charter
DECISION 2026-10-18 — Media: voice shipped; gap = video + conference (M1–M3) · camera still blocks M1-L3 claim
HISTORICAL 2026-10-18 — Decoupling via strangler (D0→S5) · superseded for rewrite band; artifacts remain evidence
FOCUS — Platform architecture charter → first cut inside REWRITE BAND
```

## Next Atomic Step

```text
OFFICIAL BETA BAR — OB0–OB4 CLOSED (= Official Beta Pass) · OB5 cut plan READY
  Spec: specs/backend/official-beta-bar-2026-11-11.md
  OB5 plan: specs/backend/official-beta-ob5-cut-plan-2026-11-11.md
  Draft notes: docs/releases/official-beta-release-notes-draft-2026-11-11.md
  Suggested tag: v2.0.0-beta.11 · version.json still 2.0.0-beta.10 until ask
ASK: reply "publish Official Beta" or "publish v2.0.0-beta.11" to cut/tag/package
  Soft L3 Fixed / Continuity Pass / Tor Verified / Matrix promote NOT claimed
STOP without that phrase · Do NOT tag from continue · Do NOT silent beta wipe
```

## Landed

| Unit | Result |
|------|--------|
| Auth continuity deliberation | three planes (Daily · Recovery · Continuity) · four-audience stance · single-door scoped Planes 1–2 · Continuity/BKP-2 sibling · specs only |
| Continuity pioneering explore | living-graph reconstitution + SCU local residue + fungible carriers (file/relay/pair/DTN) + peer grants · design only · does not block A+B |
| Single-door Slice A+B | Auth device_password_bind after key when PDK closed · AuthGateway isShellReady gate · passphrase primary · vitest Pass |
| Single-door Slice C | keychain PDK restore after identity unlock · passphrase activate fallback to restore · Auth key path restore-first · vitest Pass |
| Unlock-loop FM1 | L1/L2 Pass · **L3 Pass 2026-11-02** (hydrate latch — session inactive after Lock + password → shell) |
| Contact delete/reconnect + Clear history | L1 Pass · **L2 Pass 2026-11-07** (Tester1↔Tester2 static-dev; Requests card Partial) |
| Requests-tab reconnect residue | **L1 Pass** · **L2 Pass 2026-11-07** (Requests (1) pending card after post-remove invite) · beta.9 cut Ready |
| v2.0.0-beta.9 cut | **Published** run 42377708144 · download face synced · NSIS install L2 **Partial** (payload Pass; dual CDP soak owed) |
| Social core flows verify | **L1 Pass 101** · **L2 Partial→healed** — invite/remove Fail/Blocked superseded by trust-directory heal · leave residue Slice 2 L1 |
| Trust directory heal | **L1 Pass 21** · **L2 Pass** Connections/Trusted/Remove (static-dev rebuild) · leave deselect L1 audit · leave L2 optional |
| Contact remove E2E sticky | **L1 Pass** — hydrate no longer undoes Remove; inbox scrubs connectionRequests · peer notify path unchanged · L2 dual CDP optional |
| Social relationship lifecycle charter | Specs only — unified contract + inventory · Slice 1 Block · Slice 2 Leave peer · Slice 3 Invite |
| Block lifecycle Slice 1 | **L1 Pass 20** · **L2 Pass 2026-11-08** — Soft L3 dual CDP Block→peer demote; Unblock no auto-accept |
| Soft L3 persist hygiene | **L1+L2 Pass 2026-11-08** — option A exclusive intent; Apply→reload sole `:7000` · not Soft L3 Fixed |
| Multiparty social sync production gate | **Charter 2026-11-08** — P1–P4 planes · not Pass |
| Social sync P1 release matrix (WP1) | **Pass 2026-11-08** — Soft L3 block/leave/invite Pass; kick IN SCOPE; packaged Blocked |
| P1-O1 Block public Default Stable | **L2 Pass 2026-11-08** — demote + Unblock sticky |
| P1-O1b Unblock trust resurrect | **L1+L2 Pass 2026-11-08** — wire `connection-accept` ignored under `removedPeers` |
| P1-O2 Leave public Default Stable | **L2 Pass 2026-11-08** — T1 leave → T2 `leftHasT1` / active exclude / UI clear |
| P1-O3 Invite public Default Stable | **L2 Pass 2026-11-08** — Soft L3 accept → Default Stable both `joined` |
| P1-O4 Soft L3 contact remove→reconnect | **Partial 2026-11-08** — Remove+delivered Pass; peer demote Fail; Requests Fail |
| Packaged NSIS lab CDP | **Investigation note 2026-11-08** — release CDP absent; seam options listed · no dual-CDP Pass |
| Leave peer visibility Slice 2 | **L1 Pass 8** · **L2 Pass 2026-11-08** — Soft L3 dual CDP; T1 leave → T2 coordination/ledger/UI exclude T1 |
| Invite Fail Slice 3 | **L1 classified** · **L2 Pass 2026-11-08** — Soft L3 dual CDP create→Invite Connections→Tester2 Accept; coordination both members |
| SUPERSEDE 2026-11 | maintainer confirmed · process gates yield to rewrite band · charter P0 · P1 map written |
| Security law 2026-11 | censorship/surveillance resistance · hard profiles · sandboxed inbound storage design S0 · impl after P1 |
| P1 boundary map | Auth/Profiles/Storage/PAL owners named · kill list K1=nostrAdapter bypass in dm-send/delete |
| K1 PAL send | sendDmNostrOnly · dm-send/delete rerouted · D1/S4 contracts Pass |
| K2 nostr-adapter boundary | contract forbids imports outside protocol-adaptation/ · dm-controller types via layer |
| K3 auth mutation entry | legacy-bridge-removal criteria · allowlisted adapters only · shell on surface actions · Pass |
| K4 profile trees fence | profile README (display) · profiles README (slots) · import ownership contract · Pass |
| P3 PAL port freeze | layer-only adapters · sendDmNostrOnly messaging · port catalogs · Pass |
| P4 private_dc L1 | second carrier = company DC (not Matrix promote) · adapter · Settings configure · Pass |
| P4b private_dc HTTP | `/v1/conversations` client · adapter wire · fail-closed `private_dc_http_*` · L1 vitest Pass |
| Cut 0.5 relationship_edge | **L1 Pass** — libobscur upsert/get/list/removed · messages never invent edges · Soft L3 **not** claimed |
| Cut 0.6 H-dc v0.1 | **L1 Pass** — health/sendEnvelope/listEnvelopes?since · plaintext rows dropped · Soft L3 **not** claimed |
| Cut 0.7 outbox+ACK | **L1 Pass** — outbox ports · home ACK → accepted≠delivered · Soft L3 **not** claimed |
| Cut 0.8 T3 DR | **L1 Pass** — seal/open H-dc envelopes · dr_session blob · Soft L3 **not** claimed · NIP-17≠T3 |
| Cut 0.9 vault refs | **L1 Pass** — SCHEMA_V6 content_hash · reject data:/blob: · Soft L3 **not** claimed |
| Cut 1 Replacement authority | **CLOSED 1.0–1.6** — CRM/msg/outbox/T3/chat-state demotion L1 + lab checklist · Soft L3 **not** claimed |
| Cut 2 Private-trust product face | **CLOSED 2.0–2.4** — default `private_dc` · compose honesty · invite policy · lab checklist · Soft L3 **not** claimed |
| Cut 3 Cut UI (Vite thin shell) | **CLOSED 3.0–3.5** — Vite lab · auth · private-trust home · dual-entry quarantine · lab checklist/soak · Soft L3 / Continuity **not** claimed |
| Cut 4 Vite native port wire | **CLOSED 4.0–4.4** — prefer-native · passphrase unlock handlers · H-dc session deliver · HostEnginePort/T3 · lab checklist/soak · Soft L3 / Continuity **not** claimed |
| Cut 5 Vite production cutover | **CLOSED 5.0–5.4** — Vite committed frontendDist · Next rollback · lab checklist/soak · Soft L3 / Continuity **not** claimed |
| Cut 6 release / CI Vite align | **CLOSED 6.0–6.4** — mobile PWA overlay · CI/package/channel honesty · Soft L3 / Continuity **not** claimed |
| Cut 7 Continuity M1 (F-sync C0) | **CLOSED 7.0–7.5** — M1 law · inventory · SQLite T3/CRM refuse · Vite Continuity door · Soft L3 paused · **≠ Continuity Pass** |
| Cut 8 native Continuity M1 | **CLOSED 8.0–8.5** — vite seal + ports · prefer-native · ContinuityDoor passphrase/file · Soft L3 paused · **≠ Continuity Pass** |
| Cut 9 Continuity M2 auto-DC | **CLOSED 9.0–9.5** — `/v1/continuity/backups` · vite publish/restore · Soft L3 paused · **≠ Continuity Pass** |
| Cut 10 Continuity M4 pair | **CLOSED 10.0–10.5** — offer/accept + TTL + transfer code · Soft L3 paused · **≠ Continuity Pass** |
| Cut 11 Vite product-depth | **CLOSED 11.0–11.5** — create identity · PrivateHomeSessionDoor · product honesty · Soft L3 paused · **≠ Continuity Pass** |
| Cut 12 Continuity M5 registry | **CLOSED 12.0–12.5** — enroll/list/revoke linked devices · F-sync C3 NARROW · Soft L3 paused · **≠ Continuity Pass** · **≠ live sync** |
| Cut 13 Continuity M6 backfill | **CLOSED 13.0–13.5** — private-home opaque envelope backfill · F-sync C4 NARROW · Soft L3 paused · **≠ Continuity Pass** · **≠ invent CRM** |
| Cut 14 Vite Settings NARROW | **CLOSED 14.0–14.5** — SettingsDoor + T2 residue in Continuity M1 · Soft L3 paused · **≠ Continuity Pass** · **≠ live mesh** · **≠ peer grants** |
| Cut 15 peer history grants | **CLOSED 15.0–15.5** — Ingredient 5 create/accept/list opaque grants · Soft L3 paused · **≠ Continuity Pass** · **≠ invent CRM** |
| Remaster foundation R0–R5 | **R0–R4 Pass** · **R5 Published** `v2.0.0-beta.10` · **NSIS L2 Pass** · foundation only ≠ Official Beta |
| Official Beta bar | **OB0–OB4 Pass** · **OB5 cut plan READY** · suggested `v2.0.0-beta.11` · WAITING publish ask · Soft L3/Continuity not claimed |
| Cut 0 privateTrust glue | **L1+headless Pass** — prepareT3Outbound/completeT3HomeAck · CRM ports · soak 6–8 · Soft L3 **not** claimed |
| Cut 0.10 lab checklist | **Documented** — cut0-lab-milestone-checklist-2026-11-09.md · ≠ Soft L3 |
| P4c private_dc L2 lab | local `/v1` lab server · soak matrix + client live-fetch L2 Pass (not production DC) |
| P6 plane README fences | auth-kernel · auth · storage · PAL owns/does-not-own · contract Pass · no mass rename |
| K6 SendConfirmation PAL | layer exports via `send-confirmation.ts` · messaging not via nostr-adapter · contract Pass |
| P4d private_dc CDP | adapter L2 live HTTP · CDP hooks list/send vs lab `/v1` · Pass |
| P4e private_dc send scope | `sendMessage` requires `profileId` · wrong-profile fail-closed · Matrix aligned · Pass |
| P4f private_dc connect/list | `connect(transport, profileId)` · listMessages soak · L1/L2 Pass |
| P4g private_dc rich list | listDmConversations/Messages shim · getRichListAdapter → privateDc · Pass |
| P4h private_dc caps/map | `PRIVATE_DC_CAPABILITIES` · rich-map leaf · adapter thin · Pass |
| C3 Matrix caps/map (lab) | `MATRIX_LAB_CAPABILITIES` · rich/canonical maps · not promote · Pass |
| Feedback readiness A1–A5 | **Pass 2026-11-03** · honesty surfaces landed · public ask optional · Soft L3/Tor/Matrix still PAUSED |
| P7 Obscur-Nostr body leaf | `canonical-from-rich` in `@obscur/protocol-nostr` · adapter imports maps · Pass |
| P7b Obscur-Nostr capabilities | `OBSCUR_NOSTR_CAPABILITIES` + refuse helper in package · adapter wired · Pass |
| P7c Obscur-Nostr display/hints | display name + nostr migration/switch copy in package · Pass |
| P5 naming L1 | glossary helper · Settings labels · README · `@obscur/protocol-nostr` name stable · no mass rename · Pass |
| P2 auth daily-door L1 | passphrase primary · private key Advanced · no OAuth · Pass |
| P2 auth daily-door L3 | CDP copy soak — passphrase primary · Advanced · no OAuth · password→shell · Pass |
| P2-S S5 L2 | Alice CAS invisible to Bob · quarantine path cross-read null · Pass |
| P2-S S5 L3 | dual-profile AppData quarantine FS — Alice read Pass · Bob cross-read null · Pass |
| P2-S S1 inbound policy | evaluateInboundMediaPolicy · SVG/HTML/exe deny · size cap · 6 Pass |
| P2-S S2 quarantine paths | planInboundMediaWrite · updateMediaBlob contentAvailabilityState · Pass |
| P2-S S2 L3 | CDP plan+persist+read · allowSystemOpen false · no shell open · Pass |
| P2-S S2b quarantine FS | persistInboundMediaQuarantineBytes · AppData adapter · updateMediaBlob schedule · Pass |
| P2-S S5 L1 read deny | readInboundMediaQuarantineBytes fail-closed cross-profile · Pass · L3 Pass |
| P2-S S3 preview gate | inbound-media-preview · getMessageMedia blob strip · display-url gated · Pass |
| P2-S S3 L3 | CDP quarantined/exe block · PNG blob: · no shell open · Pass |
| P2-S S4 export consent | inbound-media-export · context-menu + lightbox · confirm for quarantine/denied · Pass |
| P2-S S4 L3 | CDP consent gate · no system-open · plan.allowSystemOpen false · Pass |
| K7 CanonicalSendConfirmation | slim DTO + toCanonical mapper · rich SendConfirmation kept · contract Pass |
| K8 onConfirmed Canonical | pipeline maps to Canonical · dm-controller/retry consume slim · contract Pass |
| Rewrite-band milestone | closeout note — honest claim · PAUSED bands unchanged |
| Auth wallet unlock L1/L2 | passphrase-primary when password row exists · Import Key Advanced · create step-3 backup ack + encrypted recovery JSON download · vitest auth-screen + download helper Pass |
| Auth lock screen UI | identity hero · short unlock hints · compact manual-lock chip · Advanced + About details · auth-screen 31 Pass · desktop static shell rebuilt |
| Unlock display sync | profile-store name wins over stale IdentityRecord.username · soft wrong-key · opt-in switch panel · 36 Pass |
| Private-key vault gate | no Welcome Back until PDK/SQLite open · soft-lock LockScreen “Local data locked” · storage_only toast |
| B10 remainder | native random + event verify |
| L2 soak | A Skipped · B T0/T1 Fail |
| Matrix access-token | L1 Pass · **non-promoted / lab** |
| Relays IA + four paths | Standard/Advanced L1 Pass |
| Positioning decision | private-trust launch · platform-service vision docs |
| Decoupling D0 | characterization L1 Pass |
| Decoupling D1 | choke point L1 Pass · nostrAdapter owns send/list imports |
| Decoupling D2 | Nostr adapter folder L1 Pass · public import path unchanged |
| Decoupling S3 | canonical DTO boundary L1 Pass · rich Message unchanged |
| Decoupling S4 | rich vs canonical vs nostrAdapter.sendDm surfaces L1 Pass |
| Decoupling S5 | @obscur/protocol-nostr package L1 Pass · adapter still in pwa |
| PB1-C dial preflight | no open relay blocks voice invite · L1 Pass |
| M1-A camera-less structure | callType · supportsVideo · video_call consent · dock panes · L1 Pass |
| M1-B camera fallback | acquireLocalCallMedia · recvonly transceiver · honesty banner · L1 Pass |
| PB1-C peer start honesty | host/signal null RTC → interrupted + toast · L1 Pass |
| M1-C lab canvas | off in production · dev opt-in canvas track + honesty banner · L1 Pass |
| PB1-C host offer honesty | offer create/send fail → interrupted + toast · L1 Pass |
| PB1-C joiner answer honesty | setRemote/createAnswer/send fail → interrupted + toast · L1 Pass |
| M1 video dial UI | DM Video call · callType video · device/camera preflight · L1 Pass (not usable) |
| M1 mobile video stage | Full-screen mobile video preview · desktop dock unchanged · L1 Pass |
| Call quality R1 | RTC stats snapshot + capped `quality_sample` diagnostic · L1 Pass (not quality claim) |
| Soft disconnect R2 | 4s grace on RTC `disconnected`; `failed` ends now · L1 Pass (no L3 stability claim) |
| Host connect latency R3 | `host_connected` dial/offer→connected ms · L1 Pass (diagnostics only) |
| ICE honesty R4 | STUN default · optional `NEXT_PUBLIC_OBSCUR_ICE_TURN_*` · `ice_config` · L1 Pass |
| Desktop video stage R5 | Floating stage (not full-window) · voice stays dock · L1 Pass (not usable) |
| Flaky-relay connect budget | 2/3 relays / dual-SDP → up to 3×30s connecting extensions · timeout ≠ left_by_user · L1 Pass |
| Ring before accept | Video stage only after connecting/connected · outgoing ring stays dock · L1 Pass |
| Trust msg.rate mute | Rate-only notices → tier none (ASE immature) · L1 Pass |
| Offline dial warn | Toast when dialing presence-offline peer · L1 Pass |
| Signal delivery flaky-relay | `pending_ack` + partial wire accept · one send retry · L1 Pass (retest E2E) |
| Accept→offer race | Host join single-flight · have-local-offer resend · dedup-safe retry · L1 Pass |
| Busy-line third-party | Any-peer invite defer while line busy · outbound dial block · L1 Pass |
| Video dial honesty | Invite card video copy · preserve callType on connect · L1 Pass |
| A/B video UI symmetry | Joiner UI callType follows wire invite (no demote) · L1 Pass |
| Desktop video window UX | Drag + bottom-right default + fullscreen toggle · L1 Pass |
| CU-UX-2b T0 create honesty | Hide T0 baseline/guarantees · ack reset on host · `hostingTier` persist · L1 Pass |
| CU-UX-4 governance roles | Steward promote/demote via descriptor · badge · last-steward guard · L1 Pass |
| CU-UX-4 L3 soak | Stack+policy+CDP-attach Pass · dual-profile Make steward Skipped (operator) |
| CU-UX-5 relay freedom | T1 public Quiet honesty-gated · trust `public_relay_honest` · catalog selectable · L1 Pass |
| CU-UX-6 mode/hosting convert | Manage T0↔T1 + host toggle · steward seed · honesty ack · L1 Pass |
| v2.0.0-beta cut plan | Anti-perfectionism B1–B5 · tag pending · CU-UX L3 not a blocker |
| Dual-channel Add Friend UI | Discovery Share In person QR + Send online link/OB2 · ShareInviteCard durable card · L1 resolver Pass · demo film open |

## PAUSED / CANCELLED

- **Matrix launch & promotion** (cleartext MVP insufficient; Olm not chartered)
- Soft L3 Fixed · remount · Step C · uncapped Quiet · Tor Verified
- Tor bootstrap patch-loop on this LAN
- A4 git tag until explicit ask
- Matrix E2EE (Olm) until dedicated charter
- KnotTrace code changes in Obscur workspace
- Positioning Obscur as a general-purpose public Nostr client
- Further sessions that refactor Obscur toward a Nostr-client identity

## Checkpoints

<!-- CONTEXT_CHECKPOINTS_START -->
### 2026-11-04T07:55:00Z checkpoint
- Summary: Dual-channel durable Add Friend UI — Share dialog lanes (QR card / remote OB2+link; OB3+vanity collapsed); ShareInviteCard off vanity `/invite/OBSCUR-*`; Exact Match placeholders + legacy honesty copy
- Evidence: specs/frontend/frontend-spec-discovery-dual-channel-add-friend-2026-11.md · search-page-client · share-invite-card · en.json · vitest contact-card/friend-code-v2/identity-resolver Pass
- Next: cold-run Tester1↔Tester2 via QR or OB2/link → film · no Soft L3/Tor/Matrix
### 2026-10-21T03:44:00Z checkpoint
- Summary: CU-UX-6 Manage convert L1 — `assessCommunityModeHostingConvert` · General Mode & hosting · Save updates descriptor + `updateGroup` relay/mode/hostingTier · steward seed on T0→T1
- Next: optional L3 convert soak · no history-migration claim · no SF-B Spaces
- Summary: CU-UX-5 relay freedom L1 — Team+public Quiet honesty-gated (`public_default_honest` / `public_relay_honest`); catalog includes Quiet selectable; coordination still required; SF-A hard-block superseded
- Next: optional Quiet/Team L3 create · CU-UX-4 dual-profile steward · no delete-for-all claim on public Team
- Summary: CU-UX-4 L3 soak — Docker relay :7000 + coordination :8787 healthy; shell has steward UI; policy vitest Pass; CDP Tester1 unlocked; dual-profile Make steward still Skipped (New Group CDP hangs)
- Evidence: cu-ux-4-steward-roles-l3-soak-latest · scripts/cu-ux-4-steward-roles-l3-soak.mjs · csess-0fc3c320ca26
- Next: operator finish Make steward on Team create · or Quiet L3 / video soak. Do not claim full CU-UX-4 L3 product Pass yet.
### 2026-10-20T15:20:00Z checkpoint
- Summary: CU-UX-4 governance roles L1 — `resolveStewardRoleMutation` (promote/demote/last-steward/T0); members Steward badge + Make/Remove steward; persists via `updateMetadata` stewardPubkeys
- Evidence: community-governance-roles-investigation/design · community-steward-policy · members-panel · vitest L1
- Next: was optional L3 (stack Pass · UI promote Skipped)
### 2026-10-20T08:00:00Z checkpoint
- Summary: CU-UX-2b T0 create honesty polish — Quick path honesty-only (no baseline/guarantee clutter); ack resets on host change; persist `hostingTier` public_quiet|custom|operator on create metadata + conversation + persistence round-trip
- Evidence: community-t0-create-honesty-polish-investigation/design · create-group-dialog · community-quick-group-create · vitest L1 (9)
- Next: optional L3 Quiet create+send · or video stage rebuild soak. Do not claim video usable without M1-L3.
### 2026-10-20T06:45:00Z checkpoint
- Summary: Desktop video stage — default bottom-right float, header drag (clamped), in-app fullscreen toggle; voice remains compact dock widget
- Evidence: frontend-spec-desktop-video-call-window · voice-call-stage-window-position · VoiceCallDock · vitest
- Next: Rebuild static · operator drag/fullscreen soak. Do not claim video usable without M1-L3.
### 2026-10-20T06:20:00Z checkpoint
- Summary: B still voice dock after Join — accept/join paths cleared callType before RTC; now re-apply wire video callType on accept + join. Same-PC dual profile ≈ camera contention only, not voice chrome.
- Evidence: handleAcceptIncomingVoiceInvite · handleJoinVoiceCallInvite · video-call-ui-asymmetric-ab-design
- Next: was desktop video window UX (done L1)
### 2026-10-20T05:30:00Z checkpoint
- Summary: A video stage / B voice dock on same invite — joiner coerced callType to voice when localSupportsVideo false; UI type now follows wire invite on both sides
- Evidence: video-call-ui-asymmetric-ab-investigation/design · resolveCallTypeFromInvite · vitest
- Next: was accept/join callType wipe (done)
### 2026-10-20T04:25:00Z checkpoint
- Summary: Video dial looked like voice — invite card ignored callType; connecting/connected status patches dropped callType; fixed card copy + preserve media fields
- Evidence: video-dial-shows-as-voice-investigation · voice-call-ui-status-media · voice-call-invite-card · main-shell
- Next: was A/B video UI symmetry (done L1)
### 2026-10-19T17:45:00Z checkpoint
- Summary: Decision — busy-line (not call waiting) when C calls A/B during A↔B; third-party invites deferred so they cannot overwrite live call UI; outbound dial blocked while busy; conference stays M2
- Evidence: realtime-call-busy-line-third-party-investigation/design · voice-call-busy-line · main-shell · vitest
- Next: was video dial honesty (done L1)
### 2026-10-19T15:05:00Z checkpoint
- Summary: Accept still tore down with offer toast — concurrent join-request raced second createOffer into failVoiceOfferDispatch; host offer now single-flight per room, have-local-offer resends, signal retry waits past DM dedup
- Evidence: realtime-call-accept-offer-race-investigation/design · voice-call-host-offer-coalesce · main-shell · vitest
- Next: was busy-line third-party (done L1)
### 2026-10-19T14:20:00Z checkpoint
- Summary: E2E answer toast under 2/3 relays — `sendVoiceSignal` now accepts `pending_ack` and failed+partialWireDelivery (same class as invite provisional) plus one immediate retry before `voiceCallAnswerSendFailed`
- Evidence: realtime-call-signal-delivery-flaky-relay-design · voice-call-signal-delivery · main-shell sendVoiceSignal · vitest 5 Pass
- Next: was accept-offer race (done L1)
### 2026-10-19T12:45:00Z checkpoint
- Summary: Soft-muted rate-only trust notices (no info strip for msg.rate alone); offline peer dial warns that invite may not be seen until reconnect; invite DM thread cards still exist by design (wire)
- Evidence: trust-msg-rate-nuisance-design · voice-invite-offline-peer-honesty · assessment + corpus L1
- Next: was signal delivery under flaky relays (done L1)
### 2026-10-19T12:25:00Z checkpoint
- Summary: Outgoing video ring no longer opens AV stage — compact dock until peer engages (connecting/connected); fixes “call began” while B offline/never accepts
- Evidence: realtime-call-ring-before-accept-design · resolveVoiceCallPresentation phase gate · voice-call-dock · vitest L1
- Next: was trust mute + offline dial warn (done)
### 2026-10-19T10:50:00Z checkpoint
- Summary: Screenshot ~34s “session closed” matched 30s connect/ring timeout under 2/3 relays; raised connecting extension budget when pool degraded or dual SDP; timeout end no longer leaves via left_by_user
- Evidence: realtime-call-flaky-relay-drop-investigation · realtime-call-flaky-relay-connect-budget-design · timeout-policy L1
- Next: was ring-before-accept (done)
### 2026-10-19T10:15:00Z checkpoint
- Summary: R5 desktop video stage — negotiated video uses floating stage (remote fill + local PiP); voice stays compact dock; mobile fullscreen unchanged; not full-window
- Evidence: m1-desktop-video-stage-design · frontend-spec-desktop-video-call-stage · resolveVoiceCallPresentation · voice-call-dock · vitest L1
- Next: was flaky-relay connect budget (done)
### 2026-10-19T10:05:00Z checkpoint
- Summary: R4 ICE honesty — default public STUN named as stunOnly; optional operator TURN via NEXT_PUBLIC_OBSCUR_ICE_TURN_URLS (+ user/cred); ice_config + rtc_state.stunOnly diagnostics; no landlord default
- Evidence: realtime-call-ice-servers · main-shell · vitest L1
- Next: was R5 desktop stage (done)
### 2026-10-19T07:50:00Z checkpoint
- Summary: R3 host connect latency — dial mark on ringing_outgoing, offer mark on first offer send, `host_connected` on RTC connected
- Evidence: realtime-call-connect-latency · main-shell · vitest L1 (13 across R1–R3)
- Next: was R4 ICE honesty (done)
### 2026-10-19T07:40:00Z checkpoint
- Summary: R2 soft disconnect — brief RTC `disconnected` waits 4s before interrupted; reconnect cancels grace; `failed` still ends immediately
- Evidence: realtime-call-disconnect-grace · main-shell connectionstatechange · vitest L1 (10)
- Next: was R3 host latency (done)
### 2026-10-19T06:55:00Z checkpoint
- Summary: Call research ranked R1–R5; landed R1 quality snapshot (RTT, audio loss, jitter, inbound bytes) emitted at most 1 Hz while connected
- Evidence: specs/backend/realtime-call-perf-stability-ux-investigation-2026-10.md · realtime-call-quality-stats · vitest L1
- Next: was R2 soft disconnect (done)
### 2026-10-19T05:55:00Z checkpoint
- Summary: Maintainer cancelled mobile-shell Import Key freeze investigation — host froze during Playwright/repro; no further auth freeze work this session
- Evidence: specs/backend/mobile-shell-import-key-freeze-investigation-2026-10.md Status CANCELLED
- Next: Do not restart mobile-shell:online or heavy browser repro until disk/CPU cool. Resume video dial / S2 only when operator asks.
### 2026-10-18T16:35:00Z checkpoint
- Summary: Mobile video call uses full-screen stage (remote fill + local PiP + bottom controls); desktop floating dock kept; streams published to global overlay
- Evidence: voice-call-dock presentation=fullscreen · global-voice-call-overlay · realtime-voice-global-ui-store streams · vitest L1
- Next: Desktop call preview redesign still open. M1-L3 blocked (no camera). Do not claim video usable.
### 2026-10-18T16:00:00Z checkpoint
- Summary: DM header Video call dials callType video after device check + camera/mic getUserMedia; no-camera stays audio-only honesty
- Evidence: specs/backend/m1-video-dial-ui-design-2026-10.md · prepareLocalMediaForCallDial · chat-header video control
- Next: M1-L3 still blocked (no camera). Do not claim video usable. S2 Track L still blocked on Docker.
### 2026-10-18T14:20:00Z checkpoint
- Summary: S2 Track L re-probe — Docker still absent; coordination and relay down; EG not cleared
- Evidence: docs/business/EG-LOG.md 2026-10-18 Track L re-probe · docker info DOCKER_NO
- Next: Operator starts Docker + stacks, then re-name hitch/S2 for P5
### 2026-10-18T13:55:00Z checkpoint
- Summary: PB1-C — joiner answer / setRemote fail tears down RTC, marks interrupted (network), toasts
- Evidence: voice-answer-dispatch-honesty · failVoiceAnswerDispatch · vitest L1
- Next: Name hitch/S2, more PB1-C, or M1-L3 when camera exists
### 2026-10-18T13:50:00Z checkpoint
- Summary: PB1-C — host offer create/send fail tears down RTC, marks interrupted (network), toasts; no silent connecting dock
- Evidence: voice-offer-dispatch-honesty · failVoiceOfferDispatch · vitest L1
- Next: was more PB1-C (joiner answer honesty)
### 2026-10-18T13:45:00Z checkpoint
- Summary: M1-L3 refused — no camera; soak procedure written for when camera/hitch exists; not Pass
- Evidence: specs/backend/m1-l3-dual-profile-av-soak-procedure-2026-10.md
- Next: was more PB1-C (host offer honesty done)
### 2026-10-18T13:40:00Z checkpoint
- Summary: M1-C — lab canvas video only when non-production flag is on; production always off; dock says not a camera
- Evidence: isLabCanvasVideoEnabled · acquireLocalCallMedia av_lab_canvas · voice-call-dock lab banner · vitest L1
- Next: was M1-L3 attempt (blocked — no camera)
### 2026-10-18T13:30:00Z checkpoint
- Summary: PB1-C — host and inbound-signal paths toast and mark interrupted when peer connection never starts (no silent connecting dock)
- Evidence: voice-peer-connection-start-honesty · main-shell failVoicePeerConnectionStart · vitest L1
- Next: Name hitch/S2, more PB1-C, M1-C, or M1-L3 when camera exists
### 2026-10-18T13:20:00Z checkpoint
- Summary: M1-B — camera getUserMedia fail → audio_only_fallback + dock banner; recvonly video transceiver when no local track; offerToReceiveVideo when negotiated
- Evidence: realtime-call-local-media.test · voice-call-dock.test · main-shell wire · vitest L1
- Next: Name hitch/S2, PB1-C, M1-C, or M1-L3 when camera exists
### 2026-10-18T13:10:00Z checkpoint
- Summary: M1-A camera-less structure — callType negotiation · supportsVideo · video_call consent · dock local/remote placeholders · dial still voice
- Evidence: voice-call-reason-honesty · realtime-voice-capability · voice-call-dock.test · vitest L1
- Next: was M1-B (done)
### 2026-10-18T11:30:00Z checkpoint
- Summary: v2.0.0 public face — GIFs + client tests prove prior features; video/conference still gap; no camera → no video usability claim; M1-A/B design ready
- Evidence: specs/backend/m1-video-camera-less-engineering-design-2026-10.md · docs/assets/gifs
- Next: was charter M1-A (done)
### 2026-10-18T11:25:00Z checkpoint
- Summary: Maintainer — 1:1 voice already shipped; missing features are video and conferencing (M1–M3)
- Evidence: known-limitations · pre-b2b media roadmap §5 · this handoff § MEDIA TRUTH
- Next: was camera-less M1 design (done)
### 2026-10-18T11:20:00Z checkpoint
- Summary: PB1-C — Voice call dial blocked with honest toast when openRelayCount is 0 (no ring dock)
- Evidence: voice-call-invite-delivery canStartVoiceCallInviteDial · main-shell preflight · vitest Pass
- Next: L3 dual-profile call when relays up, or named next PB1-C slice (not M1–M3)
### 2026-10-18T10:35:00Z checkpoint
- Summary: Maintainer — prior docs/assets/gifs remain valid demos after behavior-preserving D0–S5; no re-capture required
- Evidence: EG-LOG 2026-10-18 Gift/demo row · docs/assets/gifs · gif-inventory.md
- Next: Hitch ask or optional Track L when Docker up
### 2026-10-18T10:28:00Z checkpoint
- Summary: Commercial S2 named — Track L blocked (no Docker · stacks down · coordination-only env); EG-LOG attempt row written
- Evidence: docs/business/EG-LOG.md · SELF-T1-BOOT.md
- Next: Operator starts Docker + stack · complete P5 · EG-LOG group live
### 2026-10-18T10:20:00Z checkpoint
- Summary: Slice S5 — @obscur/protocol-nostr workspace package (identity + port surfaces); live adapter stays in pwa
- Evidence: packages/obscur-protocol-nostr · decoupling-s5-package.contract.test.ts · vitest Pass
- Next: S2 commercial or named task (not S6)
### 2026-10-18T10:08:00Z checkpoint
- Summary: Slice S4 — platform canonical exports + Obscur-Nostr rich docs; private send stays on nostrAdapter
- Evidence: port-surfaces.ts · decoupling-s4-rich-ports.contract.test.ts · vitest Pass
- Next: S2 commercial or named S5
### 2026-10-18T09:58:00Z checkpoint
- Summary: Slice S3 — CanonicalMessage/Conversation stay free of Nostr wire fields; contract locked
- Evidence: decoupling-s3-canonical-boundary.contract.test.ts · vitest Pass
- Next: S2 commercial (PB1-A / hitch) or named S4
### 2026-10-18T09:50:00Z checkpoint
- Summary: Working names — Obscur is the platform; Obscur-Nostr is the Nostr module (no package rename)
- Evidence: specs/backend/obscur-platform-service-vision-2026-10.md § Names
- Next: Wait for a named in-repo task
### 2026-10-18T09:48:00Z checkpoint
- Summary: Slice D2 — Nostr adapter implementation moved to protocol-adaptation/nostr; parent file re-exports
- Evidence: apps/pwa/app/features/protocol-adaptation/nostr/nostr-adapter.ts · vitest D0/D1/C1/P3 Pass
- Next: Wait for a named task (not S4–S6)
### 2026-10-18T09:45:00Z checkpoint
- Summary: Slice D1 — nostrAdapter is the only value importer of DM send/list ports; delete and retry call nostrAdapter.sendDm
- Evidence: decoupling-d1-choke-point.contract.test.ts · delete pipeline + D0 vitest Pass
- Next: Wait for D2 charter
### 2026-10-18T09:42:00Z checkpoint
- Summary: Slice D0 characterization landed — Nostr default path frozen (routing, status map, Tor honesty, Matrix gate)
- Evidence: apps/pwa/app/features/protocol-adaptation/decoupling-d0-characterization.test.ts · vitest 5 passed
- Next: Wait for D1 charter
### 2026-10-18T09:40:00Z checkpoint
- Summary: Behavior-preserving decoupling design — strangler behind ProtocolAdaptationLayer; D0 characterization → D1 choke-point → D2 Nostr folder; no S6 redesign
- Evidence: specs/backend/behavior-preserving-decoupling-design-2026-10.md
- Next: Maintainer charters D0 (or another named slice)
### 2026-10-18T09:35:00Z checkpoint
- Summary: Promotion goal — platform service for bespoke decentralized comms apps; Nostr first; modularity is target not present tense
- Evidence: specs/backend/obscur-platform-service-vision-2026-10.md
- Next: was decoupling design (done)
### 2026-10-18T09:30:00Z checkpoint
- Summary: Vision recorded — unified client = gateway + per-protocol modules/UI; Obscur redesign ≈ impossible under budget
- Evidence: specs/backend/unified-protocol-client-vision-2026-10.md
- Next: was platform-service vision (done)
### 2026-10-18T09:25:00Z checkpoint
- Summary: Maintainer — no spare time or tokens for a rewrite; coupling blocks new protocols and a safe TS→Rust migration
- Evidence: this handoff § Maintainer instruction
- Next: was vision note (done)
### 2026-10-18T09:20:00Z checkpoint
- Summary: Maintainer — agents keep locking Obscur into Nostr despite protocol-client instructions; greenfield already discarded the UI
- Evidence: this handoff § Maintainer instruction
- Next: Stop Nostr polish; wait for a named in-repo task
### 2026-10-18T09:00:00Z checkpoint
- Summary: Scrap Matrix launch; reject Nostr-only brand; launch face = private-trust / operator infra (VPN, DC, private relays)
- Evidence: product-positioning-private-trust-launch-2026-10.md · charter operator-sovereign scale
- Next: Ask — private-trust demo kit / Local+Hybrid soak / copy hardening
### 2026-10-18T08:20:00Z checkpoint
- Summary: Standard catalog = 4 paths (everyday / hybrid / local / Tor); Advanced keeps full 9-pack catalog
- Evidence: specs/ui/relays-transport-paths-2026-10.md · vitest transport-preset catalog Pass
- Next: was positioning decision (done)
### 2026-11-09T19:49:40Z checkpoint
- Summary: Cut 0.5 CRM relationship_edge ports L1 Pass (upsert/get/list/removed; messages never invent edges; Soft L3 not claimed)
- Evidence: cargo test -p libobscur --lib db::repositories::relationships — 5 passed; packages/libobscur/src/db/repositories/relationships.rs; wipe includes Cut 0 tables
- Uncertainty: TS trust projection still localStorage until later wire; Soft L3 remains paused
- Next: Cut 0.6 thin H-dc v0.1 ciphertext client + poll receive (L1 mock fetch; extend P4b; no Soft L3 claim)
### 2026-11-09T19:53:40Z checkpoint
- Summary: Cut 0.6 thin H-dc v0.1 ciphertext+poll L1 Pass (health/sendEnvelope/listEnvelopes?since; plaintext rows dropped; lab server envelope+health)
- Evidence: vitest private-dc-hdc-v01 + private-dc-client 10 Pass; private-dc-client.ts; private-dc-lab-server.mjs
- Uncertainty: Adapter still uses v0 plaintext send until 0.8 DR seal path; Soft L3 paused
- Next: Cut 0.7 outbox + status machine wired to H-dc ACK (accepted≠delivered; Soft L3 not claimed)
### 2026-11-09T19:57:38Z checkpoint
- Summary: Cut 0.7 outbox + home-ACK status L1 Pass (accepted≠delivered; enqueue/due/bump; TS mapHomeAckToStatus)
- Evidence: cargo test db::repositories::outbox 4 Pass; vitest hdc-outbox-status 3 Pass
- Uncertainty: Full send pipeline over H-dc still owed in 0.8; Soft L3 paused
- Next: Cut 0.8 T3 DR send/receive 1:1 over H-dc (single-device first; Soft L3 not claimed)
### 2026-11-09T20:00:20Z checkpoint
- Summary: Cut 0.8 T3 DR seal/open over H-dc envelope L1 Pass (dr_session persist; Alice→Bob vectors; NIP-17≠T3)
- Evidence: cargo test t3_hdc 3 Pass · dr_sessions 1 Pass
- Uncertainty: L2 dual-profile lab soak still owed; full IPC send path later
- Next: Cut 0.9 vault envelopes kept; media refs on messages (no plaintext media in DB; Soft L3 not claimed)
### 2026-11-09T20:05:40Z checkpoint
- Summary: Cut 0.9–0.10 closed: vault ref L1 (SCHEMA_V6 content_hash; reject inline data URLs) + lab milestone checklist documented
- Evidence: cargo test vault_media + db::tests Pass; specs/backend/cut0-lab-milestone-checklist-2026-11-09.md
- Uncertainty: L2 soak not run this turn; Soft L3 paused
- Next: Maintainer — run Cut 0.10 L2 lab soak OR charter next NARROW cut (UI / S1 compose / IPC glue); Soft L3 remains paused
### 2026-11-10T03:53:43Z checkpoint
- Summary: Cut 0 privateTrust glue L1+headless Pass (CRM/T3 prepare→ACK; cut0-lab-hdc-t3-soak steps 6–8)
- Evidence: cargo test t3_hdc_pipeline + private_trust_crm Pass; node scripts/cut0-lab-hdc-t3-soak.mjs Pass
- Uncertainty: Desktop unlock/CRM UI soak not run; Soft L3 paused
- Next: Maintainer — desktop L2 soak (unlock/lock) OR charter next NARROW cut (UI/S1/wire privateTrust to send); Soft L3 paused
### 2026-11-10T03:56:36Z checkpoint
- Summary: Maintainer replacement-style rewrite posture recorded (NARROW product cut; kill unviable foundations; Cut 1 = authority cutover)
- Evidence: specs/backend/rewrite-replacement-posture-2026-11-09.md
- Uncertainty: Kill list inventory not yet enumerated file-by-file
- Next: Write Cut 1 design — Replacement authority (kill list of old CRM/DM/durability owners + cutover + proof); Soft L3 paused
### 2026-11-10T04:03:54Z checkpoint
- Summary: Cut 1 Replacement authority design draft landed (kill list K-CRM/K-MSG-DUR/K-OUTBOX-LS/K-SEND-FACE/K-CHATSTATE-AUTH/K-PROTO-PLAIN; slices 1.0–1.6)
- Evidence: specs/backend/cut1-replacement-authority-design-2026-11-09.md
- Uncertainty: ACK not yet recorded; migration UI vs silent import open
- Next: Maintainer ACK Cut 1 design (1.0) then impl 1.1 CRM authority cutover; Soft L3 paused
### 2026-11-10T04:25:14Z checkpoint
- Summary: Cut 1.0 ACK + Cut 1.1 CRM L1 Pass (K-CRM) — privateTrust CRM TS port; usePeerTrust native writes relationship_edge; peer-trust LS non-authoritative on Tauri
- Evidence: vitest relationship-edge-authority + owner-uniqueness + use-peer-trust (21 Pass); @obscur/private-trust-engine
- Uncertainty: Desktop L2 sticky restart not run this turn; Soft L3 paused
- Next: Cut 1.2 K-MSG-DUR (native message durability SQLite-only) or optional 1.1 L2 desktop soak; Soft L3 paused
### 2026-11-10T04:34:09Z checkpoint
- Summary: Cut 1.2 K-MSG-DUR L1 Pass — MessageQueue all I/O gated; openMessageDb rejects on native; restore/reset skip message IDB
- Evidence: vitest cut1-message-durability.owner-uniqueness + dm-durability-contract (18 Pass); specs/backend/cut1-1.2-message-durability-design-2026-11-09.md
- Uncertainty: Desktop L2 message-survives-restart not run; Soft L3 paused
- Next: Cut 1.3 K-OUTBOX-LS (subtract dm_message_queue_v1); Soft L3 paused
### 2026-11-10T04:45:35Z checkpoint
- Summary: Cut 1.3 K-OUTBOX-LS L1 Pass — dm_message_queue_v1 never written/read on native; scrub residual; sendDmWithRetry refuses LS queue claim
- Evidence: vitest cut1-outbox-ls.owner-uniqueness (3 Pass); specs/backend/cut1-1.3-outbox-ls-design-2026-11-09.md
- Uncertainty: Full prepare→ACK send-face is Cut 1.4; Soft L3 paused
- Next: Cut 1.4 K-SEND-FACE / K-PROTO-PLAIN; Soft L3 paused
### 2026-11-10T05:04:59Z checkpoint
- Summary: Cut 1.4 K-SEND-FACE/K-PROTO-PLAIN L1 Pass — private_dc refuses plaintext; sendDm→prepareT3Outbound→envelope→completeT3HomeAck
- Evidence: vitest cut1-private-trust-send-face + private-dc-adapter (12 Pass); specs/backend/cut1-1.4-private-trust-send-face-design-2026-11-09.md
- Uncertainty: Desktop L2 T3 send soak owed; Soft L3 paused
- Next: Cut 1.5 K-CHATSTATE-AUTH; Soft L3 paused
### 2026-11-10T05:15:00Z checkpoint
- Summary: Cut 1.5 K-CHATSTATE-AUTH L1 Pass — chat-state CRM/message writers demoted; sanitize strips connectionRequests+bodies; social/send import boundary
- Evidence: vitest dm-kernel-chat-state-io-policy + io.contract + cut1-chat-state-demotion.owner-uniqueness (16 Pass); specs/backend/cut1-1.5-chat-state-demotion-design-2026-11-09.md
- Uncertainty: Desktop L2 soaks still owed under 1.1–1.4; Soft L3 paused
- Next: Cut 1.6 lab checklist (new path only); Soft L3 paused
### 2026-11-10T05:30:00Z checkpoint
- Summary: Cut 1.6 lab checklist + new-path soak — Cut 1 CLOSED (1.0–1.6); old path banned table; Soft L3 not claimed
- Evidence: specs/backend/cut1-lab-milestone-checklist-2026-11-09.md; node scripts/cut1-lab-new-path-soak.mjs Pass (31 vitest + H-dc wire)
- Uncertainty: Desktop L2 operator checklist steps 1–8 still owed; Soft L3 paused
- Next: Maintainer charter next NARROW cut; Soft L3 paused
### 2026-11-10T07:05:00Z checkpoint
- Summary: Cut 2 private-trust product face design draft landed (S1 compose; K-DEFAULT-NOSTR/K-COMPOSE-RELAY/K-SEND-FALLBACK/K-INVITE-NOSTR; slices 2.0–2.4)
- Evidence: specs/backend/cut2-private-trust-product-face-design-2026-11-09.md
- Uncertainty: ACK not yet recorded; invite copy open; Soft L3 paused
- Next: Maintainer ACK Cut 2.0 then impl 2.1; Soft L3 paused
### 2026-11-10T07:12:00Z checkpoint
- Summary: Cut 2.0 ACK + Cut 2.1 K-DEFAULT-NOSTR L1 Pass — resolveActiveProtocolId prefers private_dc when native+H-dc session; explicit selection wins; no Nostr default write
- Evidence: vitest preferences.cut2-default + cut2-default-protocol.owner-uniqueness (7 Pass)
- Uncertainty: Composer honesty / silent Nostr fallback still Cut 2.2; Soft L3 paused
- Next: Cut 2.2 K-COMPOSE-RELAY / K-SEND-FALLBACK; Soft L3 paused
### 2026-11-10T07:35:00Z checkpoint
- Summary: Cut 2.2 K-COMPOSE-RELAY/K-SEND-FALLBACK L1 Pass — Private DC chips; composer H-dc·T3 chrome; sendDmWithRetry refuses silent Nostr
- Evidence: vitest cut2-compose-honesty + private-trust-compose-policy + chips + dm-send-with-retry.cut2 (10 Pass)
- Uncertainty: Invite path still throws on private_dc (Cut 2.3); Soft L3 paused
- Next: Cut 2.3 K-INVITE-NOSTR; Soft L3 paused
### 2026-11-10T07:55:00Z checkpoint
- Summary: Cut 2.3 K-INVITE-NOSTR L1 Pass — invite policy refuses private_dc/matrix with Obscur-Nostr honesty; SendResult not throw; dialog banner
- Evidence: vitest private-trust-invite-policy + cut2-invite-policy.owner-uniqueness (7 Pass)
- Uncertainty: Desktop L2 compose soak still Cut 2.4; Soft L3 paused
- Next: Cut 2.4 lab checklist; Soft L3 paused
### 2026-11-10T08:58:00Z checkpoint
- Summary: Cut 2.4 lab checklist + product-face soak — Cut 2 CLOSED (2.0–2.4); Soft L3 not claimed
- Evidence: specs/backend/cut2-lab-milestone-checklist-2026-11-09.md; node scripts/cut2-lab-product-face-soak.mjs Pass (24+31 vitest + H-dc wire)
- Uncertainty: Desktop L2 operator checklist steps 1–8 still owed; Soft L3 paused
- Next: Maintainer charter next NARROW cut; Soft L3 paused
### 2026-11-10T09:05:00Z checkpoint
- Summary: Cut 3 Cut UI Vite thin-shell design draft landed (K-NEXT-MONOLITH/K-UI-AS-BACKEND/K-DUAL-ENTRY/K-SHELL-INVENT; slices 3.0–3.5; Continuity/F-sync out of scope)
- Evidence: specs/backend/cut3-ui-vite-thin-shell-design-2026-11-09.md
- Uncertainty: ACK not yet recorded; package path open; Soft L3 paused
- Next: Maintainer ACK Cut 3.0 then impl 3.1; Soft L3 paused
### 2026-11-10T09:15:00Z checkpoint
- Summary: Cut 3.0 ACK + Cut 3.1 L1 Pass — `apps/desktop-ui` Vite scaffold; Tauri `dev:vite-lab`; K-SHELL-INVENT contract; Next beta path unchanged
- Evidence: pnpm verify:cut3-1 Pass; apps/desktop/src-tauri/tauri.vite.lab.conf.json; specs/backend/cut3-ui-vite-thin-shell-design-2026-11-09.md
- Uncertainty: Auth door still 3.2; private-trust compose on Vite still 3.3; Soft L3 paused
- Next: Cut 3.2 auth door on Vite; Soft L3 paused
### 2026-11-10T09:25:00Z checkpoint
- Summary: Cut 3.2 L1 Pass — shared resolveAuthShellReady in @dweb/auth; Vite AuthDoor via DeviceUnlockPort; AuthGateway uses same gate; lab unlock port (no parallel PDK)
- Evidence: pnpm verify:cut3-2 Pass; packages/dweb-auth/src/policy/auth-shell-ready-gate.ts; apps/desktop-ui/src/auth/*
- Uncertainty: Native auth-kernel DeviceUnlockPort wire still optional L2; compose still 3.3; Soft L3 paused
- Next: Cut 3.3 private-trust home on Vite; Soft L3 paused
### 2026-11-10T09:30:00Z checkpoint
- Summary: Cut 3.3 L1 Pass — PrivateTrustHome on Vite (protocols + list + composer); shared compose-face in @obscur/private-trust-engine; silent-Nostr refuse; no chat-state authority
- Evidence: pnpm verify:cut3-3 Pass; apps/desktop-ui/src/private-trust/*; packages/obscur-private-trust-engine/src/private-trust-compose-face.ts
- Uncertainty: Native PAL/T3 wire L2 still owed; dual-entry quarantine still 3.4; Soft L3 paused
- Next: Cut 3.4 dual-entry quarantine; Soft L3 paused
### 2026-11-10T09:50:00Z checkpoint
- Summary: Cut 3.4 L1 Pass — dual-entry quarantine; lab defaults to Vite via OBSCUR_TAURI_LAB_UI / dev:desktop:lab; production frontendDist stays pwa/out (no silent beta wipe)
- Evidence: pnpm verify:cut3-4 Pass; specs/backend/cut3-dual-entry-quarantine-2026-11-09.md; scripts/obscur-desktop-lab-entry.mjs
- Uncertainty: Desktop L2 Vite soak still 3.5; Soft L3 paused
- Next: Cut 3.5 Vite lab checklist; Soft L3 paused
### 2026-11-10T09:57:00Z checkpoint
- Summary: Cut 3.5 lab checklist + vite-shell soak — Cut 3 CLOSED (3.0–3.5); Soft L3 not claimed; production Next intact
- Evidence: specs/backend/cut3-lab-milestone-checklist-2026-11-09.md; node scripts/cut3-lab-vite-shell-soak.mjs Pass (13 vitest + vite build)
- Uncertainty: Desktop L2 operator checklist steps 1–8 still owed; native DeviceUnlockPort / live T3 optional; Soft L3 paused
- Next: Maintainer charter next NARROW cut; Soft L3 paused
### 2026-11-10T10:02:00Z checkpoint
- Summary: Cut 4 Vite native port-wire design draft landed (K-LAB-UNLOCK/K-LAB-HOME/K-PWA-MEGA-IMPORT/K-VITE-L2-GAP; slices 4.0–4.4; Soft L3/Continuity out of scope)
- Evidence: specs/backend/cut4-vite-native-port-wire-design-2026-11-09.md
- Uncertainty: ACK not yet recorded; unlock extract path open; Soft L3 paused
- Next: Maintainer ACK Cut 4.0 then impl 4.1; Soft L3 paused
### 2026-11-10T10:20:00Z checkpoint
- Summary: Cut 4.0 ACK + Cut 4.1 L1 Pass — package DeviceUnlock adapter + Vite resolve without apps/pwa mega-import; native PRODUCT_READY=false (lab default)
- Evidence: packages/obscur-auth-engine/src/device-unlock-adapter.ts; apps/desktop-ui verify:cut4-1; specs/backend/cut4-vite-native-port-wire-design-2026-11-09.md
- Uncertainty: PDK/Tauri unlock handlers + PrivateTrustHome native ports still 4.2+; Soft L3 paused
- Next: Cut 4.2 native PrivateTrustHomePorts; Soft L3 paused
### 2026-11-10T10:35:00Z checkpoint
- Summary: Cut 4.2 L1 Pass — native PrivateTrustHomePorts via HostEnginePort edge/dm list + sendPrivateTrustT3ViaHost (injectable home deliver); silent-Nostr refuse retained; App still lab until 4.3
- Evidence: packages/obscur-private-trust-engine/src/private-trust-t3-send.ts · private-trust-home-list.ts; apps/desktop-ui verify:cut4-2; Soft L3 not claimed
- Uncertainty: App prefer-native + PDK unlock PRODUCT_READY still 4.3; Vite L2 soak 4.4; Soft L3 paused
- Next: Cut 4.3 App prefer-native selection; Soft L3 paused
### 2026-11-10T11:10:00Z checkpoint
- Summary: Cut 4.3 L1 Pass — App prefer-native when Tauri present; lab stubs only for OBSCUR_DESKTOP_UI_LAB_STUBS=1 or host absent; unlock handlers + H-dc deliver fail-closed until 4.4
- Evidence: apps/desktop-ui verify:cut4-3; runtime/desktop-ui-adapter-selection.ts; Soft L3 not claimed
- Uncertainty: PDK unlock handlers + sessioned H-dc deliver + Vite L2 soak still 4.4; Soft L3 paused
- Next: Cut 4.4 Vite L2 lab checklist; Soft L3 paused
### 2026-11-10T12:50:00Z checkpoint
- Summary: Cut 4 CLOSED (4.0–4.4) — passphrase DeviceUnlock handlers + sessioned H-dc deliver + lab checklist/soak; Soft L3 not claimed; production Next intact
- Evidence: node scripts/cut4-lab-vite-native-soak.mjs; specs/backend/cut4-lab-milestone-checklist-2026-11-09.md
- Uncertainty: Operator desktop L2 steps 1–8 still owed; Soft L3 paused
- Next: Maintainer charter next NARROW cut; Soft L3 paused
### 2026-11-10T13:05:00Z checkpoint
- Summary: Cut 5.0 ACK + Cut 5.1 L1 Pass — Vite production cutover readiness/rollback resolver; committed frontendDist still Next; Soft L3/Continuity not claimed
- Evidence: pnpm verify:cut5-1; specs/backend/cut5-vite-production-cutover-design-2026-11-10.md
- Uncertainty: 5.2 opt-in recipe wire + 5.3 committed flip still open; Soft L3 paused
- Next: Cut 5.2 opt-in Vite-as-default recipes; Soft L3 paused
### 2026-11-10T13:20:00Z checkpoint
- Summary: Cut 5.2 L1 Pass — desktop dev/build route through run-desktop-production.mjs; OBSCUR_DESKTOP_UI_AS_DEFAULT=1 selects Vite overlay; committed dist still Next
- Evidence: pnpm verify:cut5-2; Soft L3 not claimed
- Uncertainty: 5.3 committed frontendDist flip still open; Soft L3 paused
- Next: Cut 5.3 commit dist flip + Next rollback overlay; Soft L3 paused
### 2026-11-10T13:35:00Z checkpoint
- Summary: Cut 5.3 L1 Pass — committed frontendDist ../../desktop-ui/dist; tauri.next.rollback.conf.json; production default Vite; Next via PRODUCTION_ENTRY=next
- Evidence: pnpm verify:cut5-3; Soft L3 not claimed
- Uncertainty: 5.4 L2 lab checklist / optional L4 still open; Soft L3 paused
- Next: Cut 5.4 lab checklist; Soft L3 paused
### 2026-11-10T13:45:00Z checkpoint
- Summary: Cut 5 CLOSED (5.0–5.4) — lab checklist + headless soak; Vite production default; Soft L3/Continuity not claimed
- Evidence: pnpm verify:cut5-4; cut5-lab-milestone-checklist-2026-11-10.md
- Uncertainty: operator L2 soak + optional packaged L4 still open; Soft L3 paused
- Next: maintainer next NARROW cut; Soft L3 paused
### 2026-11-10T14:05:00Z checkpoint
- Summary: Cut 6.0 ACK + 6.1 L1 Pass — mobile PWA overlay + Android CI no longer asserts Next in committed desktop conf
- Evidence: pnpm verify:cut6-1; Soft L3 not claimed
- Uncertainty: 6.2 package/release copy + 6.3 channel honesty still open; Soft L3 paused
- Next: Cut 6.2; Soft L3 paused
### 2026-11-10T14:20:00Z checkpoint
- Summary: Cut 6 CLOSED (6.0–6.4) — release/CI Vite-align + mobile overlay; Soft L3/Continuity not claimed
- Evidence: pnpm verify:cut6-4; cut6-lab-milestone-checklist-2026-11-10.md
- Uncertainty: optional packaged L4 + next NARROW charter; Soft L3 paused
- Next: maintainer next NARROW cut; Soft L3 paused
### 2026-11-10T15:15:00Z checkpoint
- Summary: Cut 7.0 ACK — Continuity M1 / F-sync C0 design; Soft L3 paused; Continuity Pass not claimed
- Evidence: cut7-continuity-m1-sealed-file-design-2026-11-10.md
- Uncertainty: 7.1+ impl slices open; Soft L3 paused
- Next: Cut 7.1 law contracts; Soft L3 paused
### 2026-11-10T15:20:00Z checkpoint
- Summary: Cut 7.1 L1 Pass — Continuity M1 law contracts; Soft L3 paused; Continuity Pass not claimed
- Evidence: pnpm run verify:cut7-1
- Uncertainty: 7.2 sealed snapshot inventory still open; Soft L3 paused
- Next: Cut 7.2; Soft L3 paused
### 2026-11-10T15:30:00Z checkpoint
- Summary: Cut 7.2 L1 Pass — sealed snapshot T0–T2 inventory + honesty classifier; Continuity Pass not claimed
- Evidence: pnpm run verify:cut7-2
- Uncertainty: 7.3 SQLite T3 preference still open; Soft L3 paused
- Next: Cut 7.3; Soft L3 paused
### 2026-11-10T16:40:00Z checkpoint
- Summary: Cut 7.3 L1 Pass — prefer SQLite T3; refuse chat-state-as-sole CRM on Continuity restore; Soft L3/Continuity Pass not claimed
- Evidence: pnpm run verify:cut7-3
- Uncertainty: 7.4 Vite Continuity door still open; Soft L3 paused
- Next: Cut 7.4; Soft L3 paused
### 2026-11-10T16:50:00Z checkpoint
- Summary: Cut 7 CLOSED (7.0–7.5) — Continuity M1 + Vite door (lab ports); Continuity Pass / Soft L3 not claimed
- Evidence: pnpm run verify:cut7-5; cut7-lab-milestone-checklist-2026-11-10.md
- Uncertainty: native M1 adapter + optional Next M1 L2 still open; Soft L3 paused
- Next: maintainer next NARROW cut; Soft L3 paused
### 2026-11-10T17:30:00Z checkpoint
- Summary: Cut 8 CLOSED (8.0–8.5) — Vite-native Continuity M1 seal/ports + prefer-native door; Continuity Pass / Soft L3 not claimed
- Evidence: pnpm run verify:cut8-5; cut8-lab-milestone-checklist-2026-11-10.md
- Uncertainty: full EncryptedAccountBackupPayload parity + optional L2 file soak still open; Soft L3 paused
- Next: maintainer next NARROW cut (M2 / Soft L3 / product-depth); Soft L3 paused
### 2026-11-10T18:15:00Z checkpoint
- Summary: Cut 9 CLOSED (9.0–9.5) — Continuity M2 opaque home publish/restore; Continuity Pass / Soft L3 not claimed
- Evidence: pnpm run verify:cut9-5; cut9-lab-milestone-checklist-2026-11-10.md
- Uncertainty: background auto-schedule + optional live lab L2 still open; Soft L3 paused
- Next: maintainer next NARROW cut (Soft L3 / Vite depth / M4); Soft L3 paused
### 2026-11-10T18:45:00Z checkpoint
- Summary: Cut 10 CLOSED (10.0–10.5) — Continuity M4 offer/accept (TTL + transfer code); Continuity Pass / Soft L3 not claimed
- Evidence: pnpm run verify:cut10-5; cut10-lab-milestone-checklist-2026-11-10.md
- Uncertainty: LAN/WebRTC pipe + M5 linked devices still open; Soft L3 paused
- Next: maintainer next NARROW cut (Vite product-depth / Soft L3 / M5); Soft L3 paused
<!-- CONTEXT_CHECKPOINTS_END -->
