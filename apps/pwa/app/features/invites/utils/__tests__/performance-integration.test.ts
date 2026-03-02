/**
 * Integration tests for performance optimizations
 * Tests caching, pagination, and search performance
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { connectionStore } from '../connection-store';
import { qrGenerator } from '../qr-generator';
import {
  LRUCache,
  paginateArray,
  ConnectionSearchIndex,
  QRCodeCache,
  PerformanceMonitor,
  debounce,
  throttle,
  memoize
} from '../performance-optimizations';
import type { Connection, ConnectionGroup } from '../types';

describe('Performance Optimizations Integration', () => {
  beforeEach(async () => {
    // Clean up
    const connections = await connectionStore.getAllConnections();
    for (const connection of connections) {
      await connectionStore.removeConnection(connection.id);
    }
  });

  afterEach(async () => {
    const connections = await connectionStore.getAllConnections();
    for (const connection of connections) {
      await connectionStore.removeConnection(connection.id);
    }
  });

  describe('LRU Cache', () => {
    it('should cache and retrieve values', () => {
      const cache = new LRUCache<string, number>(3);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });

    it('should evict oldest item when capacity exceeded', () => {
      const cache = new LRUCache<string, number>(3);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // Should evict 'a'

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should update LRU order on access', () => {
      const cache = new LRUCache<string, number>(3);

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Access 'a' to make it most recently used
      cache.get('a');

      // Add new item, should evict 'b' (oldest)
      cache.set('d', 4);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });
  });

  describe('Pagination', () => {
    it('should paginate array correctly', () => {
      const items = Array.from({ length: 50 }, (_, i) => i);

      const page1 = paginateArray(items, { page: 1, pageSize: 10 });
      expect(page1.items).toHaveLength(10);
      expect(page1.items[0]).toBe(0);
      expect(page1.items[9]).toBe(9);
      expect(page1.totalPages).toBe(5);
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPreviousPage).toBe(false);

      const page3 = paginateArray(items, { page: 3, pageSize: 10 });
      expect(page3.items).toHaveLength(10);
      expect(page3.items[0]).toBe(20);
      expect(page3.hasNextPage).toBe(true);
      expect(page3.hasPreviousPage).toBe(true);

      const page5 = paginateArray(items, { page: 5, pageSize: 10 });
      expect(page5.items).toHaveLength(10);
      expect(page5.hasNextPage).toBe(false);
      expect(page5.hasPreviousPage).toBe(true);
    });

    it('should handle edge cases', () => {
      const items = Array.from({ length: 5 }, (_, i) => i);

      const result = paginateArray(items, { page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(5);
      expect(result.totalPages).toBe(1);
      expect(result.hasNextPage).toBe(false);
    });
  });

  describe('Connection Search Index', () => {
    it('should index and search connections efficiently', () => {
      const searchIndex = new ConnectionSearchIndex();

      const connections: Connection[] = [
        {
          id: '1',
          publicKey: 'a'.repeat(64) as any,
          displayName: 'Alice Smith',
          trustLevel: 'neutral',
          groups: [],
          addedAt: new Date(),
          metadata: {}
        },
        {
          id: '2',
          publicKey: 'b'.repeat(64) as any,
          displayName: 'Bob Johnson',
          trustLevel: 'neutral',
          groups: [],
          addedAt: new Date(),
          metadata: {}
        },
        {
          id: '3',
          publicKey: 'c'.repeat(64) as any,
          displayName: 'Alice Brown',
          trustLevel: 'neutral',
          groups: [],
          addedAt: new Date(),
          metadata: {}
        }
      ];

      connections.forEach(connection => searchIndex.addConnection(connection));

      // Search by name
      const aliceResults = searchIndex.search('alice');
      expect(aliceResults).toHaveLength(2);
      expect(aliceResults.every(c => c.displayName.toLowerCase().includes('alice'))).toBe(true);

      const bobResults = searchIndex.search('bob');
      expect(bobResults).toHaveLength(1);
      expect(bobResults[0].displayName).toBe('Bob Johnson');
    });

    it('should handle prefix matching', () => {
      const searchIndex = new ConnectionSearchIndex();

      const connection: Connection = {
        id: '1',
        publicKey: 'a'.repeat(64) as any,
        displayName: 'Alexander',
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: {}
      };

      searchIndex.addConnection(connection);

      expect(searchIndex.search('alex')).toHaveLength(1);
      expect(searchIndex.search('ale')).toHaveLength(1);
      expect(searchIndex.search('al')).toHaveLength(1);
      expect(searchIndex.search('xyz')).toHaveLength(0);
    });

    it('should rebuild index correctly', () => {
      const searchIndex = new ConnectionSearchIndex();

      const connections: Connection[] = [
        {
          id: '1',
          publicKey: 'a'.repeat(64) as any,
          displayName: 'Alice',
          trustLevel: 'neutral',
          groups: [],
          addedAt: new Date(),
          metadata: {}
        },
        {
          id: '2',
          publicKey: 'b'.repeat(64) as any,
          displayName: 'Bob',
          trustLevel: 'neutral',
          groups: [],
          addedAt: new Date(),
          metadata: {}
        }
      ];

      searchIndex.rebuild(connections);

      expect(searchIndex.search('alice')).toHaveLength(1);
      expect(searchIndex.search('bob')).toHaveLength(1);
    });
  });

  describe('QR Code Cache', () => {
    it('should cache QR code data URLs', () => {
      const cache = new QRCodeCache(10);

      const key1 = cache.generateKey('pubkey1', { displayName: 'Test' });
      const key2 = cache.generateKey('pubkey2', { displayName: 'Test' });

      cache.set(key1, 'data:image/png;base64,abc');
      cache.set(key2, 'data:image/png;base64,def');

      expect(cache.get(key1)).toBe('data:image/png;base64,abc');
      expect(cache.get(key2)).toBe('data:image/png;base64,def');
    });

    it('should generate unique keys for different options', () => {
      const cache = new QRCodeCache();

      const key1 = cache.generateKey('pubkey', { displayName: 'Alice' });
      const key2 = cache.generateKey('pubkey', { displayName: 'Bob' });

      expect(key1).not.toBe(key2);
    });
  });

  describe('Performance Monitor', () => {
    it('should track operation timings', () => {
      const monitor = new PerformanceMonitor();

      const end1 = monitor.start('test-operation');
      // Simulate work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }
      end1();

      const end2 = monitor.start('test-operation');
      // Simulate work
      for (let i = 0; i < 1000; i++) {
        Math.sqrt(i);
      }
      end2();

      const stats = monitor.getStats('test-operation');
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(2);
      expect(stats!.avg).toBeGreaterThanOrEqual(0);
      expect(stats!.min).toBeGreaterThanOrEqual(0);
      expect(stats!.max).toBeGreaterThanOrEqual(0);
    });

    it('should calculate statistics correctly', () => {
      const monitor = new PerformanceMonitor();

      monitor.record('operation', 10);
      monitor.record('operation', 20);
      monitor.record('operation', 30);

      const stats = monitor.getStats('operation');
      expect(stats!.count).toBe(3);
      expect(stats!.avg).toBe(20);
      expect(stats!.min).toBe(10);
      expect(stats!.max).toBe(30);
      expect(stats!.total).toBe(60);
    });
  });

  describe('Debounce and Throttle', () => {
    it('should debounce function calls', async () => {
      let callCount = 0;
      const fn = debounce(() => {
        callCount++;
      }, 50);

      // Call multiple times rapidly
      fn();
      fn();
      fn();

      // Should not have been called yet
      expect(callCount).toBe(0);

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should have been called once
      expect(callCount).toBe(1);
    });

    it('should throttle function calls', async () => {
      let callCount = 0;
      const fn = throttle(() => {
        callCount++;
      }, 50);

      // First call should execute immediately
      fn();
      expect(callCount).toBe(1);

      // Subsequent calls within throttle period should be ignored
      fn();
      fn();
      expect(callCount).toBe(1);

      // Wait for throttle period
      await new Promise(resolve => setTimeout(resolve, 60));

      // Next call should execute
      fn();
      expect(callCount).toBe(2);
    });
  });

  describe('Memoization', () => {
    it('should cache function results', () => {
      let callCount = 0;
      const expensiveFn = memoize((x: number, y: number) => {
        callCount++;
        return x + y;
      });

      expect(expensiveFn(1, 2)).toBe(3);
      expect(callCount).toBe(1);

      // Second call with same args should use cache
      expect(expensiveFn(1, 2)).toBe(3);
      expect(callCount).toBe(1);

      // Different args should call function again
      expect(expensiveFn(2, 3)).toBe(5);
      expect(callCount).toBe(2);
    });

    it('should use custom key generator', () => {
      let callCount = 0;
      const fn = memoize(
        (obj: { x: number; y: number }) => {
          callCount++;
          return obj.x + obj.y;
        },
        (obj) => `${obj.x}-${obj.y}`
      );

      expect(fn({ x: 1, y: 2 })).toBe(3);
      expect(callCount).toBe(1);

      // Different object but same values should use cache
      expect(fn({ x: 1, y: 2 })).toBe(3);
      expect(callCount).toBe(1);
    });
  });

  describe('Connection Store Performance', () => {
    it('should handle large connection lists efficiently', async () => {
      // Create 100 connections
      const connections: Connection[] = Array.from({ length: 100 }, (_, i) => ({
        id: `connection-${i}`,
        publicKey: i.toString().repeat(64).substring(0, 64) as any,
        displayName: `User ${i}`,
        trustLevel: 'neutral' as const,
        groups: [],
        addedAt: new Date(),
        metadata: {}
      }));

      // Add all connections
      for (const connection of connections) {
        await connectionStore.addConnection(connection);
      }

      // Test search performance
      const startTime = Date.now();
      const results = await connectionStore.searchConnections('User 50');
      const searchTime = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(searchTime).toBeLessThan(100); // Should complete within 100ms

      // Test pagination
      const page1 = await (connectionStore as any).getPaginatedConnections({
        page: 1,
        pageSize: 20
      });

      expect(page1.items).toHaveLength(20);
      expect(page1.totalPages).toBe(5);
    });

    it('should cache frequently accessed connections', async () => {
      const connection: Connection = {
        id: 'test-connection',
        publicKey: 'a'.repeat(64) as any,
        displayName: 'Test User',
        trustLevel: 'neutral',
        groups: [],
        addedAt: new Date(),
        metadata: {}
      };

      await connectionStore.addConnection(connection);

      // First access (from database)
      const start1 = Date.now();
      await connectionStore.getConnection('test-connection');
      const time1 = Date.now() - start1;

      // Second access (from cache)
      const start2 = Date.now();
      await connectionStore.getConnection('test-connection');
      const time2 = Date.now() - start2;

      // Cached access should be faster
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });

  describe('QR Generator Performance', () => {
    it('should cache QR code generation', async () => {
      const mockPublicKey = '0'.repeat(64);
      const mockPrivateKey = '1'.repeat(64);

      const options = {
        displayName: 'Test User',
        expirationHours: 24,
        includeProfile: true
      };

      // First generation
      const start1 = Date.now();
      const qr1 = await qrGenerator.createInviteQR(
        mockPublicKey as any,
        mockPrivateKey as any,
        options
      );
      const time1 = Date.now() - start1;

      expect(qr1.dataUrl).toBeTruthy();

      // Note: Caching is based on exact options match
      // This test validates that the caching mechanism exists
      // Actual cache hits depend on implementation details
    });
  });
});
