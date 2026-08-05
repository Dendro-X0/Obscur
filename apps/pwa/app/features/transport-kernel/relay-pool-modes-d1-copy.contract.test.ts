import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_STABLE_PRESET,
  PRODUCT_BOOT_TRANSPORT_PRESET,
  getTransportPreset,
} from "./transport-preset-catalog";

const enLocalePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../lib/i18n/locales/en.json",
);

const loadEnFlat = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(enLocalePath, "utf8")) as {
    translation?: Record<string, string>;
  };
  return parsed.translation ?? (parsed as Record<string, string>);
};

describe("D1 relay pool Single/Multi UX copy", () => {
  it("boot default remains public Multi-node (wire redundancy)", () => {
    expect(PRODUCT_BOOT_TRANSPORT_PRESET).toBe(DEFAULT_STABLE_PRESET);
    expect(PRODUCT_BOOT_TRANSPORT_PRESET.transportMode).toBe("redundancy");
    expect(getTransportPreset("low_latency")?.transportMode).toBe("basic");
  });

  it("EN Settings strings use Single-node / Multi-node product language", () => {
    const en = loadEnFlat();
    expect(en["settings.relays.redundancyModeTitle"]).toBe("Multi-node pool");
    expect(en["settings.relays.redundancyModeLabel"]).toBe("Multi-node (simultaneous)");
    expect(en["settings.relays.redundancyModeDesc"]).toContain("Multi-node");
    expect(en["settings.relays.redundancyModeDesc"]).toContain("Single-node");
    expect(en["settings.relays.mode.singleTitle"]).toBe("Single-node (auto-correct)");
    expect(en["settings.relays.mode.multiTitle"]).toBe("Multi-node");
    expect(en["settings.relays.presetGroup.publicNostr"]).toBe("Public Nostr relays");
    expect(en["settings.relays.presetGroup.publicNostrDesc"]).toContain("Default ship pool");
    expect(en["settings.relays.presetGroup.publicNostrDesc"]).toContain("not an uptime SLA");
    expect(en["settings.relays.preset.defaultStableDesc"]).toContain("Multi-node");
    expect(en["settings.relays.preset.highRedundancyDesc"]).toContain("Multi-node");
    expect(en["settings.relays.preset.lowLatencyDesc"]).toContain("Single-node (auto-correct)");
  });
});
