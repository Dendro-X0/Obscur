import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReliabilityMetricsSnapshot, resetReliabilityMetrics } from "@/app/shared/reliability-observability";

const mocks = vi.hoisted(() => ({
  getAllByIndexMock: vi.fn(),
  getMock: vi.fn(),
  getLocalMediaIndexSnapshotMock: vi.fn(),
  repairLocalMediaIndexMock: vi.fn(),
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    getAllByIndex: mocks.getAllByIndexMock,
    get: mocks.getMock,
  },
}));

vi.mock("@/app/features/vault/services/local-media-store", () => ({
  getLocalMediaIndexSnapshot: mocks.getLocalMediaIndexSnapshotMock,
  repairLocalMediaIndex: mocks.repairLocalMediaIndexMock,
}));

import { checkStorageHealth, runStorageRecovery } from "./storage-health-service";

describe("storage-health-service", () => {
  beforeEach(() => {
    resetReliabilityMetrics();
    (globalThis as Record<string, unknown>).IDBKeyRange = {
      bound: vi.fn(() => ({})),
    };
    mocks.getAllByIndexMock.mockReset();
    mocks.getMock.mockReset();
    mocks.getLocalMediaIndexSnapshotMock.mockReset();
    mocks.repairLocalMediaIndexMock.mockReset();
  });

  it("reports healthy state when stores and index checks pass", async () => {
    mocks.getAllByIndexMock.mockResolvedValue([]);
    mocks.getMock.mockResolvedValue(undefined);
    mocks.getLocalMediaIndexSnapshotMock.mockReturnValue({
      "https://example.test/a.png": {
        remoteUrl: "https://example.test/a.png",
        relativePath: "vault-media/a.png",
        savedAtUnixMs: Date.now(),
        fileName: "a.png",
        contentType: "image/png",
        size: 42,
      },
    });

    const health = await checkStorageHealth();
    expect(health.messageStoreOk).toBe(true);
    expect(health.queueStoreOk).toBe(true);
    expect(health.mediaIndexOk).toBe(true);
    expect(getReliabilityMetricsSnapshot().storage_health_failed).toBe(0);
  });

  it("flags degraded state and increments failure metric", async () => {
    mocks.getAllByIndexMock.mockRejectedValue(new Error("idb down"));
    mocks.getMock.mockResolvedValue(undefined);
    mocks.getLocalMediaIndexSnapshotMock.mockReturnValue({});

    const health = await checkStorageHealth();
    expect(health.messageStoreOk).toBe(false);
    expect(health.errorMessage).toContain("idb down");
    expect(getReliabilityMetricsSnapshot().storage_health_failed).toBe(1);
    expect(getReliabilityMetricsSnapshot().storage_write_retry).toBe(1);
  });

  it("reports recovery counters from repair runs", async () => {
    mocks.repairLocalMediaIndexMock.mockReturnValue({ repaired: 3, removed: 1 });
    const report = await runStorageRecovery();
    expect(report.status).toBe("repaired");
    expect(report.repairedEntries).toBe(3);
    expect(report.removedEntries).toBe(1);
    expect(report.recoveredEntries).toBe(4);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);

    const metrics = getReliabilityMetricsSnapshot();
    expect(metrics.storage_recovery_runs).toBe(1);
    expect(metrics.storage_recovery_records).toBe(4);
  });
});
