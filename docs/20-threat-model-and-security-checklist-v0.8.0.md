# Threat Model and Security Checklist (v0.8.0)

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._

This is the operational threat model for the `v0.8.0` hardening cycle.

## 1) Security Objectives

1. Confidentiality of message content and sensitive metadata.
2. Integrity of message/event ordering and state transitions.
3. Availability under partial relay/provider failure.
4. Key material remains device-local and never intentionally exposed.

## 2) Assets to Protect

1. Identity keys and session secrets.
2. Message plaintext and attachment references.
3. Group/community room keys and membership signals.
4. Local persisted chat state and privacy settings.

## 3) Threat Actors

1. Honest-but-curious relays/providers observing metadata.
2. Malicious relay injecting replays, duplicates, out-of-scope events.
3. Network adversary forcing degraded connectivity and timing pressure.
4. Local device attacker with filesystem/browser-profile access.
5. Abuse/spam actors targeting group/community workflows.

## 4) Trust Boundaries

1. UI state vs. persisted state (`apps/pwa` hooks/services vs IndexedDB stores).
2. App runtime vs. relay/provider infrastructure.
3. PWA runtime vs. desktop native bridge behavior.
4. Local settings policy vs. network-side behavior.

## 5) Key Risks for v0.8.0

1. Relay scope mismatch floods degrade UX and obscure actionable failures.
2. Event race windows can produce duplicate, dropped, or out-of-order views.
3. Attachment/provider behavior leaks unnecessary metadata in error paths.
4. User misunderstanding of backup/recovery creates irreversible account loss.

## 6) Mitigations Required for v0.8.0

1. Enforce scoped validation, dedupe, and idempotent reducers in messaging paths.
2. Convert noisy transport/protocol errors into controlled UX states.
3. Keep secure defaults for relay/provider/privacy settings.
4. Add explicit user guidance for key ownership and recovery.
5. Require security-sensitive PR checklist completion before merge.

## 7) Security Review Checklist

### Code and Dependency Checks

1. Run `pnpm audit --recursive` (or equivalent workspace audit) and triage findings.
2. Confirm no new insecure crypto primitives or downgraded verification paths.
3. Confirm no sensitive logs expose plaintext keys/content.

### Messaging and Group Invariants

1. Verify dedupe by event/message id in burst scenarios.
2. Verify order invariants for mixed new/update/delete streams.
3. Verify relay-scope checks reject out-of-scope events without UI corruption.

### Storage and Local State

1. Verify no plaintext secret material is persisted outside intended stores.
2. Verify privacy settings changes propagate to all consumers.
3. Verify startup/migration path does not break existing local history.

### UX and Operational Safety

1. Verify all critical user-visible failures have clear recovery actions.
2. Verify light/dark theme contrast for security-relevant warnings and actions.
3. Verify rollback path for `chatPerformanceV2` and other high-risk toggles.

## 8) Required Artifacts Before v0.8.0 Tag

1. Audit output summary and disposition log.
2. Security test evidence for DM/group/message pipeline.
3. Final risk acceptance note for any deferred items.
4. Link to go/no-go record and release checklist evidence.

## 9) Related References

1. [Security and Privacy Model](./09-security-and-privacy-model.md)
2. [Runtime Contracts and Invariants](./11-runtime-contracts-and-invariants.md)
3. [Regression Playbooks](./14-regression-playbooks.md)
4. [v0.8.0 Release Readiness Plan](./19-v0.8.0-release-readiness-plan.md)
5. [Dependency Audit Triage (v0.8.0)](./21-dependency-audit-triage-v0.8.0.md)
