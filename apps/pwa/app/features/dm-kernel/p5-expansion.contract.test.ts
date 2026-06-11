import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P5 expansion exit contract — post proof gate.
 */
describe("P5 expansion contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("cold-start repair owner mounts in unlocked runtime shell", () => {
    const shell = read("app/features/runtime/components/unlocked-app-runtime-shell.tsx");
    expect(shell).toContain("DmKernelColdStartRepairOwner");
  });

  it("group thread display routes through dm-kernel group port", () => {
    const hook = read("app/features/messaging/hooks/use-group-thread-messages.ts");
    const adapter = read("app/features/messaging/services/thread-history/group-adapter.ts");
    expect(hook).toContain("loadDmKernelGroupThreadPage");
    expect(adapter).toContain("loadDmKernelGroupThreadPage");
  });

  it("dm thread hook reloads after relay backfill repair event", () => {
    const hook = read("app/features/dm-kernel/use-dm-kernel-thread.ts");
    expect(hook).toContain("subscribeNativeDmRelayBackfillRepair");
    expect(hook).toContain("invalidateDmKernelThreadSessionCache");
    expect(hook).toContain("reloadThreadFromSqlite");
  });

  it("one-sided detect still requests dm-kernel repair port", () => {
    const integrity = read("app/features/dm-kernel/dm-kernel-integrity.ts");
    expect(integrity).toContain("requestDmKernelRelayBackfill");
    expect(integrity).toContain("dm_kernel.one_sided_sqlite");
  });
});
