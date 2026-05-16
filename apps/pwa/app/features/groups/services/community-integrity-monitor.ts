/**
 * Community Integrity Monitor
 *
 * Provides runtime data integrity checks and auto-repair for community/ group data.
 * This module prevents data loss by detecting and fixing issues early.
 */

import type { CommunityMembershipLedgerEntry } from './community-membership-ledger';
import type { GroupConversation } from '@/app/features/messaging/types';
import { PLACEHOLDER_GROUP_NAME } from './community-ledger-validator';
import { logAppEvent } from '@/app/shared/log-app-event';

/** Result of an integrity check */
export interface IntegrityCheckResult {
  passed: boolean;
  groupId: string;
  checks: {
    ledgerEntryExists: boolean;
    memberListNonEmpty: boolean;
    displayNameValid: boolean;
    adminInMemberList: boolean;
    schemaVersionValid: boolean;
  };
  discrepancies: string[];
  severity: 'critical' | 'warning' | 'ok';
}

/** Options for integrity check */
export interface IntegrityCheckOptions {
  /** Check persisted groups for discrepancies */
  checkPersisted?: boolean;
  /** Attempt auto-repair for fixable issues */
  autoRepair?: boolean;
}

/**
 * Checks the integrity of a single group.
 * Returns detailed information about any data issues.
 */
export function checkGroupIntegrity(
  groupId: string,
  ledgerEntry: CommunityMembershipLedgerEntry | undefined,
  persistedGroup: GroupConversation | undefined,
  options?: IntegrityCheckOptions
): IntegrityCheckResult {
  const discrepancies: string[] = [];
  const checks = {
    ledgerEntryExists: false,
    memberListNonEmpty: false,
    displayNameValid: false,
    adminInMemberList: false,
    schemaVersionValid: false,
  };

  // Check 1: Ledger entry exists
  checks.ledgerEntryExists = !!ledgerEntry;
  if (!checks.ledgerEntryExists) {
    discrepancies.push('No ledger entry found - group may disappear on recovery');
  }

  // Check 2: Member list validation
  const memberList = ledgerEntry?.memberPubkeys ?? persistedGroup?.memberPubkeys ?? [];
  checks.memberListNonEmpty = memberList.length > 0;
  if (!checks.memberListNonEmpty) {
    discrepancies.push('Empty member list - group will appear with only creator on recovery');
  }

  // Check 3: Display name validity
  const displayName = ledgerEntry?.displayName ?? persistedGroup?.displayName;
  checks.displayNameValid = !!displayName && displayName !== PLACEHOLDER_GROUP_NAME;
  if (!checks.displayNameValid) {
    if (displayName === PLACEHOLDER_GROUP_NAME) {
      discrepancies.push(`Display name is placeholder "${PLACEHOLDER_GROUP_NAME}" - indicates data loss`);
    } else {
      discrepancies.push('Missing display name');
    }
  }

  // Check 4: Admin in member list
  if (ledgerEntry?.adminPubkeys && ledgerEntry?.memberPubkeys) {
    const memberSet = new Set(ledgerEntry.memberPubkeys);
    const orphanedAdmins = ledgerEntry.adminPubkeys.filter(admin => !memberSet.has(admin));
    checks.adminInMemberList = orphanedAdmins.length === 0;
    if (!checks.adminInMemberList) {
      discrepancies.push(`Admins not in member list: ${orphanedAdmins.join(', ')}`);
    }
  } else {
    checks.adminInMemberList = true; // Can't validate without both lists
  }

  // Check 5: Schema version
  checks.schemaVersionValid = !!ledgerEntry?.ledgerVersion;
  if (!checks.schemaVersionValid) {
    discrepancies.push('Missing ledgerVersion - legacy entry needs migration');
  }

  // Cross-reference check (if both sources available)
  if (ledgerEntry && persistedGroup && options?.checkPersisted) {
    const ledgerMembers = new Set(ledgerEntry.memberPubkeys ?? []);
    const persistedMembers = new Set(persistedGroup.memberPubkeys ?? []);

    const missingFromLedger = [...persistedMembers].filter(m => !ledgerMembers.has(m));
    if (missingFromLedger.length > 0) {
      discrepancies.push(
        `Members in persisted data but not ledger: ${missingFromLedger.join(', ')}`
      );
    }

    const missingFromPersisted = [...ledgerMembers].filter(m => !persistedMembers.has(m));
    if (missingFromPersisted.length > 0) {
      discrepancies.push(
        `Members in ledger but not persisted: ${missingFromPersisted.join(', ')}`
      );
    }
  }

  // Determine severity
  let severity: 'critical' | 'warning' | 'ok' = 'ok';
  if (!checks.ledgerEntryExists || !checks.memberListNonEmpty) {
    severity = 'critical';
  } else if (!checks.displayNameValid || !checks.schemaVersionValid) {
    severity = 'warning';
  }

  return {
    passed: discrepancies.length === 0,
    groupId,
    checks,
    discrepancies,
    severity,
  };
}

/**
 * Checks all groups for a user.
 * Returns summary and detailed results.
 */
export function checkAllGroupsIntegrity(
  groups: readonly GroupConversation[],
  ledgerEntries: readonly CommunityMembershipLedgerEntry[],
  options?: IntegrityCheckOptions
): {
  total: number;
  passed: number;
  failed: number;
  critical: number;
  warning: number;
  results: IntegrityCheckResult[];
} {
  const ledgerByGroupId = new Map(ledgerEntries.map(e => [e.groupId, e]));

  const results = groups.map(group => {
    const ledgerEntry = ledgerByGroupId.get(group.groupId);
    return checkGroupIntegrity(group.groupId, ledgerEntry, group, options);
  });

  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const critical = results.filter(r => r.severity === 'critical').length;
  const warning = results.filter(r => r.severity === 'warning').length;

  return {
    total: groups.length,
    passed,
    failed,
    critical,
    warning,
    results,
  };
}

/**
 * Attempts to repair common group data issues.
 * Returns true if repair was successful.
 */
export function attemptGroupRepair(
  groupId: string,
  ledgerEntry: CommunityMembershipLedgerEntry | undefined,
  persistedGroup: GroupConversation | undefined,
  publicKeyHex: string
): { success: boolean; actions: string[]; newEntry?: CommunityMembershipLedgerEntry } {
  const actions: string[] = [];

  if (!ledgerEntry && persistedGroup) {
    // Create new ledger entry from persisted group
    actions.push('Created ledger entry from persisted group');
    const now = Date.now();
    const newEntry: CommunityMembershipLedgerEntry = {
      groupId: persistedGroup.groupId,
      publicKeyHex,
      status: 'joined',
      displayName: persistedGroup.displayName ?? PLACEHOLDER_GROUP_NAME,
      memberPubkeys: persistedGroup.memberPubkeys ?? [publicKeyHex],
      adminPubkeys: persistedGroup.adminPubkeys ?? [publicKeyHex],
      ledgerVersion: 2,
      createdAt: now,
      updatedAt: now,
    };

    return { success: true, actions, newEntry };
  }

  if (ledgerEntry) {
    let needsUpdate = false;
    const repaired = { ...ledgerEntry };

    // Fix empty member list
    if (!repaired.memberPubkeys || repaired.memberPubkeys.length === 0) {
      repaired.memberPubkeys = persistedGroup?.memberPubkeys ?? [publicKeyHex];
      actions.push('Repaired empty member list');
      needsUpdate = true;
    }

    // Fix placeholder display name
    if (repaired.displayName === PLACEHOLDER_GROUP_NAME && persistedGroup?.displayName) {
      repaired.displayName = persistedGroup.displayName;
      actions.push('Restored display name from persisted group');
      needsUpdate = true;
    }

    // Fix missing schema version
    if (!repaired.ledgerVersion) {
      repaired.ledgerVersion = 2;
      actions.push('Added ledgerVersion');
      needsUpdate = true;
    }

    if (needsUpdate) {
      repaired.updatedAt = Date.now();
      return { success: true, actions, newEntry: repaired };
    }
  }

  return { success: false, actions: ['No repairable issues found'] };
}

/**
 * Logs integrity check results as diagnostic events.
 */
export function logIntegrityResults(
  publicKeyHex: string,
  results: ReturnType<typeof checkAllGroupsIntegrity>
): void {
  if (results.failed === 0) {
    logAppEvent({
      name: "groups.integrity_check_passed",
      level: "info",
      scope: { feature: "groups", action: "integrity_monitor" },
      context: {
        publicKeySuffix: publicKeyHex.slice(-8),
        totalGroups: results.total,
      },
    });
    return;
  }

  // Log summary for failed checks
  logAppEvent({
    name: "groups.integrity_check_failed",
    level: results.critical > 0 ? "error" : "warn",
    scope: { feature: "groups", action: "integrity_monitor" },
    context: {
      publicKeySuffix: publicKeyHex.slice(-8),
      totalGroups: results.total,
      passed: results.passed,
      failed: results.failed,
      critical: results.critical,
      warning: results.warning,
    },
  });

  // Log individual critical issues
  for (const result of results.results.filter(r => r.severity === 'critical')) {
    logAppEvent({
      name: "groups.critical_integrity_issue",
      level: "error",
      scope: { feature: "groups", action: "integrity_monitor" },
      context: {
        groupId: result.groupId,
        discrepancies: result.discrepancies.join('; '),
      },
    });
  }
}

/**
 * Periodic health check function.
 * Should be called periodically (e.g., on app startup, after sync).
 */
export async function runCommunityHealthCheck(
  publicKeyHex: string,
  getGroups: () => readonly GroupConversation[],
  getLedgerEntries: () => readonly CommunityMembershipLedgerEntry[],
  saveLedgerEntry?: (entry: CommunityMembershipLedgerEntry) => void
): Promise<void> {
  const groups = getGroups();
  const ledgerEntries = getLedgerEntries();

  const results = checkAllGroupsIntegrity(groups, ledgerEntries, {
    checkPersisted: true,
    autoRepair: !!saveLedgerEntry,
  });

  // Log results
  logIntegrityResults(publicKeyHex, results);

  // Auto-repair if enabled
  if (saveLedgerEntry) {
    for (const result of results.results.filter(r => !r.passed)) {
      const ledgerEntry = ledgerEntries.find(e => e.groupId === result.groupId);
      const persistedGroup = groups.find(g => g.groupId === result.groupId);

      const repair = attemptGroupRepair(result.groupId, ledgerEntry, persistedGroup, publicKeyHex);

      if (repair.success && repair.newEntry) {
        saveLedgerEntry(repair.newEntry);

        logAppEvent({
          name: "groups.auto_repair_completed",
          level: "info",
          scope: { feature: "groups", action: "integrity_monitor" },
          context: {
            groupId: result.groupId,
            actions: repair.actions.join('; '),
          },
        });
      }
    }
  }
}
