import { ConnectionStore } from './interfaces';
import {
  Connection,
  ConnectionGroup,
  ConnectionFilter,
  TrustLevel
} from './types';
import {
  CONNECTIONS_STORE,
  CONNECTION_GROUPS_STORE,
  ERROR_MESSAGES
} from './constants';
import { openInviteDb } from './db/open-invite-db';
import {
  LRUCache,
  connectionSearchIndex,
  paginateArray,
  type PaginationOptions,
  type PaginatedResult
} from './performance-optimizations';

/**
 * IndexedDB-based implementation of ConnectionStore interface with performance optimizations
 */
export class ConnectionStoreImpl implements ConnectionStore {
  private connectionCache: LRUCache<string, Connection>;
  private groupCache: LRUCache<string, ConnectionGroup>;
  private allConnectionsCache: { data: Connection[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5000; // 5 seconds

  constructor() {
    this.connectionCache = new LRUCache(100);
    this.groupCache = new LRUCache(50);
  }

  // Connection Management
  async addConnection(connection: Connection): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTIONS_STORE);

      const request = store.add(connection);

      request.onsuccess = () => {
        // Update caches
        this.connectionCache.set(connection.id, connection);
        this.allConnectionsCache = null; // Invalidate all connections cache
        connectionSearchIndex.addConnection(connection);
        resolve();
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async updateConnection(connectionId: string, updates: Partial<Connection>): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTIONS_STORE);

      const getRequest = store.get(connectionId);

      getRequest.onsuccess = () => {
        const existingConnection = getRequest.result;
        if (!existingConnection) {
          reject(new Error(ERROR_MESSAGES.CONNECTION_NOT_FOUND));
          return;
        }

        const updatedConnection = { ...existingConnection, ...updates };
        const putRequest = store.put(updatedConnection);

        putRequest.onsuccess = () => {
          // Update caches
          this.connectionCache.set(connectionId, updatedConnection);
          this.allConnectionsCache = null; // Invalidate all connections cache
          connectionSearchIndex.removeConnection(connectionId);
          connectionSearchIndex.addConnection(updatedConnection);
          resolve();
        };
        putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      };

      getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async removeConnection(connectionId: string): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTIONS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTIONS_STORE);

      const request = store.delete(connectionId);

      request.onsuccess = () => {
        // Update caches
        this.connectionCache.clear(); // Clear cache entry
        this.allConnectionsCache = null; // Invalidate all connections cache
        connectionSearchIndex.removeConnection(connectionId);
        resolve();
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getConnection(connectionId: string): Promise<Connection | null> {
    // Check cache first
    const cached = this.connectionCache.get(connectionId);
    if (cached) {
      return cached;
    }

    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTIONS_STORE], 'readonly');
      const store = transaction.objectStore(CONNECTIONS_STORE);

      const request = store.get(connectionId);

      request.onsuccess = () => {
        const connection = request.result || null;
        if (connection) {
          this.connectionCache.set(connectionId, connection);
        }
        resolve(connection);
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getAllConnections(): Promise<Connection[]> {
    // Check cache first
    if (this.allConnectionsCache && Date.now() - this.allConnectionsCache.timestamp < this.CACHE_TTL) {
      return this.allConnectionsCache.data;
    }

    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTIONS_STORE], 'readonly');
      const store = transaction.objectStore(CONNECTIONS_STORE);

      const request = store.getAll();

      request.onsuccess = () => {
        const connections = request.result || [];
        // Update cache
        this.allConnectionsCache = {
          data: connections,
          timestamp: Date.now()
        };
        // Rebuild search index if needed
        if (connectionSearchIndex.size === 0 && connections.length > 0) {
          connectionSearchIndex.rebuild(connections);
        }
        resolve(connections);
      };
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  /**
   * Get paginated connections for efficient rendering of large lists
   */
  async getPaginatedConnections(options: PaginationOptions): Promise<PaginatedResult<Connection>> {
    const allConnections = await this.getAllConnections();
    return paginateArray(allConnections, options);
  }

  async getConnectionByPublicKey(publicKey: string): Promise<Connection | null> {
    const allConnections = await this.getAllConnections();
    return allConnections.find((connection: Connection) => connection.publicKey === publicKey) || null;
  }

  // Connection Organization
  async createGroup(group: ConnectionGroup): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_GROUPS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTION_GROUPS_STORE);

      const request = store.add(group);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async deleteGroup(groupId: string): Promise<void> {
    const db = await openInviteDb();

    // First, remove this group from all connections
    const allConnections = await this.getAllConnections();
    const connectionsInGroup = allConnections.filter((connection: Connection) => connection.groups.includes(groupId));

    for (const connection of connectionsInGroup) {
      await this.removeConnectionFromGroup(connection.id, groupId);
    }

    // Then delete the group itself
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_GROUPS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTION_GROUPS_STORE);

      const request = store.delete(groupId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getGroup(groupId: string): Promise<ConnectionGroup | null> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_GROUPS_STORE], 'readonly');
      const store = transaction.objectStore(CONNECTION_GROUPS_STORE);

      const request = store.get(groupId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async getAllGroups(): Promise<ConnectionGroup[]> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_GROUPS_STORE], 'readonly');
      const store = transaction.objectStore(CONNECTION_GROUPS_STORE);

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async updateGroup(groupId: string, updates: Partial<ConnectionGroup>): Promise<void> {
    const db = await openInviteDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONNECTION_GROUPS_STORE], 'readwrite');
      const store = transaction.objectStore(CONNECTION_GROUPS_STORE);

      const getRequest = store.get(groupId);

      getRequest.onsuccess = () => {
        const existingGroup = getRequest.result;
        if (!existingGroup) {
          reject(new Error('Group not found'));
          return;
        }

        const updatedGroup = { ...existingGroup, ...updates };
        const putRequest = store.put(updatedGroup);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
      };

      getRequest.onerror = () => reject(new Error(ERROR_MESSAGES.STORAGE_ERROR));
    });
  }

  async addConnectionToGroup(connectionId: string, groupId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      throw new Error(ERROR_MESSAGES.CONNECTION_NOT_FOUND);
    }

    // Verify group exists
    const group = await this.getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Add group to connection's groups array if not already present
    if (!connection.groups.includes(groupId)) {
      const updatedGroups = [...connection.groups, groupId];
      await this.updateConnection(connectionId, { groups: updatedGroups });
    }
  }

  async removeConnectionFromGroup(connectionId: string, groupId: string): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      throw new Error(ERROR_MESSAGES.CONNECTION_NOT_FOUND);
    }

    // Remove group from connection's groups array
    const updatedGroups = connection.groups.filter((id: string) => id !== groupId);
    await this.updateConnection(connectionId, { groups: updatedGroups });
  }

  async addConnectionToMultipleGroups(connectionId: string, groupIds: string[]): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      throw new Error(ERROR_MESSAGES.CONNECTION_NOT_FOUND);
    }

    // Verify all groups exist
    for (const groupId of groupIds) {
      const group = await this.getGroup(groupId);
      if (!group) {
        throw new Error(`Group not found: ${groupId}`);
      }
    }

    // Add all new groups to connection's groups array
    const existingGroups = new Set(connection.groups);
    const newGroups = groupIds.filter(groupId => !existingGroups.has(groupId));

    if (newGroups.length > 0) {
      const updatedGroups = [...connection.groups, ...newGroups];
      await this.updateConnection(connectionId, { groups: updatedGroups });
    }
  }

  async removeConnectionFromMultipleGroups(connectionId: string, groupIds: string[]): Promise<void> {
    const connection = await this.getConnection(connectionId);
    if (!connection) {
      throw new Error(ERROR_MESSAGES.CONNECTION_NOT_FOUND);
    }

    // Remove all specified groups from connection's groups array
    const groupsToRemove = new Set(groupIds);
    const updatedGroups = connection.groups.filter((groupId: string) => !groupsToRemove.has(groupId));

    await this.updateConnection(connectionId, { groups: updatedGroups });
  }

  async getConnectionsByGroup(groupId: string): Promise<Connection[]> {
    const allConnections = await this.getAllConnections();
    return allConnections.filter((connection: Connection) => connection.groups.includes(groupId));
  }

  // Search and Filtering
  async searchConnections(query: string): Promise<Connection[]> {
    // Use optimized search index for better performance
    if (!query || query.trim().length === 0) {
      return this.getAllConnections();
    }

    // Ensure search index is populated
    const allConnections = await this.getAllConnections();
    if (connectionSearchIndex.size === 0) {
      connectionSearchIndex.rebuild(allConnections);
    }

    // Use optimized trie-based search
    return connectionSearchIndex.search(query);
  }

  /**
   * Search connections with pagination for large result sets
   */
  async searchConnectionsPaginated(
    query: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<Connection>> {
    const results = await this.searchConnections(query);
    return paginateArray(results, options);
  }

  async filterConnections(filter: ConnectionFilter): Promise<Connection[]> {
    const allConnections = await this.getAllConnections();

    return allConnections.filter((connection: Connection) => {
      // Filter by trust level
      if (filter.trustLevel && connection.trustLevel !== filter.trustLevel) {
        return false;
      }

      // Filter by groups
      if (filter.groups && filter.groups.length > 0) {
        const hasMatchingGroup = filter.groups.some((groupId: string) =>
          connection.groups.includes(groupId)
        );
        if (!hasMatchingGroup) {
          return false;
        }
      }

      // Filter by search query
      if (filter.searchQuery) {
        const lowercaseQuery = filter.searchQuery.toLowerCase();
        const matchesQuery =
          connection.displayName.toLowerCase().includes(lowercaseQuery) ||
          connection.bio?.toLowerCase().includes(lowercaseQuery) ||
          connection.publicKey.toLowerCase().includes(lowercaseQuery) ||
          connection.metadata.notes?.toLowerCase().includes(lowercaseQuery);

        if (!matchesQuery) {
          return false;
        }
      }

      // Filter by date range
      if (filter.addedAfter && connection.addedAt < filter.addedAfter) {
        return false;
      }

      if (filter.addedBefore && connection.addedAt > filter.addedBefore) {
        return false;
      }

      return true;
    });
  }

  // Trust Management
  async setTrustLevel(connectionId: string, level: TrustLevel): Promise<void> {
    await this.updateConnection(connectionId, { trustLevel: level });
  }

  async getTrustedConnections(): Promise<Connection[]> {
    return this.filterConnections({ trustLevel: 'trusted' });
  }

  async getBlockedConnections(): Promise<Connection[]> {
    return this.filterConnections({ trustLevel: 'blocked' });
  }

  async getNeutralConnections(): Promise<Connection[]> {
    return this.filterConnections({ trustLevel: 'neutral' });
  }

  async getConnectionsByTrustLevel(level: TrustLevel): Promise<Connection[]> {
    return this.filterConnections({ trustLevel: level });
  }

  async bulkSetTrustLevel(connectionIds: string[], level: TrustLevel): Promise<void> {
    for (const connectionId of connectionIds) {
      await this.setTrustLevel(connectionId, level);
    }
  }
}

// Export singleton instance
export const connectionStore = new ConnectionStoreImpl();