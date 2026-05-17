/**
 * Property-based tests for ConnectionStore
 * 
 * Tests the correctness properties defined in the smart invite system spec:
 * - Property 16: Connection Group Management
 * - Property 17: Trust Level Assignment
 * - Property 18: Connection Search and Filtering
 * - Validates Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { Connection, ConnectionGroup, TrustLevel, ConnectionFilter } from '../types';
import type { PublicKeyHex } from '@dweb/crypto/public-key-hex';

describe('ConnectionStore Property Tests', () => {
  let ConnectionStoreImplCtor: typeof import('../connection-store').ConnectionStoreImpl;
  let connectionStore: InstanceType<typeof ConnectionStoreImplCtor>;

  const mockLocalStorage = {
    getItem: vi.fn(() => null as string | null),
    setItem: vi.fn(() => undefined),
    removeItem: vi.fn(() => undefined),
    clear: vi.fn(() => undefined),
  };

  const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  const resetInviteDb = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('obscur-invites');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
    await flushMicrotasks();
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('localStorage', mockLocalStorage);

    const mod = await import('../connection-store');
    ConnectionStoreImplCtor = mod.ConnectionStoreImpl;
    connectionStore = new ConnectionStoreImplCtor();
  });

  afterEach(async () => {
    // Clean up IndexedDB between tests
    try {
      const databases = await indexedDB.databases();
      for (const db of databases) {
        if (db.name === 'obscur-invites') {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {
      // Ignore cleanup errors in tests
    }
  });

  // Helper arbitraries
  const validPubkey = fc
    .stringMatching(/^[0-9a-f]{64}$/)
    .map((s: string) => s.toLowerCase()) as fc.Arbitrary<PublicKeyHex>;
  const displayName = fc.string({ minLength: 1, maxLength: 100 });
  const trustLevel = fc.constantFrom('trusted', 'neutral', 'blocked') as fc.Arbitrary<TrustLevel>;
  const groupId = fc.uuid();
  const groupName = fc.string({ minLength: 1, maxLength: 100 });

  const connectionMetadata = fc.record({
    source: fc.constantFrom('qr', 'link', 'import', 'manual'),
    importedFrom: fc.option(fc.string()),
    notes: fc.option(fc.string({ maxLength: 500 }))
  });

  const connection = fc
    .record({
      publicKey: validPubkey,
      displayName: displayName,
      avatar: fc.option(fc.webUrl()),
      bio: fc.option(fc.string({ maxLength: 500 })),
      trustLevel: trustLevel,
      groups: fc.array(groupId, { maxLength: 10 }),
      addedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
      lastSeen: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })),
      metadata: connectionMetadata
    })
    .map((c) => ({
      ...c,
      id: c.publicKey,
    })) as fc.Arbitrary<Connection>;

  const connectionGroup = fc.record({
    id: groupId,
    name: groupName,
    description: fc.option(fc.string({ maxLength: 200 })),
    color: fc.option(fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 6, maxLength: 6 })
      .map(arr => arr.map(n => n.toString(16)).join(''))),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
  }) as fc.Arbitrary<ConnectionGroup>;

  describe('Property 16: Connection Group Management', () => {
    it('should support adding connections to multiple groups simultaneously', () => {
      fc.assert(
        fc.asyncProperty(
          connection,
          fc.uniqueArray(connectionGroup, { minLength: 1, maxLength: 5, selector: (g) => g.id }),
          async (testConnection, testGroups) => {
            await resetInviteDb();
            connectionStore = new ConnectionStoreImplCtor();
            // Create groups first
            for (const group of testGroups) {
              await connectionStore.createGroup(group);
            }

            await flushMicrotasks();

            // Add connection
            await connectionStore.addConnection(testConnection);

            await flushMicrotasks();

            // Add connection to multiple groups
            const groupIds = testGroups.map(g => g.id);
            for (const groupId of groupIds) {
              await connectionStore.addConnectionToGroup(testConnection.id, groupId);
            }

            // Verify connection is in all groups
            const updatedConnection = await connectionStore.getConnection(testConnection.id);
            expect(updatedConnection).not.toBeNull();

            for (const groupId of groupIds) {
              expect(updatedConnection!.groups).toContain(groupId);
              const connectionsInGroup = await connectionStore.getConnectionsByGroup(groupId);
              expect(connectionsInGroup.some((c: Connection) => c.id === testConnection.id)).toBe(true);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should preserve connection data when group is deleted', () => {
      fc.assert(
        fc.asyncProperty(
          connection,
          connectionGroup,
          async (testConnection, testGroup) => {
            await resetInviteDb();
            connectionStore = new ConnectionStoreImplCtor();
            // Create group and add connection
            await connectionStore.createGroup(testGroup);
            await connectionStore.addConnection(testConnection);

            await flushMicrotasks();

            await connectionStore.addConnectionToGroup(testConnection.id, testGroup.id);

            // Verify connection is in group
            let updatedConnection = await connectionStore.getConnection(testConnection.id);
            expect(updatedConnection!.groups).toContain(testGroup.id);

            // Delete group
            await connectionStore.deleteGroup(testGroup.id);

            // Verify connection still exists but group association is removed
            updatedConnection = await connectionStore.getConnection(testConnection.id);
            expect(updatedConnection).not.toBeNull();
            expect(updatedConnection!.groups).not.toContain(testGroup.id);
            expect(updatedConnection!.displayName).toBe(testConnection.displayName);
            expect(updatedConnection!.publicKey).toBe(testConnection.publicKey);
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Property 17: Trust Level Assignment', () => {
    it('should persist trust level and affect system behavior for blocked connections', () => {
      fc.assert(
        fc.asyncProperty(
          connection,
          trustLevel,
          async (testConnection, newTrustLevel) => {
            await resetInviteDb();
            connectionStore = new ConnectionStoreImplCtor();
            // Add connection
            await connectionStore.addConnection(testConnection);

            await flushMicrotasks();

            // Set trust level
            await connectionStore.setTrustLevel(testConnection.id, newTrustLevel);

            // Verify trust level is persisted
            const updatedConnection = await connectionStore.getConnection(testConnection.id);
            expect(updatedConnection!.trustLevel).toBe(newTrustLevel);

            // Verify trust level filtering works
            const connectionsByTrustLevel = await connectionStore.getConnectionsByTrustLevel(newTrustLevel);
            expect(connectionsByTrustLevel.some((c: Connection) => c.id === testConnection.id)).toBe(true);

            // Verify blocked connections are properly filtered
            if (newTrustLevel === 'blocked') {
              const blockedConnections = await connectionStore.getBlockedConnections();
              expect(blockedConnections.some((c: Connection) => c.id === testConnection.id)).toBe(true);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should support bulk trust level assignment', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(connection, { minLength: 2, maxLength: 10, selector: (c) => c.publicKey }),
          trustLevel,
          async (testConnections, newTrustLevel) => {
            await resetInviteDb();
            connectionStore = new ConnectionStoreImplCtor();
            // Add all connections
            for (const testConnection of testConnections) {
              await connectionStore.addConnection(testConnection);
            }

            await flushMicrotasks();

            // Bulk set trust level
            const connectionIds = testConnections.map(c => c.id);
            await connectionStore.bulkSetTrustLevel(connectionIds, newTrustLevel);

            // Verify all connections have the new trust level
            for (const connectionId of connectionIds) {
              const updatedConnection = await connectionStore.getConnection(connectionId);
              expect(updatedConnection!.trustLevel).toBe(newTrustLevel);
            }

            // Verify trust level filtering includes all connections
            const connectionsByTrustLevel = await connectionStore.getConnectionsByTrustLevel(newTrustLevel);
            for (const connectionId of connectionIds) {
              expect(connectionsByTrustLevel.some((c: Connection) => c.id === connectionId)).toBe(true);
            }
          }
        ),
        { numRuns: 25 }
      );
    });
  });

  describe('Property 18: Connection Search and Filtering', () => {
    it('should return only connections that match search criteria', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(connection, { minLength: 5, maxLength: 20, selector: (c) => c.publicKey }),
          fc.string({ minLength: 1, maxLength: 10 }),
          async (testConnections, searchQuery) => {
            await resetInviteDb();
            connectionStore = new ConnectionStoreImplCtor();
            // Add all connections
            for (const testConnection of testConnections) {
              await connectionStore.addConnection(testConnection);
            }

            await flushMicrotasks();

            // Search connections
            const searchResults = await connectionStore.searchConnections(searchQuery);

            // Verify all results match the search query
            const lowercaseQuery = searchQuery.toLowerCase();
            for (const result of searchResults) {
              const matchesDisplayName = result.displayName.toLowerCase().startsWith(lowercaseQuery);
              const matchesBio = result.bio?.toLowerCase().split(/\s+/).some((w) => w.startsWith(lowercaseQuery)) || false;
              const matchesPublicKey = result.publicKey.substring(0, 16).toLowerCase().startsWith(lowercaseQuery);

              expect(
                matchesDisplayName || matchesBio || matchesPublicKey
              ).toBe(true);
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should filter connections by multiple criteria correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(connection, { minLength: 10, maxLength: 30, selector: (c) => c.publicKey }),
          fc.record({
            trustLevel: fc.option(trustLevel),
            groups: fc.option(fc.array(groupId, { minLength: 1, maxLength: 3 })),
            searchQuery: fc.option(fc.string({ minLength: 1, maxLength: 10 })),
            addedAfter: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') })),
            addedBefore: fc.option(fc.date({ min: new Date('2025-01-01'), max: new Date('2030-01-01') }))
          }) as fc.Arbitrary<ConnectionFilter>,
          async (testConnections, filter) => {
            await resetInviteDb();
            connectionStore = new ConnectionStoreImplCtor();
            // Add all connections
            for (const testConnection of testConnections) {
              await connectionStore.addConnection(testConnection);
            }

            await flushMicrotasks();

            // Apply filter
            const filteredResults = await connectionStore.filterConnections(filter);

            // Verify all results match the filter criteria
            for (const result of filteredResults) {
              // Check trust level filter
              if (filter.trustLevel) {
                expect(result.trustLevel).toBe(filter.trustLevel);
              }

              // Check groups filter
              if (filter.groups && filter.groups.length > 0) {
                const hasMatchingGroup = filter.groups.some(groupId =>
                  result.groups.includes(groupId)
                );
                expect(hasMatchingGroup).toBe(true);
              }

              // Check search query filter
              if (filter.searchQuery) {
                const lowercaseQuery = filter.searchQuery.toLowerCase();
                const matchesDisplayName = result.displayName.toLowerCase().startsWith(lowercaseQuery);
                const matchesBio = result.bio?.toLowerCase().split(/\s+/).some((w) => w.startsWith(lowercaseQuery)) || false;
                const matchesPublicKey = result.publicKey.substring(0, 16).toLowerCase().startsWith(lowercaseQuery);

                expect(
                  matchesDisplayName || matchesBio || matchesPublicKey
                ).toBe(true);
              }

              // Check date range filters
              if (filter.addedAfter) {
                expect(result.addedAt.getTime()).toBeGreaterThanOrEqual(filter.addedAfter.getTime());
              }

              if (filter.addedBefore) {
                expect(result.addedAt.getTime()).toBeLessThanOrEqual(filter.addedBefore.getTime());
              }
            }
          }
        ),
        { numRuns: 25 }
      );
    });

    it('should handle empty search results correctly', () => {
      fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(connection, { minLength: 1, maxLength: 10, selector: (c) => c.publicKey }),
          fc.string({ minLength: 20, maxLength: 50 }), // Long random string unlikely to match
          async (testConnections, unlikelyQuery) => {
            await resetInviteDb();
            connectionStore = new ConnectionStoreImplCtor();
            // Add all connections
            for (const testConnection of testConnections) {
              await connectionStore.addConnection(testConnection);
            }

            await flushMicrotasks();

            // Search with unlikely query
            const searchResults = await connectionStore.searchConnections(unlikelyQuery);

            // If no results, that's valid behavior
            // If there are results, they must match the query
            const lowercaseQuery = unlikelyQuery.toLowerCase();
            for (const result of searchResults) {
              const matchesDisplayName = result.displayName.toLowerCase().startsWith(lowercaseQuery);
              const matchesBio = result.bio?.toLowerCase().split(/\s+/).some((w) => w.startsWith(lowercaseQuery)) || false;
              const matchesPublicKey = result.publicKey.substring(0, 16).toLowerCase().startsWith(lowercaseQuery);

              expect(
                matchesDisplayName || matchesBio || matchesPublicKey
              ).toBe(true);
            }
          }
        ),
        { numRuns: 25 }
      );
    });
  });
});