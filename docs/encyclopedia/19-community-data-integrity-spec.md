# 19 Community Data Integrity and Persistence Specification

_Status: Draft - Pending review and user validation_
_Last updated: 2026-05-02_
_Last reviewed: 2026-05-03 (baseline commit 7111e10a)._

## 1. Problem Statement

The community/group system has experienced critical data loss issues where:
- Group names revert to "Private Group" after login/refresh
- Member lists are truncated to only the creator after re-login
- Groups appear as "new" communities when they should be recovered

Root cause: The membership ledger (`CommunityMembershipLedgerEntry`) was not storing complete group state, particularly `memberPubkeys` and `adminPubkeys`, causing incomplete reconstruction during hydration/recovery.

---

## 2. Data Schema Contract

### 2.1 CommunityMembershipLedgerEntry (Canonical)

```typescript
interface CommunityMembershipLedgerEntry {
  // Identity (required)
  groupId: string;
  publicKeyHex: string;  // Owner's public key
  
  // Membership State (required)
  status: 'joined' | 'left' | 'expelled' | 'pending';
  joinedAt?: number;
  
  // Group Metadata (required for reconstruction)
  displayName: string;
  avatarUrl?: string;
  
  // CRITICAL: Member Lists (required for complete recovery)
  memberPubkeys: ReadonlyArray<string>;  // MUST include all members
  adminPubkeys: ReadonlyArray<string>;   // MUST include all admins
  
  // Ledger Metadata
  ledgerVersion: number;  // Schema version for migrations
  createdAt: number;
  updatedAt: number;
}
```

**Invariants:**
1. `memberPubkeys` MUST contain at least the creator's public key
2. `adminPubkeys` MUST be a subset of `memberPubkeys`
3. `ledgerVersion` MUST be present for migration detection
4. Empty `memberPubkeys` array is invalid and must trigger validation error

### 2.2 GroupConversation (Runtime)

```typescript
interface GroupConversation {
  groupId: string;
  displayName: string;
  avatarUrl?: string;
  creatorPublicKey: string;
  memberPubkeys: ReadonlyArray<string>;  // Denormalized from ledger
  adminPubkeys: ReadonlyArray<string>;    // Denormalized from ledger
  createdAt: number;
  // ... other fields
}
```

---

## 3. Schema Validation Layer

### 3.1 Runtime Validation Functions

All ledger entry creation/update paths MUST pass through validation:

```typescript
// apps/pwa/app/features/groups/services/community-ledger-validator.ts

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateLedgerEntry(entry: Partial<CommunityMembershipLedgerEntry>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields
  if (!entry.groupId) errors.push('Missing required field: groupId');
  if (!entry.publicKeyHex) errors.push('Missing required field: publicKeyHex');
  if (!entry.displayName) errors.push('Missing required field: displayName');
  if (!entry.status) errors.push('Missing required field: status');
  
  // CRITICAL: Member list validation
  if (!entry.memberPubkeys || entry.memberPubkeys.length === 0) {
    errors.push('CRITICAL: memberPubkeys is empty - group will lose members on recovery');
  }
  
  // Admin subset validation
  if (entry.adminPubkeys && entry.memberPubkeys) {
    const invalidAdmins = entry.adminPubkeys.filter(admin => 
      !entry.memberPubkeys!.includes(admin)
    );
    if (invalidAdmins.length > 0) {
      errors.push(`Admin pubkeys not in member list: ${invalidAdmins.join(', ')}`);
    }
  }
  
  // Schema version check
  if (!entry.ledgerVersion) {
    warnings.push('Missing ledgerVersion - may need migration');
  }
  
  return { valid: errors.length === 0, errors, warnings };
}

export function assertValidLedgerEntry(entry: Partial<CommunityMembershipLedgerEntry>): void {
  const result = validateLedgerEntry(entry);
  if (!result.valid) {
    throw new Error(`Invalid ledger entry: ${result.errors.join('; ')}`);
  }
}
```

### 3.2 Integration Points

Validation MUST be called at:
1. `toCommunityMembershipLedgerEntryFromGroup()` - when creating from group
2. `setCommunityMembershipStatus()` - when updating status
3. `dedupeCommunityMembershipLedger()` - when merging entries
4. `loadCommunityMembershipLedger()` - when loading from storage

---

## 4. Data Migration Strategy

### 4.1 Ledger Entry Versioning

```typescript
const CURRENT_LEDGER_VERSION = 2;

interface LedgerMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (entry: any) => CommunityMembershipLedgerEntry;
}

const migrations: LedgerMigration[] = [
  {
    // v1 → v2: Add memberPubkeys and adminPubkeys
    fromVersion: 1,
    toVersion: 2,
    migrate: (oldEntry: any, context: { persistedGroups: GroupConversation[] }) => {
      // Find matching group in persisted data
      const persistedGroup = context.persistedGroups.find(g => g.groupId === oldEntry.groupId);
      
      return {
        ...oldEntry,
        ledgerVersion: 2,
        memberPubkeys: persistedGroup?.memberPubkeys ?? [oldEntry.publicKeyHex],
        adminPubkeys: persistedGroup?.adminPubkeys ?? [oldEntry.publicKeyHex],
        updatedAt: Date.now(),
      };
    }
  }
];
```

### 4.2 Migration Execution

```typescript
export async function migrateLedgerEntries(
  entries: CommunityMembershipLedgerEntry[],
  publicKeyHex: string
): Promise<CommunityMembershipLedgerEntry[]> {
  // Load persisted groups for context
  const persistedGroups = await loadPersistedGroups(publicKeyHex);
  
  return entries.map(entry => {
    const currentVersion = entry.ledgerVersion ?? 1;
    
    if (currentVersion >= CURRENT_LEDGER_VERSION) {
      return entry;
    }
    
    // Apply migrations sequentially
    let migrated = entry;
    for (const migration of migrations) {
      if (migrated.ledgerVersion === migration.fromVersion) {
        migrated = migration.migrate(migrated, { persistedGroups });
      }
    }
    
    // Validate after migration
    const validation = validateLedgerEntry(migrated);
    if (!validation.valid) {
      console.error('Migration failed for entry:', entry.groupId, validation.errors);
      // Return original with version bumped to prevent re-migration attempts
      return { ...entry, ledgerVersion: CURRENT_LEDGER_VERSION };
    }
    
    return migrated;
  });
}
```

### 4.3 Backward Compatibility

- Old entries without `ledgerVersion` are treated as v1
- Migration is idempotent (re-running produces same result)
- Failed migrations log errors but don't crash the app
- Migration diagnostics are emitted as events for monitoring

---

## 5. Testing Requirements

### 5.1 Unit Tests for Ledger Operations

```typescript
// apps/pwa/app/features/groups/services/__tests__/community-membership-ledger.test.ts

describe('CommunityMembershipLedger', () => {
  describe('validateLedgerEntry', () => {
    it('should reject entries without memberPubkeys', () => {
      const entry = createMinimalLedgerEntry({ memberPubkeys: undefined });
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('memberPubkeys'));
    });
    
    it('should reject entries with empty memberPubkeys', () => {
      const entry = createMinimalLedgerEntry({ memberPubkeys: [] });
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
    });
    
    it('should reject entries where admin is not in member list', () => {
      const entry = createMinimalLedgerEntry({
        memberPubkeys: ['member1', 'member2'],
        adminPubkeys: ['member1', 'admin-not-in-list']
      });
      const result = validateLedgerEntry(entry);
      expect(result.valid).toBe(false);
    });
  });
  
  describe('dedupeCommunityMembershipLedger', () => {
    it('should merge memberPubkeys from duplicate entries', () => {
      const entries = [
        { ...baseEntry, memberPubkeys: ['a', 'b'] },
        { ...baseEntry, memberPubkeys: ['b', 'c'] },  // duplicate groupId
      ];
      const deduped = dedupeCommunityMembershipLedger(entries);
      expect(deduped[0].memberPubkeys).toContain('a');
      expect(deduped[0].memberPubkeys).toContain('b');
      expect(deduped[0].memberPubkeys).toContain('c');
    });
  });
  
  describe('toGroupConversationFromMembershipLedgerEntry', () => {
    it('should use ledger memberPubkeys over fallback', () => {
      const entry = {
        ...baseEntry,
        memberPubkeys: ['ledger-member-1', 'ledger-member-2'],
      };
      const group = toGroupConversationFromMembershipLedgerEntry(
        entry,
        { /* minimal fallback */ }
      );
      expect(group.memberPubkeys).toContain('ledger-member-1');
      expect(group.memberPubkeys).toContain('ledger-member-2');
    });
    
    it('should only use fallback when ledger has no members', () => {
      const entry = {
        ...baseEntry,
        memberPubkeys: [],  // empty - should use fallback
      };
      const fallback = { memberPubkeys: ['fallback-member'] };
      const group = toGroupConversationFromMembershipLedgerEntry(entry, fallback);
      expect(group.memberPubkeys).toContain('fallback-member');
    });
  });
});
```

### 5.2 Integration Tests for Persistence

```typescript
// apps/pwa/app/features/groups/__tests__/group-persistence.integration.test.ts

describe('Group Persistence Integration', () => {
  it('should preserve member list after logout/login', async () => {
    // Setup
    const creator = await createTestIdentity();
    const member1 = await createTestIdentity();
    const member2 = await createTestIdentity();
    
    // Create group with multiple members
    const group = await createGroup({
      displayName: 'Test Group',
      creatorPublicKey: creator.publicKey,
      memberPubkeys: [creator.publicKey, member1.publicKey, member2.publicKey],
    });
    
    // Save to ledger
    await saveCommunityMembershipLedger(creator.publicKey, [{
      groupId: group.groupId,
      memberPubkeys: group.memberPubkeys,
      // ... other fields
    }]);
    
    // Simulate logout (clear runtime state)
    clearRuntimeState();
    
    // Simulate re-login
    await login(creator);
    
    // Load groups
    const recoveredGroups = await hydrateGroupsForPublicKey(creator.publicKey);
    const recoveredGroup = recoveredGroups.find(g => g.groupId === group.groupId);
    
    // Assertions
    expect(recoveredGroup).toBeDefined();
    expect(recoveredGroup.displayName).toBe('Test Group');
    expect(recoveredGroup.memberPubkeys).toHaveLength(3);
    expect(recoveredGroup.memberPubkeys).toContain(member1.publicKey);
    expect(recoveredGroup.memberPubkeys).toContain(member2.publicKey);
  });
  
  it('should preserve member list after cross-device restore', async () => {
    // Device A: Create group
    const deviceA = await createTestDevice();
    const group = await deviceA.createGroup({ /* ... */ });
    
    // Create backup
    const backup = await deviceA.createEncryptedBackup();
    
    // Device B: Restore
    const deviceB = await createTestDevice();
    await deviceB.restoreFromBackup(backup);
    
    // Verify group integrity
    const recoveredGroup = deviceB.getGroup(group.groupId);
    expect(recoveredGroup.memberPubkeys).toEqual(group.memberPubkeys);
  });
});
```

### 5.3 End-to-End Tests

```typescript
// playwright tests for user-facing verification

test('user can see all group members after re-login', async ({ page }) => {
  // Create group with 3 members
  await page.goto('/groups/create');
  await page.fill('[data-testid="group-name"]', 'E2E Test Group');
  await page.click('[data-testid="create-group"]');
  
  // Invite members
  await inviteMember(page, 'member1@example.com');
  await inviteMember(page, 'member2@example.com');
  
  // Verify member count
  await expect(page.locator('[data-testid="member-count"]')).toHaveText('3 members');
  
  // Logout and re-login
  await page.click('[data-testid="logout"]');
  await login(page, TEST_USER);
  
  // Navigate to groups
  await page.goto('/network/groups');
  
  // Verify group exists with correct name
  await expect(page.locator('[data-testid="group-name"]')).toHaveText('E2E Test Group');
  
  // Verify all members present
  await page.click('[data-testid="group-name"]');
  const memberNames = await page.locator('[data-testid="member-name"]').allTextContents();
  expect(memberNames).toHaveLength(3);
});
```

---

## 6. Data Integrity Checks

### 6.1 Runtime Integrity Monitoring

```typescript
// apps/pwa/app/features/groups/services/community-integrity-monitor.ts

export interface IntegrityCheckResult {
  passed: boolean;
  groupId: string;
  checks: {
    ledgerEntryExists: boolean;
    memberListNonEmpty: boolean;
    displayNameValid: boolean;
    adminInMemberList: boolean;
  };
  discrepancies: string[];
}

export async function checkGroupIntegrity(
  groupId: string,
  publicKeyHex: string
): Promise<IntegrityCheckResult> {
  const ledger = await loadCommunityMembershipLedger(publicKeyHex);
  const entry = ledger.find(e => e.groupId === groupId);
  const persistedGroups = await loadPersistedGroups(publicKeyHex);
  const persistedGroup = persistedGroups.find(g => g.groupId === groupId);
  
  const discrepancies: string[] = [];
  
  // Check 1: Ledger entry exists
  if (!entry) {
    discrepancies.push('No ledger entry found - group may disappear on recovery');
  }
  
  // Check 2: Member list non-empty
  const memberList = entry?.memberPubkeys ?? persistedGroup?.memberPubkeys ?? [];
  if (memberList.length === 0) {
    discrepancies.push('Empty member list - group will appear with only creator');
  }
  
  // Check 3: Display name validity
  const displayName = entry?.displayName ?? persistedGroup?.displayName;
  if (!displayName || displayName === 'Private Group') {
    discrepancies.push(`Invalid display name: "${displayName}"`);
  }
  
  // Check 4: Admin in member list
  if (entry?.adminPubkeys) {
    const orphanedAdmins = entry.adminPubkeys.filter(
      admin => !entry.memberPubkeys?.includes(admin)
    );
    if (orphanedAdmins.length > 0) {
      discrepancies.push(`Admins not in member list: ${orphanedAdmins.join(', ')}`);
    }
  }
  
  // Cross-reference check
  if (entry && persistedGroup) {
    const ledgerMembers = new Set(entry.memberPubkeys ?? []);
    const persistedMembers = new Set(persistedGroup.memberPubkeys ?? []);
    
    const missingFromLedger = [...persistedMembers].filter(m => !ledgerMembers.has(m));
    if (missingFromLedger.length > 0) {
      discrepancies.push(
        `Members in persisted data but not ledger: ${missingFromLedger.join(', ')}`
      );
    }
  }
  
  return {
    passed: discrepancies.length === 0,
    groupId,
    checks: {
      ledgerEntryExists: !!entry,
      memberListNonEmpty: memberList.length > 0,
      displayNameValid: !!displayName && displayName !== 'Private Group',
      adminInMemberList: !entry?.adminPubkeys?.some(
        admin => !entry.memberPubkeys?.includes(admin)
      ) ?? true,
    },
    discrepancies,
  };
}
```

### 6.2 Periodic Health Check

```typescript
export async function runCommunityHealthCheck(publicKeyHex: string): Promise<void> {
  const groups = await getAllGroupsForPublicKey(publicKeyHex);
  
  for (const group of groups) {
    const result = await checkGroupIntegrity(group.groupId, publicKeyHex);
    
    if (!result.passed) {
      // Emit diagnostic event
      emitDiagnostic('groups.integrity_check_failed', {
        groupId: group.groupId,
        publicKeyHex,
        checks: result.checks,
        discrepancies: result.discrepancies,
      });
      
      // Attempt auto-repair for recoverable issues
      if (result.checks.ledgerEntryExists && !result.checks.memberListNonEmpty) {
        await attemptMemberListRepair(group.groupId, publicKeyHex);
      }
    }
  }
}

async function attemptMemberListRepair(
  groupId: string,
  publicKeyHex: string
): Promise<void> {
  // Try to reconstruct from message history
  const messages = await getGroupMessages(groupId);
  const authors = [...new Set(messages.map(m => m.authorPublicKey))];
  
  // Update ledger with reconstructed members
  await updateLedgerEntry(groupId, publicKeyHex, {
    memberPubkeys: authors,
  });
  
  emitDiagnostic('groups.member_list_repaired', {
    groupId,
    publicKeyHex,
    reconstructedMembers: authors.length,
  });
}
```

---

## 7. User-Facing Diagnostics

### 7.1 Group Info Panel

Add a "Data Health" section in group settings showing:
- Ledger entry status (✓ present / ✗ missing)
- Member count in ledger vs runtime
- Last successful backup
- Data integrity score

```typescript
// UI Component
function GroupDataHealthPanel({ groupId }: { groupId: string }) {
  const [health, setHealth] = useState<IntegrityCheckResult | null>(null);
  
  useEffect(() => {
    checkGroupIntegrity(groupId, currentUser.publicKey).then(setHealth);
  }, [groupId]);
  
  if (!health) return <Loading />;
  
  return (
    <div className="data-health-panel">
      <h3>Data Health</h3>
      
      <HealthIndicator 
        label="Ledger Entry" 
        status={health.checks.ledgerEntryExists ? 'ok' : 'error'}
      />
      
      <HealthIndicator 
        label="Member List" 
        status={health.checks.memberListNonEmpty ? 'ok' : 'warning'}
        detail={`${health.checks.memberListNonEmpty ? '✓' : '✗'} Members preserved`}
      />
      
      <HealthIndicator 
        label="Display Name" 
        status={health.checks.displayNameValid ? 'ok' : 'warning'}
      />
      
      {health.discrepancies.length > 0 && (
        <div className="discrepancies">
          <h4>Issues Found:</h4>
          <ul>
            {health.discrepancies.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      
      {!health.passed && (
        <button onClick={() => runRepair(groupId)}>
          Attempt Repair
        </button>
      )}
    </div>
  );
}
```

### 7.2 Recovery Notifications

When groups are recovered with incomplete data:

```typescript
function showRecoveryWarning(group: GroupConversation, issues: string[]) {
  showNotification({
    type: 'warning',
    title: `Group "${group.displayName}" recovered with issues`,
    message: issues.join(', '),
    actions: [
      { label: 'View Details', onClick: () => openGroupHealthPanel(group.groupId) },
      { label: 'Dismiss', onClick: () => {} },
    ],
  });
}
```

---

## 8. Monitoring & Observability

### 8.1 Diagnostic Events

| Event Name | Payload | Trigger |
|------------|---------|---------|
| `groups.ledger_entry_created` | `{ groupId, publicKeyHex, hasMemberList }` | After creating ledger entry |
| `groups.ledger_entry_invalid` | `{ groupId, errors[] }` | Validation failure |
| `groups.member_list_truncated` | `{ groupId, before: n, after: n }` | Member count decreased |
| `groups.display_name_reset` | `{ groupId, from: string, to: string }` | Name changed to "Private Group" |
| `groups.integrity_check_failed` | `{ groupId, discrepancies[] }` | Periodic check failure |
| `groups.migration_applied` | `{ groupId, fromVersion, toVersion }` | Ledger migration |

### 8.2 Metrics to Track

```typescript
// Track in analytics/monitoring
interface CommunityMetrics {
  // Health metrics
  'groups.total_count': number;
  'groups.with_ledger_entry': number;
  'groups.with_empty_member_list': number;
  'groups.with_placeholder_name': number;
  
  // Recovery metrics
  'groups.recovery_success_rate': number;  // % groups recovered intact
  'groups.recovery_with_data_loss': number;
  
  // Migration metrics
  'groups.migrations_applied': number;
  'groups.migration_failures': number;
}
```

---

## 9. Recovery Procedures

### 9.1 Manual Repair Workflow

```typescript
// Dev/Admin tool for manual group repair
export async function manualGroupRepair(
  groupId: string,
  publicKeyHex: string,
  options: RepairOptions
): Promise<RepairResult> {
  const result: RepairResult = {
    groupId,
    steps: [],
    success: false,
  };
  
  // Step 1: Analyze current state
  const ledger = await loadCommunityMembershipLedger(publicKeyHex);
  const persisted = await loadPersistedGroups(publicKeyHex);
  const messages = await getGroupMessages(groupId);
  
  result.steps.push({
    name: 'analyze',
    status: 'complete',
    details: {
      ledgerEntryExists: ledger.some(e => e.groupId === groupId),
      persistedGroupExists: persisted.some(g => g.groupId === groupId),
      messageCount: messages.length,
    },
  });
  
  // Step 2: Reconstruct member list from all sources
  const memberSources = {
    ledger: ledger.find(e => e.groupId === groupId)?.memberPubkeys ?? [],
    persisted: persisted.find(g => g.groupId === groupId)?.memberPubkeys ?? [],
    messageAuthors: [...new Set(messages.map(m => m.authorPublicKey))],
    invitees: await getGroupInvitees(groupId),
  };
  
  const reconstructedMembers = [...new Set([
    ...memberSources.ledger,
    ...memberSources.persisted,
    ...memberSources.messageAuthors,
    ...memberSources.invitees,
  ])];
  
  // Step 3: Update or create ledger entry
  const existingEntry = ledger.find(e => e.groupId === groupId);
  if (existingEntry) {
    await updateLedgerEntry(groupId, publicKeyHex, {
      memberPubkeys: reconstructedMembers,
      ledgerVersion: CURRENT_LEDGER_VERSION,
      updatedAt: Date.now(),
    });
  } else {
    await createLedgerEntry(groupId, publicKeyHex, {
      memberPubkeys: reconstructedMembers,
      // ... other required fields from persisted group
    });
  }
  
  result.steps.push({
    name: 'reconstruct_members',
    status: 'complete',
    details: {
      sources: {
        ledger: memberSources.ledger.length,
        persisted: memberSources.persisted.length,
        messages: memberSources.messageAuthors.length,
        invitees: memberSources.invitees.length,
      },
      reconstructed: reconstructedMembers.length,
    },
  });
  
  // Step 4: Verify repair
  const verification = await checkGroupIntegrity(groupId, publicKeyHex);
  result.success = verification.passed;
  result.steps.push({
    name: 'verify',
    status: verification.passed ? 'complete' : 'failed',
    details: { discrepancies: verification.discrepancies },
  });
  
  return result;
}
```

### 9.2 Bulk Repair for Migration

```typescript
export async function bulkRepairAllGroups(publicKeyHex: string): Promise<{
  total: number;
  repaired: number;
  failed: number;
  details: RepairResult[];
}> {
  const groups = await getAllGroupsForPublicKey(publicKeyHex);
  const results: RepairResult[] = [];
  
  for (const group of groups) {
    const health = await checkGroupIntegrity(group.groupId, publicKeyHex);
    if (!health.passed) {
      const repair = await manualGroupRepair(group.groupId, publicKeyHex, {});
      results.push(repair);
    }
  }
  
  return {
    total: groups.length,
    repaired: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    details: results,
  };
}
```

---

## 10. Implementation Checklist

### Phase 1: Validation Layer (Immediate)
- [ ] Create `community-ledger-validator.ts` with validation functions
- [ ] Add validation calls to all ledger entry creation paths
- [ ] Add schema version field to ledger entries
- [ ] Create unit tests for validation functions

### Phase 2: Migration (Immediate)
- [ ] Implement migration framework
- [ ] Create v1 → v2 migration for memberPubkeys
- [ ] Add migration call to ledger loading
- [ ] Test migration on sample data

### Phase 3: Monitoring (Short-term)
- [ ] Implement integrity check functions
- [ ] Add periodic health check job
- [ ] Create diagnostic event system
- [ ] Add metrics tracking

### Phase 4: User-Facing (Short-term)
- [ ] Create Group Data Health panel
- [ ] Add recovery warning notifications
- [ ] Implement manual repair UI
- [ ] Add health indicators to group list

### Phase 5: Testing (Ongoing)
- [ ] Write integration tests for persistence
- [ ] Create E2E tests for group recovery
- [ ] Add cross-device sync tests
- [ ] Set up automated regression tests

### Phase 6: Documentation (Ongoing)
- [ ] Update developer docs with schema contracts
- [ ] Create runbook for recovery procedures
- [ ] Document migration strategies
- [ ] Write user guide for data health features

---

## 11. Success Criteria

The implementation is successful when:

1. **Zero data loss**: No groups lose member lists after login/refresh
2. **Schema compliance**: 100% of ledger entries pass validation
3. **Migration complete**: All existing entries migrated to latest schema
4. **Test coverage**: >90% coverage on ledger-related code
5. **User visibility**: Users can verify group data health
6. **Monitoring**: All diagnostic events are logged and actionable

---

## 12. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration corrupts existing data | Low | High | Backup before migration, validate after |
| Validation performance impact | Medium | Low | Async validation, caching |
| Legacy clients reject new schema | Low | High | Maintain backward compatibility |
| User confusion about health UI | Medium | Medium | Clear messaging, help docs |

---

## 13. Appendix: Current vs Proposed Schema

### Current (v1) - Problematic
```typescript
interface CommunityMembershipLedgerEntryV1 {
  groupId: string;
  publicKeyHex: string;
  status: MembershipStatus;
  displayName: string;
  avatarUrl?: string;
  // ❌ Missing: memberPubkeys
  // ❌ Missing: adminPubkeys
  // ❌ Missing: ledgerVersion
}
```

### Proposed (v2) - Fixed
```typescript
interface CommunityMembershipLedgerEntryV2 {
  groupId: string;
  publicKeyHex: string;
  status: MembershipStatus;
  displayName: string;
  avatarUrl?: string;
  // ✅ Required: member list for recovery
  memberPubkeys: ReadonlyArray<string>;
  // ✅ Required: admin list for permissions
  adminPubkeys: ReadonlyArray<string>;
  // ✅ Required: schema version for migrations
  ledgerVersion: number;
  // ✅ Required: timestamps for debugging
  createdAt: number;
  updatedAt: number;
}
```

---

## 14. Related Documents

- `docs/encyclopedia/10-community-and-groups-overhaul.md` - Operating model
- `docs/encyclopedia/16-cross-device-group-visibility-incident.md` - Historical incident
- `docs/handoffs/current-session.md` - Session context
- Code: `apps/pwa/app/features/groups/services/community-membership-ledger.ts`
- Code: `apps/pwa/app/features/groups/providers/group-provider.tsx`

---

**Next Steps:**
1. Review this specification
2. Validate proposed schema changes
3. Approve implementation phases
4. Begin Phase 1 (Validation Layer) implementation
5. Schedule user acceptance testing
