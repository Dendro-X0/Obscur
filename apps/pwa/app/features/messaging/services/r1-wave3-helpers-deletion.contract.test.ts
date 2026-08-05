import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDmThreadHistoryAdapter } from "./thread-history/resolve-dm-thread-history-adapter";
import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";

/**
 * R1 Wave 3 — orphaned DM hydrate helpers deleted.
 * @see specs/backend/r1-wave3-helpers-deletion-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../..");

const DELETED = [
  "features/messaging/services/thread-history/native-dm-adapter.ts",
  "features/messaging/services/thread-history/native-dm-thread-hydrate.ts",
  "features/messaging/services/thread-history/hydrate-indexed-scan.ts",
  "features/messaging/services/thread-history/hydrate-indexed-map-rows.ts",
  "features/messaging/services/thread-history/hydrate-indexed-legacy-port.ts",
  "features/messaging/services/thread-history/hydrate-read-model.ts",
  "features/messaging/services/thread-history/materialization-load-earlier.ts",
  "features/messaging/services/thread-history/materialization-realtime.ts",
  "features/messaging/services/thread-history/projection-evidence-messages.ts",
  "features/messaging/services/thread-history/projection-live-merge.ts",
  "features/messaging/services/thread-history/dm-thread-history-legacy-port.ts",
] as const;

const KEPT_TYPES = [
  "features/messaging/services/thread-history/hydrate-read-model-types.ts",
  "features/messaging/services/thread-history/projection-live-merge-types.ts",
  "features/messaging/services/thread-history/port.ts",
  "features/messaging/services/thread-history/read-model.ts",
] as const;

describe("r1 wave3 helpers deletion", () => {
  it("orphaned hydrate helper implementations are gone", () => {
    for (const rel of DELETED) {
      expect(existsSync(join(APP_ROOT, rel)), rel).toBe(false);
    }
  });

  it("port types and finalize read-model remain", () => {
    for (const rel of KEPT_TYPES) {
      expect(existsSync(join(APP_ROOT, rel)), rel).toBe(true);
    }
  });

  it("gateway still resolves to dm-kernel stub", () => {
    expect(resolveDmThreadHistoryAdapter()).toBe(dmKernelThreadHistoryStub);
  });
});
