# Soak — P2-S S3 inbound preview gate L3 (2026-11)

**Status:** **L3 Pass** — `docs/handoffs/p2s-s3-inbound-preview-l3-soak-latest.{json,md}`  
**Parent:** [sandboxed-storage-security-design-2026-11.md](./sandboxed-storage-security-design-2026-11.md)

```text
HANDOFF ATOMIC STEP: P2-S S3 inbound preview L3 soak — closed (Pass)
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     Storage · inbound-media-preview
PROOF:               Desktop CDP quarantined/denied block · allowed PNG blob: · no shell open
```

## 1. Goal

Prove live desktop that quarantined / policy-denied inbound attachments do not receive `blob:` preview URLs, while allowlisted PNG still can — via product preview helpers on `__OBSCUR_STORAGE_SOAK__`.

## 2. Matrix

| Check | Pass when |
|-------|-----------|
| `hooksPresent` | `shouldAllowInboundMediaPreview` + `createInboundMediaPreviewObjectUrl` on soak |
| `quarantinedBlocked` | quarantined PNG → preview false · createObjectUrl null |
| `deniedExeBlocked` | `.exe` → preview false · createObjectUrl null |
| `allowedPngPreview` | available PNG → preview true · createObjectUrl starts with `blob:` (revoked after) |
| `previewModuleNoShellOpen` | preview `.ts` has no `openPath` / `shell.open` |

## 3. Non-claims

- Soft L3 / Tor Verified / export consent (S4) / cross-profile (S5)
