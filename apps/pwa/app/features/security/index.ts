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
