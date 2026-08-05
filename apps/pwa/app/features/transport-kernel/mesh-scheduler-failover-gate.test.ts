import { describe, expect, it, beforeEach } from "vitest";

import {
  clearMeshSchedulerOwnsFailover,
  extractMeshSchedulerOwnsFailover,
  meshSchedulerOwnsFailover,
  setMeshSchedulerOwnsFailover,
} from "./mesh-scheduler-failover-gate";

describe("mesh-scheduler-failover-gate", () => {
  beforeEach(() => {
    clearMeshSchedulerOwnsFailover();
  });

  it("defaults to false", () => {
    expect(meshSchedulerOwnsFailover("p1")).toBe(false);
  });

  it("is profile-scoped", () => {
    setMeshSchedulerOwnsFailover("p1", true);
    expect(meshSchedulerOwnsFailover("p1")).toBe(true);
    expect(meshSchedulerOwnsFailover("p2")).toBe(false);
  });

  it("clears when owns=false", () => {
    setMeshSchedulerOwnsFailover("p1", true);
    setMeshSchedulerOwnsFailover("p1", false);
    expect(meshSchedulerOwnsFailover("p1")).toBe(false);
  });

  it("extracts from configure outcome", () => {
    expect(extractMeshSchedulerOwnsFailover({
      meshSchedulerOwnsFailover: true,
    })).toBe(true);
    expect(extractMeshSchedulerOwnsFailover({
      snapshot: { meshSchedulerOwnsFailover: true },
    })).toBe(true);
    expect(extractMeshSchedulerOwnsFailover({})).toBeUndefined();
  });
});
