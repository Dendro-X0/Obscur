import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tier 4 exit contract — programmatic gates + native hydrate subtraction.
 */
describe("tier 4 complete contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("client gateway routes dm-kernel to inert thread-history stub", () => {
    const resolver = read("app/features/messaging/services/thread-history/resolve-dm-thread-history-adapter.ts");
    expect(resolver).toContain("isDmKernelAuthority");
    expect(resolver).toContain("dmKernelThreadHistoryStub");
    expect(resolver).toContain("return dmKernelThreadHistoryStub");
    expect(resolver).toContain("nativeDmThreadHistoryAdapter");
  });

  it("runtime transport owner subscribes relay backfill repair to syncMissedMessages", () => {
    const provider = read("app/features/messaging/providers/runtime-messaging-transport-owner-provider.tsx");
    expect(provider).toContain("subscribeNativeDmRelayBackfillRepair");
    expect(provider).toContain("syncMissedMessagesRef.current");
    expect(provider).toMatch(/syncMissedMessagesRef\.current\(new Date\(detail\.sinceUnixMs\)\)/);
  });

  it("dm-kernel CDP gate spec covers bidirectional sqlite evidence", () => {
    const spec = read("tests/e2e/dm-kernel-cdp-gate.spec.ts");
    expect(spec).toContain("bidirectional");
    expect(spec).toContain("captureDmKernelBidirectionalGate");
  });

  it("runtime capture lib scores dm_kernel.bidirectional gate", () => {
    const lib = readFileSync(
      path.resolve(pwaRoot, "..", "..", "scripts", "lib", "runtime-capture-lib.mjs"),
      "utf8",
    );
    expect(lib).toContain("dm_kernel.bidirectional");
  });
});
