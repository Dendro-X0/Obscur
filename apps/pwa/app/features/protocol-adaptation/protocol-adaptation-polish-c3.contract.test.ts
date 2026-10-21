import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("protocol adaptation polish C3", () => {
  const dir = __dirname;
  const read = (name: string) => readFileSync(path.join(dir, name), "utf8");
  const pwaApp = path.resolve(dir, "../..");

  it("exposes performance budgets without Soft L3 reopen", () => {
    const budgets = read("performance-budgets.ts");
    expect(budgets).toContain("matrixSyncTimelineLimit");
    expect(budgets).toContain("matrixRoomMessagesLimit");
    expect(budgets).toContain("PAUSED");
    expect(budgets).not.toContain("uncapped Quiet");
  });

  it("emits protocol-adaptation-changed on preference writes", () => {
    const prefs = read("preferences.ts");
    expect(prefs).toContain("PROTOCOL_ADAPTATION_CHANGED_EVENT");
    expect(prefs).toContain("emitProtocolAdaptationChanged");
  });

  it("composer gates media via capabilities() not protocol id", () => {
    const composer = readFileSync(
      path.join(pwaApp, "features/messaging/components/composer.tsx"),
      "utf8",
    );
    expect(composer).toContain("useActiveProtocolCapabilities");
    expect(composer).toContain("capabilities.media");
    expect(composer).toContain("ProtocolCapabilityChips");
    expect(composer).not.toMatch(/protocolId\s*===\s*["']matrix["']/);
    expect(composer).not.toMatch(/getActiveProtocolId\(\)\s*===\s*["']matrix["']/);
  });

  it("Settings Protocols shows chips and migration hints", () => {
    const panel = readFileSync(
      path.join(pwaApp, "settings/panels/protocols-settings-tab-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("ProtocolCapabilityChips");
    expect(panel).toContain("ProtocolMigrationHints");
    expect(panel).toContain("getProtocolSwitchSummary");
  });

  it("Matrix CS client honors perf budgets", () => {
    const client = read("matrix-cs-client.ts");
    expect(client).toContain("PROTOCOL_ADAPTATION_PERF_BUDGETS");
    expect(client).toContain("matrixSyncTimelineLimit");
    expect(client).toContain("matrixRoomMessagesLimit");
  });
});
