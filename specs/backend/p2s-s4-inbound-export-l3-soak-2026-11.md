# Soak — P2-S S4 inbound export L3 (2026-11)

**Status:** Pass (L3)  
**Parent:** [sandboxed-storage-security-design-2026-11.md](./sandboxed-storage-security-design-2026-11.md)  
**Artifact:** [p2s-s4-inbound-export-l3-soak-latest.md](../../docs/handoffs/p2s-s4-inbound-export-l3-soak-latest.md)

```text
HANDOFF ATOMIC STEP: P2-S S4 inbound export L3 soak — DONE Pass
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     Storage · inbound-media-export
PROOF:               CDP matrix all true (consent · no system-open · module honesty)
```

## 1. Goal

Prove on live desktop that quarantined / preview-denied inbound media **cannot leave the sandbox without `userConsentConfirmed`**, and that the export path never auto-opens via OS shell.

Native save-picker after consent is out of unattended scope (cancel/saved both OK if consent was required first).

## 2. Matrix

| Check | Pass when |
|-------|-----------|
| `quarantineRequiresConfirm` | `requiresInboundMediaExportConfirm({ quarantined }) === true` |
| `deniedExeRequiresConfirm` | exe/svg-class inputs require confirm |
| `exportWithoutConsentBlocked` | `exportInboundMediaToUserPath(…, false) → consent_required` |
| `planNeverSystemOpen` | `planInboundMediaWrite(…).allowSystemOpen === false` |
| `exportModuleNoShellOpen` | `inbound-media-export.ts` has no `openPath` / `shell.open` |

## 3. Impl

1. `storage-soak-hooks.ts` — Tauri-only window hooks.
2. Install beside PAL soak hooks.
3. `scripts/p2s-s4-inbound-export-l3-soak-cdp.mjs` + handoff artifact.

## 4. Non-claims

- Soft L3 / Tor Verified / antivirus
- Unattended full save-as success (picker may cancel)
