/**
 * CRDT Sync Protocol Tests
 *
 * Tests for Phase 5: Sync Protocol
 * - Deterministic merge semantics
 * - Namespace registration
 * - Snapshot validation
 * - Batch sync operations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSnapshot,
  syncCRDTs,
  batchSync,
  validateSnapshot,
  computeChecksum,
  registerSyncHandler,
  getSyncStats,
  type SerializedCRDT,
  type SyncOptions,
  type SyncNamespace,
} from "../crdt-sync-protocol.js";

// Mock CRDT modules
vi.mock("@dweb/crdt/or-set", () => ({
  mergeORSets: vi.fn((a, b) => ({ ...a, ...b, merged: true })),
}));

vi.mock("@dweb/crdt/lww-register", () => ({
  mergeLWWRegisters: vi.fn((a, b) => ({ ...a, ...b, merged: true })),
}));

vi.mock("@dweb/crdt/g-counter", () => ({
  mergeGCounters: vi.fn((a, b) => ({ ...a, ...b, merged: true })),
}));

describe("CRDT Sync Protocol", () => {
  const mockDeviceId = "test-device-123";
  const mockOptions: SyncOptions = {
    deviceId: mockDeviceId,
    validateChecksums: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Snapshot Creation", () => {
    it("should create a valid snapshot", () => {
      const state = { items: ["a", "b", "c"] };
      const snapshot = createSnapshot(
        "or-set",
        "community-membership",
        "community-1",
        state,
        mockDeviceId,
        1
      );

      expect(snapshot).toMatchObject({
        type: "or-set",
        namespace: "community-membership",
        entityId: "community-1",
        schemaVersion: 1,
        state,
        metadata: {
          deviceId: mockDeviceId,
        },
      });

      expect(snapshot.metadata.createdAt).toBeTypeOf("number");
      expect(snapshot.metadata.sequenceNumber).toBeTypeOf("number");
    });

    it("should use default schema version", () => {
      const state = {};
      const snapshot = createSnapshot(
        "g-counter",
        "presence-gossip",
        "profile-1",
        state,
        mockDeviceId
      );

      expect(snapshot.schemaVersion).toBe(1);
    });

    it("should serialize through registered handler", () => {
      const customSerializer = vi.fn((s) => ({ serialized: true, original: s }));

      registerSyncHandler("test-namespace", {
        merge: vi.fn(),
        serialize: customSerializer,
        deserialize: vi.fn(),
        validate: vi.fn().mockReturnValue(true),
      });

      const state = { data: "test" };
      const snapshot = createSnapshot(
        "or-set",
        "test-namespace",
        "entity-1",
        state,
        mockDeviceId
      );

      expect(customSerializer).toHaveBeenCalledWith(state);
      expect(snapshot.state).toEqual({ serialized: true, original: state });
    });
  });

  describe("Snapshot Validation", () => {
    it("should validate correct snapshots", () => {
      const validSnapshot: SerializedCRDT = {
        type: "or-set",
        namespace: "community-membership",
        entityId: "community-1",
        schemaVersion: 1,
        state: {},
        metadata: {
          createdAt: Date.now(),
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      expect(validateSnapshot(validSnapshot)).toBe(true);
    });

    it("should reject null snapshots", () => {
      expect(validateSnapshot(null)).toBe(false);
    });

    it("should reject non-object snapshots", () => {
      expect(validateSnapshot("string")).toBe(false);
      expect(validateSnapshot(123)).toBe(false);
    });

    it("should reject snapshots with missing required fields", () => {
      const missingType = {
        namespace: "community-membership",
        entityId: "community-1",
        schemaVersion: 1,
        state: {},
        metadata: { createdAt: 1, deviceId: "d1", sequenceNumber: 1 },
      };

      const missingNamespace = {
        type: "or-set",
        entityId: "community-1",
        schemaVersion: 1,
        state: {},
        metadata: { createdAt: 1, deviceId: "d1", sequenceNumber: 1 },
      };

      expect(validateSnapshot(missingType)).toBe(false);
      expect(validateSnapshot(missingNamespace)).toBe(false);
    });
  });

  describe("Checksum Computation", () => {
    it("should compute deterministic checksums", () => {
      const snapshot: SerializedCRDT = {
        type: "or-set",
        namespace: "community-membership",
        entityId: "community-1",
        schemaVersion: 1,
        state: { items: ["a", "b"] },
        metadata: {
          createdAt: 123456,
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      const checksum1 = computeChecksum(snapshot);
      const checksum2 = computeChecksum(snapshot);

      expect(checksum1).toBeTypeOf("string");
      expect(checksum1).toBe(checksum2);
    });

    it("should produce different checksums for different data", () => {
      const snapshot1: SerializedCRDT = {
        type: "or-set",
        namespace: "community-membership",
        entityId: "community-1",
        schemaVersion: 1,
        state: { items: ["a"] },
        metadata: {
          createdAt: 123456,
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      const snapshot2: SerializedCRDT = {
        type: "or-set",
        namespace: "community-membership",
        entityId: "community-1",
        schemaVersion: 1,
        state: { items: ["b"] },
        metadata: {
          createdAt: 123456,
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      const checksum1 = computeChecksum(snapshot1);
      const checksum2 = computeChecksum(snapshot2);

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe("Sync Operations", () => {
    it("should sync with registered handler", () => {
      const mockMerge = vi.fn().mockReturnValue({ merged: true, data: "result" });

      registerSyncHandler("test-sync", {
        merge: mockMerge,
        serialize: vi.fn((s) => s),
        deserialize: vi.fn((d) => d),
        validate: vi.fn().mockReturnValue(true),
      });

      const local = { version: 1 };
      const remote: SerializedCRDT = {
        type: "or-set",
        namespace: "test-sync",
        entityId: "test-1",
        schemaVersion: 1,
        state: { version: 2 },
        metadata: {
          createdAt: Date.now(),
          deviceId: "remote-device",
          sequenceNumber: 2,
        },
      };

      const result = syncCRDTs(local, remote, mockOptions);

      expect(mockMerge).toHaveBeenCalledWith(local, { version: 2 });
      expect(result.merged).toEqual({ merged: true, data: "result" });
      expect(result.localChanged).toBe(true);
      expect(result.remoteHadNewData).toBe(true);
    });

    it("should call progress callbacks", () => {
      const progressCallback = vi.fn();

      registerSyncHandler("progress-test", {
        merge: vi.fn().mockReturnValue({}),
        serialize: vi.fn(),
        deserialize: vi.fn().mockReturnValue({}),
        validate: vi.fn().mockReturnValue(true),
      });

      const remote: SerializedCRDT = {
        type: "or-set",
        namespace: "progress-test",
        entityId: "test-1",
        schemaVersion: 1,
        state: {},
        metadata: {
          createdAt: Date.now(),
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      syncCRDTs({}, remote, {
        ...mockOptions,
        onProgress: progressCallback,
      });

      expect(progressCallback).toHaveBeenCalledTimes(4);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "deserialize", percentComplete: 25 })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "validate", percentComplete: 50 })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "merge", percentComplete: 75 })
      );
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ phase: "persist", percentComplete: 100 })
      );
    });

    it("should reject stale snapshots when maxAgeMs is set", () => {
      registerSyncHandler("stale-test", {
        merge: vi.fn(),
        serialize: vi.fn(),
        deserialize: vi.fn().mockReturnValue({}),
        validate: vi.fn().mockReturnValue(true),
      });

      const oldSnapshot: SerializedCRDT = {
        type: "or-set",
        namespace: "stale-test",
        entityId: "test-1",
        schemaVersion: 1,
        state: {},
        metadata: {
          createdAt: Date.now() - 10000, // 10 seconds old
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      expect(() =>
        syncCRDTs({}, oldSnapshot, {
          ...mockOptions,
          maxAgeMs: 5000, // 5 second max age
        })
      ).toThrow("CRDT snapshot too old");
    });

    it("should throw for unregistered namespaces", () => {
      const remote: SerializedCRDT = {
        type: "or-set",
        namespace: "unregistered-namespace" as SyncNamespace,
        entityId: "test-1",
        schemaVersion: 1,
        state: {},
        metadata: {
          createdAt: Date.now(),
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      expect(() => syncCRDTs({}, remote, mockOptions)).toThrow(
        "No sync handler registered"
      );
    });

    it("should handle partial failures gracefully", () => {
      registerSyncHandler("partial-success", {
        merge: vi.fn().mockReturnValue({}),
        serialize: vi.fn(),
        deserialize: vi.fn().mockReturnValue({}),
        validate: vi.fn().mockReturnValue(true),
      });

      const localStates: Record<string, unknown> = {};

      const remoteSnapshots: SerializedCRDT[] = [
        {
          type: "or-set",
          namespace: "partial-success",
          entityId: "entity-1",
          schemaVersion: 1,
          state: {},
          metadata: {
            createdAt: Date.now(),
            deviceId: "remote",
            sequenceNumber: 1,
          },
        },
        {
          type: "or-set",
          namespace: "failing-namespace" as SyncNamespace,
          entityId: "entity-2",
          schemaVersion: 1,
          state: {},
          metadata: {
            createdAt: Date.now(),
            deviceId: "remote",
            sequenceNumber: 2,
          },
        },
      ];

      const result = batchSync(localStates, remoteSnapshots, mockOptions);

      expect(result.allSucceeded).toBe(false);
      expect(result.results.size).toBe(1); // Only one succeeded
    });
  });

  describe("Batch Sync", () => {
    it("should sync multiple snapshots", () => {
      const mockMerge = vi.fn().mockReturnValue({ merged: true });

      registerSyncHandler("batch-test", {
        merge: mockMerge,
        serialize: vi.fn(),
        deserialize: vi.fn().mockReturnValue({}),
        validate: vi.fn().mockReturnValue(true),
      });

      const localStates = {
        "batch-test:entity-1": { data: "local1" },
        "batch-test:entity-2": { data: "local2" },
      };

      const remoteSnapshots: SerializedCRDT[] = [
        {
          type: "or-set",
          namespace: "batch-test",
          entityId: "entity-1",
          schemaVersion: 1,
          state: { data: "remote1" },
          metadata: {
            createdAt: Date.now(),
            deviceId: "remote",
            sequenceNumber: 2,
          },
        },
        {
          type: "or-set",
          namespace: "batch-test",
          entityId: "entity-2",
          schemaVersion: 1,
          state: { data: "remote2" },
          metadata: {
            createdAt: Date.now(),
            deviceId: "remote",
            sequenceNumber: 2,
          },
        },
      ];

      const result = batchSync(localStates, remoteSnapshots, mockOptions);

      expect(result.allSucceeded).toBe(true);
      expect(result.results.size).toBe(2);
      expect(mockMerge).toHaveBeenCalledTimes(2);
    });

    it("should throw for invalid state", () => {
      registerSyncHandler("invalid-test", {
        merge: vi.fn(),
        serialize: vi.fn(),
        deserialize: vi.fn().mockReturnValue({ invalid: true }),
        validate: vi.fn().mockReturnValue(false),
      });

      const remote: SerializedCRDT = {
        type: "or-set",
        namespace: "invalid-test",
        entityId: "test-1",
        schemaVersion: 1,
        state: {},
        metadata: {
          createdAt: Date.now(),
          deviceId: "device-1",
          sequenceNumber: 1,
        },
      };

      expect(() => syncCRDTs({}, remote, mockOptions)).toThrow("Invalid CRDT state");
    });
  });

  describe("Sync Stats", () => {
    it("should report registered namespaces", () => {
      // Clear and register some handlers
      registerSyncHandler("stats-test-1", {
        merge: vi.fn(),
        serialize: vi.fn(),
        deserialize: vi.fn(),
        validate: vi.fn(),
      });

      registerSyncHandler("stats-test-2", {
        merge: vi.fn(),
        serialize: vi.fn(),
        deserialize: vi.fn(),
        validate: vi.fn(),
      });

      const stats = getSyncStats();

      expect(stats.registeredNamespaces).toContain("stats-test-1");
      expect(stats.registeredNamespaces).toContain("stats-test-2");
      expect(stats.handlerCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Real-World Scenarios", () => {
    it("should handle concurrent updates from multiple devices", () => {
      const mergeResults: string[] = [];
      type ItemState = { items?: string[] };

      registerSyncHandler("concurrent-test", {
        merge: (local, remote) => {
          const localState = local as ItemState;
          const remoteState = remote as ItemState;
          const result = {
            items: Array.from(new Set([...(localState.items ?? []), ...(remoteState.items ?? [])])),
          };
          mergeResults.push(`merged ${(remoteState.items ?? []).length} items`);
          return result;
        },
        serialize: vi.fn((s) => s),
        deserialize: vi.fn((d) => d),
        validate: vi.fn().mockReturnValue(true),
      });

      // Local has items A, B
      const local = { items: ["A", "B"] };

      // Device 1 adds C
      const device1Snapshot: SerializedCRDT = {
        type: "or-set",
        namespace: "concurrent-test",
        entityId: "test",
        schemaVersion: 1,
        state: { items: ["A", "B", "C"] },
        metadata: { createdAt: 1, deviceId: "d1", sequenceNumber: 1 },
      };

      // Device 2 adds D
      const device2Snapshot: SerializedCRDT = {
        type: "or-set",
        namespace: "concurrent-test",
        entityId: "test",
        schemaVersion: 1,
        state: { items: ["A", "B", "D"] },
        metadata: { createdAt: 2, deviceId: "d2", sequenceNumber: 1 },
      };

      // Merge device 1
      const result1 = syncCRDTs(local, device1Snapshot, mockOptions);

      // Merge device 2 with result of first merge
      const result2 = syncCRDTs(result1.merged, device2Snapshot, mockOptions);

      // Final state should have all items
      expect(result2.merged.items).toContain("A");
      expect(result2.merged.items).toContain("B");
      expect(result2.merged.items).toContain("C");
      expect(result2.merged.items).toContain("D");
    });

    it("should be idempotent (A ⊔ A = A)", () => {
      const mockMerge = vi.fn().mockImplementation((local, remote) => ({
        ...local,
        ...remote,
      }));

      registerSyncHandler("idempotent-test", {
        merge: mockMerge,
        serialize: vi.fn((s) => s),
        deserialize: vi.fn((d) => d),
        validate: vi.fn().mockReturnValue(true),
      });

      const local = { counter: 5 };
      const remote: SerializedCRDT = {
        type: "g-counter",
        namespace: "idempotent-test",
        entityId: "test",
        schemaVersion: 1,
        state: { counter: 10 },
        metadata: { createdAt: Date.now(), deviceId: "d1", sequenceNumber: 1 },
      };

      // First sync
      const result1 = syncCRDTs(local, remote, mockOptions);

      // Second sync with same data (idempotent)
      const result2 = syncCRDTs(result1.merged, remote, mockOptions);

      // Second call should recognize no change needed
      expect(result2.localChanged).toBe(false);
    });
  });
});
