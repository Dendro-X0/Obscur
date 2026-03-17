import { beforeEach, describe, expect, it, vi } from "vitest";
import { getReliabilityMetricsSnapshot, resetReliabilityMetrics } from "@/app/shared/reliability-observability";

const mocks = vi.hoisted(() => ({
  getAllByIndexMock: vi.fn(),
  getMock: vi.fn(),
  getLocalMediaIndexSnapshotMock: vi.fn(),
  repairLocalMediaIndexMock: vi.fn(),
  checkStorageHealthMock: vi.fn(),
  runStorageRecoveryMock: vi.fn(),
  hasNativeRuntimeMock: vi.fn(() => false),
  getV090RolloutPolicyMock: vi.fn(() => ({
    stabilityModeEnabled: false,
    deterministicDiscoveryEnabled: false,
    protocolCoreEnabled: false,
    x3dhRatchetEnabled: false,
    tanstackQueryEnabled: false,
  })),
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

vi.mock("@/app/features/runtime/protocol-core-adapter", () => ({
  protocolCoreAdapter: {
    checkStorageHealth: mocks.checkStorageHealthMock,
    runStorageRecovery: mocks.runStorageRecoveryMock,
  },
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: mocks.hasNativeRuntimeMock,
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: vi.fn(() => ({})),
  },
}));

vi.mock("@/app/features/settings/services/v090-rollout-policy", () => ({
  getV090RolloutPolicy: mocks.getV090RolloutPolicyMock,
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
    mocks.checkStorageHealthMock.mockReset();
    mocks.runStorageRecoveryMock.mockReset();
    mocks.hasNativeRuntimeMock.mockReturnValue(false);
    mocks.getV090RolloutPolicyMock.mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: false,
      x3dhRatchetEnabled: false,
      tanstackQueryEnabled: false,
    });
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

  it("uses protocol storage checks when protocol owner is active", async () => {
    mocks.hasNativeRuntimeMock.mockReturnValue(true);
    mocks.getV090RolloutPolicyMock.mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: false,
      tanstackQueryEnabled: false,
    });
    mocks.checkStorageHealthMock.mockResolvedValue({
      ok: true,
      value: {
        healthy: true,
        lastCheckedAtUnixMs: 123,
      },
    });

    const health = await checkStorageHealth();
    expect(health.messageStoreOk).toBe(true);
    expect(health.checkedAtUnixMs).toBe(123);
    expect(mocks.getAllByIndexMock).not.toHaveBeenCalled();
  });

  it("uses protocol storage recovery when protocol owner is active", async () => {
    mocks.hasNativeRuntimeMock.mockReturnValue(true);
    mocks.getV090RolloutPolicyMock.mockReturnValue({
      stabilityModeEnabled: false,
      deterministicDiscoveryEnabled: false,
      protocolCoreEnabled: true,
      x3dhRatchetEnabled: false,
      tanstackQueryEnabled: false,
    });
    mocks.runStorageRecoveryMock.mockResolvedValue({
      ok: true,
      value: {
        repaired: true,
        recoveredEntries: 2,
        durationMs: 88,
      },
    });

    const report = await runStorageRecovery();
    expect(report.status).toBe("repaired");
    expect(report.recoveredEntries).toBe(2);
    expect(report.durationMs).toBe(88);
    expect(mocks.repairLocalMediaIndexMock).not.toHaveBeenCalled();
  });
});
