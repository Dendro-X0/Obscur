import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Relays Standard vs Advanced IA — operator surfaces gated behind showAdvancedRelays.
 * @see specs/ui/relays-standard-advanced-ia-2026-10.md
 */
describe("relays standard / advanced IA", () => {
  const panel = readFileSync(
    path.join(__dirname, "relays-settings-tab-panel.tsx"),
    "utf8",
  );

  it("exposes Standard hint + Advanced toggle + path catalog depth", () => {
    expect(panel).toContain('data-testid="relays-standard-mode-hint"');
    expect(panel).toContain('data-testid="relays-advanced-toggle"');
    expect(panel).toContain("TransportPresetCatalogPanel");
    expect(panel).toContain("onNavigateToProtocols");
    expect(panel).toContain('catalogDepth={showAdvancedRelays ? "advanced" : "standard"}');
  });

  it("gates OfflinePack, ConduitMesh, community, and metrics behind Advanced", () => {
    const advancedStart = panel.indexOf('id="relay-advanced-settings"');
    expect(advancedStart).toBeGreaterThan(-1);
    const advancedSlice = panel.slice(advancedStart);
    expect(advancedSlice).toContain("<OfflinePackHelperPanel");
    expect(advancedSlice).toContain("<ConduitMeshSettingsPanel");
    expect(advancedSlice).toContain('id="relay-community-modes"');
    expect(advancedSlice).toContain('id="relay-performance-metrics"');
    expect(advancedSlice).toContain("<RelayDashboard");

    // Imports may mention symbols above; JSX usage must be inside Advanced.
    expect(panel.indexOf("<OfflinePackHelperPanel")).toBeGreaterThan(advancedStart);
    expect(panel.indexOf("<ConduitMeshSettingsPanel")).toBeGreaterThan(advancedStart);
    expect(panel.indexOf("<RelayDashboard")).toBeGreaterThan(advancedStart);
  });
});
