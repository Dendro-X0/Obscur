# Current Session Handoff

- Last Updated (UTC): 2026-10-26T07:15:00Z
- Session Status: **ACTIVE** · v2.0.0-beta.3 **Published** (Win/macOS/Linux) · Stay Tauri
- Active Owner: maintainer (sole) · ENGINE-LAB

## Maintainer instruction (binding)

```text
PROMOTION GOAL: Obscur as a service for building decentralized communication apps
(businesses / communities) — Nostr supported today; modular foundation for bespoke work later.
v2.0.0 PUBLIC FACE: attractive · reliable · trustworthy — Gift GIFs + prior client tests prove shipped features.
Do NOT market Obscur as finished multi-protocol / “any adapter” today.
Do NOT refactor sessions into a Nostr-client product identity.
Do NOT treat the Nostr kernel as the permanent ceiling — but do NOT lie that it is already decoupled.
Decoupling = strangler extraction behind ProtocolAdaptationLayer; behavior must stay identical.
Greenfield restart is NOT the path. No mega-refactor / gateway-per-protocol UI without charter + budget.
Module name for the Nostr protocol piece: Obscur-Nostr. Public name stays Obscur.
MEDIA TRUTH: 1:1 voice shipped. Gap = video usability (M1-L3) + conferencing (M2–M3).
CAMERA: Maintainer has no camera — do NOT claim video demoable; M1-L3 blocked.
M1-A/B/C DONE L1 (structure · camera fallback · lab canvas). Lab canvas ≠ Gift demo. Do NOT claim video usable.
If a task cannot proceed without centering Nostr-as-the-product, STOP and ask.
```

## Active Objective

**Cut `v2.0.0-beta.3`** (package tree 2.0.0): Obscur Full Release for **Windows + macOS + Linux** (+ Android/web) so installers are not stale 1.9.16 carryovers. Soft L3 / Tor Verified / Spaces / Matrix remain PAUSED. Video **player UX** landed; do **not** claim video *calls* usable.

## Sequencing

```text
TRACK A–C / B10 — DONE (L1).
Matrix access-token login — DONE (L1) · lab only
Relays Standard/Advanced + four paths — DONE (L1)
DECISION 2026-10-18 — Matrix launch/promotion SCRAPPED until Olm
DECISION 2026-10-18 — Launch face = private-trust / own infra (VPN, DC, private relays)
DECISION 2026-10-18 — Decoupling via strangler (D0→D2); S6 gateway UI out of budget
DECISION 2026-10-18 — Names: Obscur = platform · Obscur-Nostr = Nostr module
DECISION 2026-10-18 — Media: voice shipped; gap = video + conference (M1–M3)
DECISION 2026-10-18 — v2.0.0 public: GIFs enough for prior features; no camera → no video usability claim
CHARTER 2026-10-18 — M1-A camera-less structure · DONE (L1)
CHARTER 2026-10-18 — M1-B transceiver + camera fallback · DONE (L1)
CHARTER 2026-10-18 — M1-C lab canvas · DONE (L1 · off in production)
FOCUS — Public trust face · hitch / PB1-C · M1-L3 only with camera
```

## Next Atomic Step

```text
v2.0.0-beta.3 — PUBLISHED (Latest) — https://github.com/Dendro-X0/Obscur/releases/tag/v2.0.0-beta.3
CI: https://github.com/Dendro-X0/Obscur/actions/runs/40281639059
Assets: Obscur_2.0.0_x64-setup.exe · _aarch64.dmg · _amd64.AppImage · APK/AAB · pwa tar.gz
version.json releaseTag 2.0.0-beta.3 · package tree 2.0.0
NEXT: confirm website /download · optional smoke
Do NOT claim video calls usable · Tor Verified · Soft L3 · Spaces · Matrix promote
Do NOT greenfield · Do NOT market as a Nostr client
```


## Landed

| Unit | Result |
|------|--------|
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
<!-- CONTEXT_CHECKPOINTS_END -->
