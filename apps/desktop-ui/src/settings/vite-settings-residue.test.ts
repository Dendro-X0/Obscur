import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readViteSettingsResidue,
  removeViteSettingsRelay,
  upsertViteSettingsRelay,
  writeViteSettingsResidue,
} from "./vite-settings-residue";

describe("vite-settings-residue (Cut 14.1)", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
  });

  it("persists displayName, privacy, ui, and relay list", () => {
    writeViteSettingsResidue("default", {
      displayName: "Alice",
      relayList: [],
      privacySettings: { hideReadReceipts: true },
      uiSettings: { compact: true },
    });
    upsertViteSettingsRelay("default", { url: "wss://a.example", enabled: true });
    const residue = readViteSettingsResidue("default");
    expect(residue.displayName).toBe("Alice");
    expect(residue.privacySettings.hideReadReceipts).toBe(true);
    expect(residue.uiSettings.compact).toBe(true);
    expect(residue.relayList).toEqual([{ url: "wss://a.example", enabled: true }]);
    removeViteSettingsRelay("default", "wss://a.example");
    expect(readViteSettingsResidue("default").relayList).toEqual([]);
  });
});
