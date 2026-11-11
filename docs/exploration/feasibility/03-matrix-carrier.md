# Feasibility — Matrix as carrier (adapter only)

**ID:** F3  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F0.5 · F1 · F2 · F4 · F5 · F-sources · F-PSE · F-hub · F-groups · F-netconfig  
**As-built:** `matrixAdapter` (lab) — Client-Server REST login (password / access token), room sync, plaintext room send; **not** Matrix promote; no dual-write to Nostr  
**Claim language:** **explored as carrier** ≠ Matrix promote · ≠ Element parity · ≠ Olm/Megolm Pass in Obscur · ≠ OAuth-as-root

## 1. Scope

- **In:** What Matrix **is and is not** for Obscur; homeserver-as-home (H-hs) fit; Olm/Megolm honesty; how a Matrix **protocol app** links under the hub without becoming the workspace identity.
- **Out:** Promoting lab Matrix to production this phase; Soft L3; replacing private-trust launch with “just use Matrix.org.”

## 2. Basics

**Matrix** is a **federated** messaging protocol: users and rooms live on **homeservers** (HS) that speak a Client-Server API and federate Server-Server. Rooms have membership state, power levels, and optional encryption.

| Matrix is | Matrix is not |
|-----------|---------------|
| Strong fit for **Discord/Telegram-like** public & gated communities | Obscur’s universal auth door |
| A natural **H-hs** game-server (F4/F-groups) | A substitute for local relationship CRM (F1) |
| Carrier-native E2EE via **Olm** (1:1/key share) + **Megolm** (groups) | Automatically “Signal-grade groups” (Megolm PCS limits) |
| Session = MXID + access token + device | The same as workspace profile unlock |

**Obscur law:** Matrix = **linked-identity protocol app**. HS password/token login is **carrier session**, never root identity (no OAuth/email as Obscur root — attestation bridge only later).

### Crypto honesty (F-sources · F5)

| Piece | Role | F-PSE tier |
|-------|------|------------|
| Unencrypted room | HS can read | **T0** — label clearly |
| Olm | Double Ratchet relative; 1:1 / to-device | **T3** when enabled + verified |
| Megolm | Group sender-key ratchet; FS with **PCS caveats** | **T4-with-caveats** — must disclose |
| Cross-signing / SAS | Device trust UX | Required for honest “verified” claims |
| vodozemac | Rust Olm/Megolm impl | Library candidate when promote path opens |

As-built lab path today sends **room text over CS API** without advertising Olm/Megolm — treat current lab as **T0/transport** until crypto cut lands.

## 3. Capabilities map

| Need for Obscur | Can Matrix provide? | Notes |
|-----------------|---------------------|-------|
| Public / moderated communities | **Yes — strong** | Rooms, power levels, join rules ≈ G-public / G-discoverable |
| Private invite / knock rooms | **Yes** | Invite-only / knock — family & workspace |
| File / media hosting | **Partial** | HS media repo; still sandbox inbound (vault law) |
| Federation across orgs | **Yes** | Differentiator vs single private Nostr relay |
| Relationship CRM | **No** as authority | Room membership ≠ Obscur TRUSTED edge |
| Workspace auth / PDK / vault | **No** | Linked MXID only |
| Private-trust without federation | **Yes** | Self-hosted Synapse/Conduit — no public federation required |
| Replace Nostr adapter | **No** as sole carrier | Different discovery & identity culture; keep both as apps |
| Continuity | **Partial** | HS holds history; still need sealed workspace backup (F-sync) for CRM/settings |
| Tor underlay | **Orthogonal** | HTTPS via Tor — F6 |

## 4. Fit to planes

| Plane | Fit | Notes |
|-------|-----|-------|
| Auth | **Carrier session only** | `matrixLogin` / access-token bind under Settings → Protocol apps; workspace door separate |
| Profile | **Linked identity** | `@user:server` bound to workspace; hard isolation of tokens per profileId (as-built scoped storage) |
| Storage | **HS + local cache** | Room timeline may authoritative for Matrix-pinned groups; CRM/vault remain local |
| Relationship | **Intent / membership bridge** | May *propose* edges from room invites; never lookback-author TRUSTED |
| Message | **fit-with-adapter** | Map room events ↔ canonical DTOs; pin = Matrix for that group |
| Transport | **H-hs home** | Homeserver URL is the named home (F-netconfig); clearnet/Tor underlay |

## 5. Libraries / stacks

| Candidate | Lang | License | Maturity | Desktop/mobile | Notes |
|-----------|------|---------|----------|----------------|-------|
| As-built `matrix-cs-client` + adapter | TS | — | Lab | Desktop+PWA | Login, sync rooms, send text — **promote gated** |
| [vodozemac](https://github.com/matrix-org/vodozemac) | Rust | Apache-2.0 | Mature | FFI | Olm/Megolm when E2EE cut opens |
| matrix-rust-sdk / complementary SDK | Rust | — | Mature | — | Candidate for deeper promote; weigh binary size |
| Synapse | Python | AGPL | Mature | Server | Full HS ops cost |
| Conduit / Dendrite / etc. | Rust/Go | — | Varies | Server | Lighter self-host options |
| Element | — | — | Product | — | UX reference only — not embed-as-Obscur |

## 6. Feasibility verdict

**`fit-with-adapter`** — Matrix is a **strong second (or community-primary) carrier** for Obscur’s **public and moderated group** face and for orgs that already run an HS. It maps cleanly to F-groups **H-hs** pins and F-netconfig protocol apps.

**`lab-only` (today’s code claim)** — Access-token/password CS client without Olm/Megolm, cross-signing, or promote soak. Keep handoff rule: **Matrix promote gated**.

**`reject-for-core`** — Matrix session as Obscur root login; Matrix room membership as the only CRM; dual-writing Matrix↔Nostr in one room without a declared bridge product; unlabeled Megolm as full PCS.

### Adapter contract (normative intent)

```text
Workspace (auth · graph · vault)
        │
        ▼
 Canonical DTOs + group pin (protocol=matrix, home=HS URL)
        │
        ▼
 Matrix protocol app
        · linked MXID + device session (scoped to profileId)
        · CS API sync/send
        · later: vodozemac E2EE + verification UX
        ▼
 Homeserver (self-hosted or chosen federation)
```

**vs Nostr (F2):** Matrix wins moderated rooms & federation UX; Nostr wins key-native public relays & lighter personal homes. Private-trust 1:1 may still prefer Obscur T3 over H-relay (F5) even when Matrix exists for communities.

## 7. Risks / traps

- **Promote** from lab REST send → users believe E2EE.  
- Storing access tokens in web localStorage long-term (as-built) — move to kernel/keystore on Cut.  
- Equating HS admin with Obscur workspace admin.  
- Soft L3-class bugs if room history drives TRUSTED.  
- Fetching federation graph as “people you may know.”  
- Tor + Matrix.org centralization narratives mixed into private-trust marketing.

## 8. Open questions

1. Promote order: **self-hosted HS only** first, or allow matrix.org-class federation in Balanced profile?  
2. E2EE cut: vodozemac-in-kernel vs matrix-rust-sdk wholesale?  
3. How do Matrix room invites appear in Obscur Requests without becoming CRM authority?  
4. Shared Continuity: export Matrix crypto megolm keys into sealed backup — in-scope?  
5. Display names: one hub profile vs per-room Matrix displayname?

## 9. References

- Matrix Olm/Megolm: https://spec.matrix.org/latest/olm-megolm/  
- E2EE impl guide: https://matrix.org/docs/matrix-concepts/end-to-end-encryption/  
- `docs/exploration/feasibility/10-external-e2ee-protocol-sources.md` §9.5  
- `docs/exploration/feasibility/02-nostr-carrier.md` · `04-private-relay-server.md` · `05-e2ee-models.md`  
- `apps/pwa/app/features/protocol-adaptation/matrix-adapter.ts`  
- `apps/pwa/app/features/protocol-adaptation/matrix-capabilities.ts`  
- Handoff: Matrix access-token login L1 · **promote still gated**  
