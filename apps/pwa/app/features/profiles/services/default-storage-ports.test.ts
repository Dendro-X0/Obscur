import { describe, expect, it, vi, afterEach } from "vitest";
import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { setProfileRuntimeScope } from "./profile-runtime-scope";
import { DEFAULT_STORAGE_PORTS, getResolvedStoragePorts, mergeStoragePorts } from "./default-storage-ports";

describe("default-storage-ports", () => {
  afterEach(() => {
    setProfileRuntimeScope(null);
  });

  it("mergeStoragePorts returns defaults when override is undefined", () => {
    expect(mergeStoragePorts(undefined)).toBe(DEFAULT_STORAGE_PORTS);
    expect(mergeStoragePorts({})).toBe(DEFAULT_STORAGE_PORTS);
  });

  it("mergeStoragePorts overlays messageDeleteTombstones methods", () => {
    const loadSuppressedMessageDeleteIds = vi.fn(() => new Set(["stub-id"]));
    const merged = mergeStoragePorts({
      messageDeleteTombstones: {
        ...DEFAULT_STORAGE_PORTS.messageDeleteTombstones,
        loadSuppressedMessageDeleteIds,
      },
    });
    expect(merged.messageDeleteTombstones.loadSuppressedMessageDeleteIds).toBe(loadSuppressedMessageDeleteIds);
    expect(merged.messageDeleteTombstones.suppressMessageDeleteTombstone).toBe(
      DEFAULT_STORAGE_PORTS.messageDeleteTombstones.suppressMessageDeleteTombstone,
    );
    expect(merged.messageDeleteTombstones.loadSuppressedMessageDeleteIds(0, "p")).toEqual(new Set(["stub-id"]));
  });

  it("getResolvedStoragePorts reads scope storagePorts when set", () => {
    const bus = createProfileMessageBus({ profileId: "p-scope" });
    const loadSuppressedMessageDeleteIds = vi.fn(() => new Set(["scoped"]));
    const merged = mergeStoragePorts({
      messageDeleteTombstones: {
        ...DEFAULT_STORAGE_PORTS.messageDeleteTombstones,
        loadSuppressedMessageDeleteIds,
      },
    });
    setProfileRuntimeScope({ profileId: "p-scope", bus, storagePorts: merged });
    expect(getResolvedStoragePorts()).toBe(merged);
    expect(getResolvedStoragePorts().messageDeleteTombstones.loadSuppressedMessageDeleteIds(0, "p")).toEqual(new Set(["scoped"]));
  });

  it("getResolvedStoragePorts falls back to defaults when scope is null", () => {
    expect(getResolvedStoragePorts()).toBe(DEFAULT_STORAGE_PORTS);
  });
});
