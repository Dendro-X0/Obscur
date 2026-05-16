/**
 * Community Ledger Validation Module
 *
 * Validates ledger entries to ensure data integrity and prevent persistence issues.
 * All ledger entry creation/update paths MUST pass through validation.
 */

import type { CommunityMembershipLedgerEntry } from './community-membership-ledger';

/** Current ledger schema version */
export const CURRENT_LEDGER_VERSION = 2;

/** Minimum valid ledger version */
export const MIN_LEDGER_VERSION = 1;

/** Placeholder name that indicates data loss */
export const PLACEHOLDER_GROUP_NAME = 'Private Group';

/** Validation result with detailed error/warning messages */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    hasRequiredFields: boolean;
    hasValidMemberList: boolean;
    hasValidAdminList: boolean;
    hasValidDisplayName: boolean;
    hasSchemaVersion: boolean;
    hasTimestamps: boolean;
  };
}

/** Options for validation */
export interface ValidationOptions {
  /** Strict mode: treat warnings as errors */
  strict?: boolean;
  /** Allow legacy entries without ledgerVersion (will warn) */
  allowLegacy?: boolean;
  /** Context for better error messages */
  context?: string;
}

/**
 * Validates a ledger entry for completeness and correctness.
 * This is the primary validation function that all ledger operations should use.
 */
export function validateLedgerEntry(
  entry: Partial<CommunityMembershipLedgerEntry>,
  options: ValidationOptions = {}
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { strict = false, allowLegacy = true, context } = options;

  // Required identity fields
  if (!entry.groupId || typeof entry.groupId !== 'string' || entry.groupId.length === 0) {
    errors.push('Missing or invalid required field: groupId');
  }

  if (!entry.publicKeyHex || typeof entry.publicKeyHex !== 'string') {
    errors.push('Missing or invalid required field: publicKeyHex');
  }

  // Required status field
  if (!entry.status) {
    errors.push('Missing required field: status');
  } else if (!['joined', 'left', 'expelled', 'pending'].includes(entry.status)) {
    errors.push(`Invalid status value: "${entry.status}"`);
  }

  // Required display name
  if (!entry.displayName || typeof entry.displayName !== 'string') {
    errors.push('Missing or invalid required field: displayName');
  } else if (entry.displayName === PLACEHOLDER_GROUP_NAME) {
    warnings.push(`Display name is placeholder "${PLACEHOLDER_GROUP_NAME}" - may indicate data loss`);
  }

  // CRITICAL: Member list validation
  const hasMemberPubkeys = Array.isArray(entry.memberPubkeys);
  const memberCount = entry.memberPubkeys?.length ?? 0;

  if (!hasMemberPubkeys) {
    errors.push('CRITICAL: memberPubkeys field is missing - group will lose all members on recovery');
  } else if (memberCount === 0) {
    errors.push('CRITICAL: memberPubkeys is empty - group will appear with only creator on recovery');
  }

  // Admin list validation
  const hasAdminPubkeys = Array.isArray(entry.adminPubkeys);
  const adminCount = entry.adminPubkeys?.length ?? 0;

  if (!hasAdminPubkeys) {
    warnings.push('adminPubkeys field is missing - will use defaults');
  } else if (hasMemberPubkeys && memberCount > 0) {
    // Validate that all admins are in the member list
    const memberSet = new Set(entry.memberPubkeys);
    const orphanedAdmins = entry.adminPubkeys!.filter(admin => !memberSet.has(admin));
    if (orphanedAdmins.length > 0) {
      errors.push(
        `Admin pubkeys not found in member list: ${orphanedAdmins.join(', ')}`
      );
    }
  }

  // Schema version validation
  const hasLedgerVersion = typeof entry.ledgerVersion === 'number';
  if (!hasLedgerVersion) {
    if (allowLegacy) {
      warnings.push('Missing ledgerVersion - treating as v1 (legacy), migration recommended');
    } else {
      errors.push('Missing required field: ledgerVersion');
    }
  } else {
    const version = entry.ledgerVersion!;
    if (version < MIN_LEDGER_VERSION) {
      errors.push(`Invalid ledgerVersion: ${version} (minimum: ${MIN_LEDGER_VERSION})`);
    } else if (version > CURRENT_LEDGER_VERSION) {
      errors.push(
        `Unsupported ledgerVersion: ${version} (current max: ${CURRENT_LEDGER_VERSION}) - client may need update`
      );
    } else if (version < CURRENT_LEDGER_VERSION) {
      warnings.push(`Legacy ledgerVersion: ${version} (current: ${CURRENT_LEDGER_VERSION}) - migration available`);
    }
  }

  // Timestamp validation
  if (!entry.createdAt) {
    warnings.push('Missing createdAt timestamp');
  }
  if (!entry.updatedAt) {
    warnings.push('Missing updatedAt timestamp');
  }

  // Build result details
  const details = {
    hasRequiredFields: errors.filter(e => e.includes('required field')).length === 0,
    hasValidMemberList: hasMemberPubkeys && memberCount > 0,
    hasValidAdminList: !hasAdminPubkeys || adminCount === 0 || (
      hasMemberPubkeys &&
      entry.adminPubkeys!.every(admin => entry.memberPubkeys!.includes(admin))
    ),
    hasValidDisplayName: !!entry.displayName && entry.displayName !== PLACEHOLDER_GROUP_NAME,
    hasSchemaVersion: hasLedgerVersion && (entry.ledgerVersion ?? 0) >= MIN_LEDGER_VERSION,
    hasTimestamps: !!entry.createdAt && !!entry.updatedAt,
  };

  // In strict mode, warnings become errors
  const finalErrors = strict ? [...errors, ...warnings] : errors;
  const finalWarnings = strict ? [] : warnings;

  // Add context prefix if provided
  const prefix = context ? `[${context}] ` : '';

  return {
    valid: finalErrors.length === 0,
    errors: finalErrors.map(e => prefix + e),
    warnings: finalWarnings.map(w => prefix + w),
    details,
  };
}

/**
 * Asserts that a ledger entry is valid, throwing an error if not.
 * Use this when validation failures should halt execution.
 */
export function assertValidLedgerEntry(
  entry: Partial<CommunityMembershipLedgerEntry>,
  options?: ValidationOptions
): void {
  const result = validateLedgerEntry(entry, { strict: true, ...options });
  if (!result.valid) {
    throw new Error(
      `Invalid ledger entry for group ${entry.groupId || '(unknown)'}: ${result.errors.join('; ')}`
    );
  }
}

/**
 * Quick check for critical fields only.
 * Use this for runtime checks where performance matters.
 */
export function isValidLedgerEntryQuick(
  entry: Partial<CommunityMembershipLedgerEntry>
): boolean {
  return !!(
    entry.groupId &&
    entry.publicKeyHex &&
    entry.displayName &&
    entry.status &&
    Array.isArray(entry.memberPubkeys) &&
    entry.memberPubkeys.length > 0
  );
}

/**
 * Validates an array of ledger entries.
 * Returns overall validity and individual results.
 */
export function validateLedgerEntries(
  entries: ReadonlyArray<CommunityMembershipLedgerEntry>,
  options?: ValidationOptions
): {
  allValid: boolean;
  total: number;
  valid: number;
  invalid: number;
  results: Array<{ entry: CommunityMembershipLedgerEntry; result: ValidationResult }>;
  errors: string[];
} {
  const results = entries.map(entry => ({
    entry,
    result: validateLedgerEntry(entry, options),
  }));

  const valid = results.filter(r => r.result.valid).length;
  const invalid = results.length - valid;

  return {
    allValid: invalid === 0,
    total: entries.length,
    valid,
    invalid,
    results,
    errors: results.flatMap(r =>
      r.result.errors.map(e => `Group ${r.entry.groupId || '(unknown)'}: ${e}`)
    ),
  };
}

/**
 * Checks if a ledger entry needs migration to current version.
 */
export function needsMigration(
  entry: Partial<CommunityMembershipLedgerEntry>
): boolean {
  const version = entry.ledgerVersion ?? 1;
  return version < CURRENT_LEDGER_VERSION;
}

/**
 * Gets the effective ledger version of an entry.
 */
export function getLedgerVersion(
  entry: Partial<CommunityMembershipLedgerEntry>
): number {
  return entry.ledgerVersion ?? 1;
}
