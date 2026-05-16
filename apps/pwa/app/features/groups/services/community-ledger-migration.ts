/**
 * Community Ledger Migration Module
 *
 * Handles migration of ledger entries from older schema versions to current.
 * Ensures backward compatibility while enabling data integrity improvements.
 */

import type { CommunityMembershipLedgerEntry } from './community-membership-ledger';
import {
  CURRENT_LEDGER_VERSION,
  validateLedgerEntry,
  PLACEHOLDER_GROUP_NAME,
} from './community-ledger-validator';

/** Migration function signature */
type MigrationFn = (
  entry: CommunityMembershipLedgerEntry,
  context: MigrationContext
) => CommunityMembershipLedgerEntry;

/** Context available during migration */
interface MigrationContext {
  publicKeyHex: string;
  persistedGroups: Array<{
    groupId: string;
    displayName?: string;
    memberPubkeys?: readonly string[];
    adminPubkeys?: readonly string[];
  }>;
  now: number;
}

/** Individual migration definition */
interface Migration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate: MigrationFn;
}

/**
 * Migration v1 → v2:
 * - Adds required publicKeyHex
 * - Adds memberPubkeys and adminPubkeys from persisted groups
 * - Adds ledgerVersion, createdAt, updatedAt
 * - Converts avatar → avatarUrl
 * - Converts updatedAtUnixMs → updatedAt
 */
const v1ToV2Migration: Migration = {
  fromVersion: 1,
  toVersion: 2,
  description: 'Add member lists and metadata fields',
  migrate: (entry, context): CommunityMembershipLedgerEntry => {
    const { publicKeyHex, persistedGroups, now } = context;

    // Find matching persisted group for member data
    const persistedGroup = persistedGroups.find(g => g.groupId === entry.groupId);

    // Build member list from available sources
    // Priority: 1) Ledger entry (if already has it), 2) Persisted group, 3) Creator only
    const memberPubkeys =
      (entry as unknown as { memberPubkeys?: readonly string[] }).memberPubkeys ??
      persistedGroup?.memberPubkeys ??
      [publicKeyHex];

    // Build admin list
    const adminPubkeys =
      (entry as unknown as { adminPubkeys?: readonly string[] }).adminPubkeys ??
      persistedGroup?.adminPubkeys ??
      [publicKeyHex];

    // Get timestamps
    const updatedAt = entry.updatedAt ?? entry.updatedAtUnixMs ?? now;
    const createdAt = entry.createdAt ?? updatedAt;

    // Get display name (treat placeholder as missing — it indicates data loss)
    const entryDisplayName = entry.displayName === PLACEHOLDER_GROUP_NAME
      ? undefined
      : entry.displayName;
    const displayName =
      entryDisplayName ??
      persistedGroup?.displayName ??
      PLACEHOLDER_GROUP_NAME;

    // Migrate avatar field
    const avatarUrl = entry.avatarUrl ?? entry.avatar;

    return {
      // Required new fields
      groupId: entry.groupId,
      publicKeyHex,
      status: entry.status,
      displayName,
      memberPubkeys: [...memberPubkeys],
      adminPubkeys: [...adminPubkeys],
      ledgerVersion: 2,
      createdAt,
      updatedAt: now,

      // Optional fields
      joinedAt: entry.joinedAt,
      avatarUrl,

      // Legacy fields (preserved for compatibility)
      communityId: entry.communityId,
      relayUrl: entry.relayUrl,
      updatedAtUnixMs: entry.updatedAtUnixMs,
      lastEvidenceEventId: entry.lastEvidenceEventId,
      avatar: entry.avatar,
    };
  },
};

/** All available migrations in order */
const MIGRATIONS: Migration[] = [v1ToV2Migration];

/**
 * Gets the effective version of a ledger entry.
 * Returns 1 for legacy entries without explicit version.
 */
export function getEntryVersion(entry: CommunityMembershipLedgerEntry): number {
  return entry.ledgerVersion ?? 1;
}

/**
 * Checks if an entry needs migration to reach target version.
 */
export function needsMigrationToVersion(
  entry: CommunityMembershipLedgerEntry,
  targetVersion: number
): boolean {
  return getEntryVersion(entry) < targetVersion;
}

/**
 * Finds the appropriate migration path for an entry.
 */
function findMigrationPath(
  fromVersion: number,
  toVersion: number
): Migration[] {
  const path: Migration[] = [];
  let current = fromVersion;

  while (current < toVersion) {
    const nextMigration = MIGRATIONS.find(m => m.fromVersion === current);
    if (!nextMigration) {
      // No direct migration found, can't proceed
      break;
    }
    path.push(nextMigration);
    current = nextMigration.toVersion;
  }

  return path;
}

/**
 * Applies a single migration to an entry.
 */
function applyMigration(
  entry: CommunityMembershipLedgerEntry,
  migration: Migration,
  context: MigrationContext
): CommunityMembershipLedgerEntry {
  try {
    const migrated = migration.migrate(entry, context);

    // Validate after migration
    const validation = validateLedgerEntry(migrated, { allowLegacy: false });
    if (!validation.valid) {
      console.warn(
        `Migration ${migration.fromVersion}→${migration.toVersion} ` +
        `produced invalid entry for group ${entry.groupId}:`,
        validation.errors
      );
    }

    return migrated;
  } catch (error) {
    console.error(
      `Migration ${migration.fromVersion}→${migration.toVersion} ` +
      `failed for group ${entry.groupId}:`,
      error
    );

    // Return original with version bumped to prevent re-migration attempts
    return {
      ...entry,
      ledgerVersion: migration.toVersion,
      updatedAt: context.now,
    };
  }
}

/**
 * Migrates a single ledger entry to the current schema version.
 */
export function migrateLedgerEntry(
  entry: CommunityMembershipLedgerEntry,
  context: MigrationContext
): CommunityMembershipLedgerEntry {
  const currentVersion = getEntryVersion(entry);

  if (currentVersion >= CURRENT_LEDGER_VERSION) {
    return entry;
  }

  const migrationPath = findMigrationPath(currentVersion, CURRENT_LEDGER_VERSION);

  if (migrationPath.length === 0) {
    console.warn(
      `No migration path found for group ${entry.groupId} ` +
      `from v${currentVersion} to v${CURRENT_LEDGER_VERSION}`
    );
    // Return with version set to prevent infinite re-migration
    return { ...entry, ledgerVersion: CURRENT_LEDGER_VERSION };
  }

  // Apply migrations sequentially
  let migrated = entry;
  for (const migration of migrationPath) {
    migrated = applyMigration(migrated, migration, context);
  }

  return migrated;
}

/**
 * Migrates an array of ledger entries to the current schema version.
 * This is the main entry point for ledger migration.
 */
export async function migrateLedgerEntries(
  entries: CommunityMembershipLedgerEntry[],
  publicKeyHex: string,
  loadPersistedGroups?: (publicKeyHex: string) => Promise<
    Array<{
      groupId: string;
      displayName?: string;
      memberPubkeys?: readonly string[];
      adminPubkeys?: readonly string[];
    }>
  >
): Promise<{
  migrated: CommunityMembershipLedgerEntry[];
  stats: {
    total: number;
    alreadyCurrent: number;
    migrated: number;
    failed: number;
  };
}> {
  const now = Date.now();

  // Load persisted groups for context if loader provided
  const persistedGroups = loadPersistedGroups
    ? await loadPersistedGroups(publicKeyHex)
    : [];

  const context: MigrationContext = {
    publicKeyHex,
    persistedGroups,
    now,
  };

  let alreadyCurrent = 0;
  let migrated = 0;
  let failed = 0;

  const result = entries.map(entry => {
    const version = getEntryVersion(entry);

    if (version >= CURRENT_LEDGER_VERSION) {
      alreadyCurrent++;
      return entry;
    }

    try {
      const migratedEntry = migrateLedgerEntry(entry, context);

      // Count as migrated if version changed
      if (getEntryVersion(migratedEntry) > version) {
        migrated++;
      } else {
        failed++;
      }

      return migratedEntry;
    } catch (error) {
      failed++;
      console.error(`Failed to migrate entry ${entry.groupId}:`, error);
      // Return original with version set to prevent re-migration
      return { ...entry, ledgerVersion: CURRENT_LEDGER_VERSION };
    }
  });

  return {
    migrated: result,
    stats: {
      total: entries.length,
      alreadyCurrent,
      migrated,
      failed,
    },
  };
}

/**
 * Gets migration statistics without actually migrating.
 * Useful for diagnostics and planning.
 */
export function getMigrationStats(
  entries: CommunityMembershipLedgerEntry[]
): {
  total: number;
  byVersion: Record<number, number>;
  needMigration: number;
} {
  const byVersion: Record<number, number> = {};
  let needMigration = 0;

  for (const entry of entries) {
    const version = getEntryVersion(entry);
    byVersion[version] = (byVersion[version] ?? 0) + 1;

    if (version < CURRENT_LEDGER_VERSION) {
      needMigration++;
    }
  }

  return {
    total: entries.length,
    byVersion,
    needMigration,
  };
}
