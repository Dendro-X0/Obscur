import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDmThreadHistoryAdapter } from "./thread-history/resolve-dm-thread-history-adapter";
import { dmThreadHistoryAdapter } from "./thread-history/dm-adapter";
import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";

/**
 * R1 Wave 2 — cold-hydrate pipeline deleted; gateway always stubs.
 * @see specs/backend/r1-wave2-pipeline-deletion-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../..");

const readApp = (rel: string): string => readFileSync(join(APP_ROOT, rel), "utf8");

describe("r1 wave2 pipeline deletion", () => {
  it("pipeline and port files are gone", () => {
    expect(existsSync(join(APP_ROOT, "features/messaging/services/dm-conversation-hydrate-pipeline.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/messaging/services/dm-conversation-hydrate-pipeline-port.ts"))).toBe(false);
  });

  it("resolveDmThreadHistoryAdapter always returns dm-kernel stub", () => {
    expect(resolveDmThreadHistoryAdapter()).toBe(dmKernelThreadHistoryStub);
    const source = readApp("features/messaging/services/thread-history/resolve-dm-thread-history-adapter.ts");
    expect(source).not.toContain("isObscurAllowLegacy");
    expect(source).not.toContain("require(");
  });

  it("dmThreadHistoryAdapter is the same stub", () => {
    expect(dmThreadHistoryAdapter).toBe(dmKernelThreadHistoryStub);
    const adapter = readApp("features/messaging/services/thread-history/dm-adapter.ts");
    expect(adapter).toContain("dmKernelThreadHistoryStub");
    expect(adapter).not.toContain("runLegacyDmConversationHydrateReadModelPipeline");
  });

  it("legacy port and orphaned helpers deleted (Wave 3)", () => {
    expect(existsSync(join(APP_ROOT, "features/messaging/services/thread-history/dm-thread-history-legacy-port.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/messaging/services/thread-history/native-dm-adapter.ts"))).toBe(false);
  });
});
