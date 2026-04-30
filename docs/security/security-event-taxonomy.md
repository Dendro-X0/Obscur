# Security Event Taxonomy

**Status**: Draft for v1.4.7  
**Purpose**: Define event types for `SecurityAuditLog`  
**Last Updated**: 2026-04-30

---

## Event Categories

| Category | Description | Retention |
|----------|-------------|-----------|
| `identity` | Identity lifecycle events | 90 days |
| `verification` | Key verification actions | 90 days |
| `key_change` | Public key change detections | 1 year |
| `relay` | Relay trust and capability changes | 90 days |
| `message` | Message delivery anomalies | 30 days |
| `auth` | Authentication events | 90 days |

---

## Event Schema

```typescript
interface SecurityEvent {
  id: string;                    // ULID
  timestamp: number;             // Unix ms
  category: EventCategory;
  type: EventType;
  severity: "info" | "warning" | "critical";
  actor: {
    type: "self" | "contact" | "relay" | "system";
    id?: string;                 // Public key, relay URL, etc.
    displayName?: string;
  };
  resource: {
    type: "identity" | "conversation" | "relay" | "community";
    id: string;
  };
  details: Record<string, unknown>;
  hash: string;                  // Integrity hash (chain of events)
}
```

---

## Event Types

### Identity Category

| Event Type | Trigger | Severity | Details |
|------------|---------|----------|---------|
| `identity.created` | New account created | info | `{ publicKeyFingerprint: string }` |
| `identity.imported` | Account imported from backup | info | `{ source: "backup" \| "relay" }` |
| `identity.unlocked` | Session unlocked | info | `{ method: "password" \| "biometric" }` |
| `identity.locked` | Session locked | info | `{}` |
| `identity.deleted` | Account deleted | warning | `{}` |

### Verification Category

| Event Type | Trigger | Severity | Details |
|------------|---------|----------|---------|
| `verification.completed` | Contact key verified | info | `{ contactId: string, method: "visual" \| "oob" }` |
| `verification.revoked` | Verification revoked | warning | `{ contactId: string, reason?: string }` |

### Key Change Category

| Event Type | Trigger | Severity | Details |
|------------|---------|----------|---------|
| `key_change.detected` | Contact key changed | critical | `{ contactId: string, oldFingerprint: string, newFingerprint: string }` |
| `key_change.acknowledged` | User acknowledged change | info | `{ contactId: string }` |
| `key_change.blocked` | User blocked contact due to change | warning | `{ contactId: string }` |

### Relay Category

| Event Type | Trigger | Severity | Details |
|------------|---------|----------|---------|
| `relay.trust_changed` | Relay trust level changed | warning | `{ relayUrl: string, oldLevel: TrustLevel, newLevel: TrustLevel, reason: string }` |
| `relay.added` | User added relay | info | `{ relayUrl: string }` |
| `relay.removed` | User removed relay | info | `{ relayUrl: string }` |
| `relay.failed` | Relay connection failed | warning | `{ relayUrl: string, error: string }` |
| `relay.fallback_activated` | Auto-fallback to backup relay | warning | `{ fromRelay: string, toRelay: string }` |

### Message Category

| Event Type | Trigger | Severity | Details |
|------------|---------|----------|---------|
| `message.delivery_failed` | Message failed to deliver | warning | `{ messageId: string, relayUrl: string, error: string }` |
| `message.suspicious_pattern` | Anomalous message pattern | warning | `{ pattern: string, count: number }` |

### Auth Category

| Event Type | Trigger | Severity | Details |
|------------|---------|----------|---------|
| `auth.failed` | Authentication failed | warning | `{ method: string, reason: string }` |
| `auth.password_changed` | Password changed | info | `{}` |
| `auth.biometric_enrolled` | Biometric enrolled | info | `{}` |
| `auth.biometric_removed` | Biometric removed | info | `{}` |

---

## Storage

- **Location**: IndexedDB (`security-audit-log` store)
- **Encryption**: AES-GCM with user key
- **Retention**: Per-category policy (see table above)
- **Export**: JSON format with integrity verification
- **Tamper Evidence**: Hash chain linking events

---

## Privacy Considerations

1. **No content logging**: Never log message content, only metadata
2. **No contact PII**: Only public keys, no names or profiles
3. **Local only**: No cloud sync of security events
4. **User accessible**: Full export and clear functionality
5. **Minimal collection**: Only security-relevant events

---

## Implementation

```typescript
// Publisher API
SecurityAuditLog.logEvent({
  category: "key_change",
  type: "key_change.detected",
  severity: "critical",
  actor: { type: "contact", id: publicKeyHex },
  resource: { type: "identity", id: publicKeyHex },
  details: { oldFingerprint, newFingerprint }
});
```

See: `apps/pwa/app/features/security/services/security-audit-log.ts`

---

*Security Event Taxonomy — v1.4.7*
