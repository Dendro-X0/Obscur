import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * C1 exit contract — transport selector wires Clearnet|Tor to existing gateway IPC.
 */
describe("protocol adaptation transport C1", () => {
  const dir = __dirname;
  const read = (name: string) => readFileSync(path.join(dir, name), "utf8");
  const pwaApp = path.resolve(dir, "../..");

  it("NostrAdapter.connect applies transport via applyActiveTransport", () => {
    const adapter = read("nostr/nostr-adapter.ts");
    expect(adapter).toContain("applyActiveTransport");
    expect(adapter).toContain("connect: async (transport");
    expect(adapter).not.toMatch(/spawn.*tor\.exe/i);
  });

  it("apply-active-transport uses existing gateway IPC only", () => {
    const apply = read("apply-active-transport.ts");
    expect(apply).toContain("save_tor_settings");
    expect(apply).toContain("start_tor");
    expect(apply).toContain("stop_tor");
    expect(apply).toContain("enableTorProxy");
    expect(apply).toContain("Quiet does not reopen uncapped Quiet");
    expect(apply).toContain('transportId === "tor"');
  });

  it("layer exposes applyTransport for Settings", () => {
    const layer = read("layer.ts");
    expect(layer).toContain("applyTransport");
    expect(layer).toContain(".connect(transportId)");
  });

  it("Protocols settings panel calls applyTransport", () => {
    const panel = readFileSync(
      path.join(pwaApp, "settings/panels/protocols-settings-tab-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("applyTransport");
    expect(panel).toContain("transport-option-");
  });

  it("Security Tor toggle syncs transport plane", () => {
    const autoLock = readFileSync(
      path.join(pwaApp, "features/settings/hooks/use-auto-lock.ts"),
      "utf8",
    );
    expect(autoLock).toContain("syncTransportIdFromTorPreference");
  });
});
