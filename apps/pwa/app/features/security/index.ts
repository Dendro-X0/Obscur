/**
 * Security Feature Module
 * 
 * Exports security-related services, components, and types for:
 * - Key verification (identicons)
 * - Key change detection
 * - Relay trust scoring
 * - Security audit logging
 */

// Identicon / Key Verification
export {
  generateIdenticon,
  generateIdenticonDataUrl,
  compareIdenticons,
  type IdenticonOptions,
  type IdenticonData,
} from "./services/identicon-service";

export {
  Identicon,
  IdentityVerificationCard,
  type IdenticonProps,
  type IdentityVerificationCardProps,
} from "./components/identicon";

// Security Audit Logging
export {
  SecurityAuditLog,
  createSecurityAuditLog,
  type SecurityEvent,
  type SecurityEventType,
  type SecurityLogOptions,
} from "./services/security-audit-log";

// Key Change Detection
export {
  KeyChangeDetector,
  createKeyChangeDetector,
  type KnownKey,
  type KeyChangeEvent,
} from "./services/key-change-detector";

// Relay Trust Scoring
export {
  RelayTrustScorer,
  createRelayTrustScorer,
  type RelayTrustLevel,
  type RelayMetrics,
  type RelayScore,
} from "./services/relay-trust-scorer";

// Security Integration (v1.4.7 Goal 4) - Production wiring for security services
export {
  assertNoBlockedSecretMaterial,
  findSecretMaterialInText,
  isForbiddenSecretInput,
  SECRET_INPUT_FIREWALL_MESSAGE,
  textContainsBlockedSecretMaterial,
  type SecretInputBlockResult,
  type SecretInputContext,
  type SecretMaterialKind,
  type SecretMaterialMatch,
} from "./services/secret-input-firewall";

export {
  isPrivateKeyExportConfirmed,
  PRIVATE_KEY_EXPORT_CONFIRM_TEXT,
  PRIVATE_KEY_CLIPBOARD_CLEAR_MS,
  schedulePrivateKeyClipboardClear,
} from "./services/private-key-export-gate";

export { SecurityLiteracyNote } from "./components/security-literacy-note";

export {
  buildIdentityBindingFromResolvedIdentity,
  buildIdentityBindingViewModel,
  formatIdentityKeyFragment,
  identityBindingSourceI18nKey,
  type IdentityBindingResolverSource,
  type IdentityBindingViewModel,
} from "./services/identity-binding-presenter";

export { IdentityBindingPanel } from "./components/identity-binding-panel";
export { IdentityBindingAcceptDialog } from "./components/identity-binding-accept-dialog";
export { SendCeremonyDialog } from "./components/send-ceremony-dialog";

export {
  acknowledgeSendCeremony,
  buildSendCeremonyViewModel,
  isSendCeremonyAcknowledged,
  requiresFirstDmSendCeremony,
  type SendCeremonyRequest,
  type SendCeremonyViewModel,
} from "./services/send-ceremony-gate";

export {
  assertIdentityPassphrasePolicy,
  evaluateIdentityPassphrasePolicy,
  IdentityPassphrasePolicyError,
  isIdentityPassphrasePolicyCompliant,
  type PassphrasePolicyEvaluation,
  type PassphrasePolicyFailureReason,
} from "./services/identity-passphrase-policy";

export {
  logSecurityEvent,
  logRelaySecurityEvent,
  logIdentitySecurityEvent,
  logSettingsChange,
  logBackupRestore,
  useIdenticon,
  checkContactKeyOnMessage,
  verifyContactKey,
  getContactVerificationStatus,
  getRecentSecurityEvents,
  clearSecurityAuditLog,
  type KeyChangeResult,
} from "./services/security-integration";
