import { describe, expect, it, beforeEach } from "vitest";
import {
  evaluateDmKernelThreadOpenBudget,
  recordDmKernelInvoke,
  resetDmKernelInvokeAuditForTests,
} from "./dm-kernel-invoke-audit";

describe("dm-kernel-invoke-audit", () => {
  beforeEach(() => {
    resetDmKernelInvokeAuditForTests();
  });

  it("passes when initial sqlite invoke count is within budget", () => {
    recordDmKernelInvoke({
      kind: "messages_initial",
      profileId: "p1",
      conversationId: "c1",
      atUnixMs: Date.now(),
      source: "sqlite",
    });
    expect(evaluateDmKernelThreadOpenBudget("p1", "c1").pass).toBe(true);
  });

  it("fails when initial sqlite invoke exceeds budget", () => {
    recordDmKernelInvoke({
      kind: "messages_initial",
      profileId: "p1",
      conversationId: "c1",
      atUnixMs: Date.now(),
      source: "sqlite",
    });
    recordDmKernelInvoke({
      kind: "messages_initial",
      profileId: "p1",
      conversationId: "c1",
      atUnixMs: Date.now(),
      source: "sqlite",
    });
    const result = evaluateDmKernelThreadOpenBudget("p1", "c1");
    expect(result.pass).toBe(false);
    expect(result.issues).toContain("initial_sqlite_2");
  });

  it("does not count session cache hits against sqlite budget", () => {
    recordDmKernelInvoke({
      kind: "messages_initial",
      profileId: "p1",
      conversationId: "c1",
      atUnixMs: Date.now(),
      source: "session_cache",
    });
    expect(evaluateDmKernelThreadOpenBudget("p1", "c1").pass).toBe(true);
  });

  it("allows pagination invokes beyond initial budget", () => {
    recordDmKernelInvoke({
      kind: "messages_initial",
      profileId: "p1",
      conversationId: "c1",
      atUnixMs: Date.now(),
      source: "sqlite",
    });
    recordDmKernelInvoke({
      kind: "messages_pagination",
      profileId: "p1",
      conversationId: "c1",
      atUnixMs: Date.now(),
      source: "sqlite",
    });
    const result = evaluateDmKernelThreadOpenBudget("p1", "c1");
    expect(result.pass).toBe(true);
    expect(result.paginationInvokes).toBe(1);
  });
});
