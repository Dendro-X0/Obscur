import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 4.3 — App must prefer native adapters via shared selection (stubs flag / host absent).
 * @see specs/backend/cut4-vite-native-port-wire-design-2026-11-09.md
 */

const SRC_ROOT = join(fileURLToPath(new URL(".", import.meta.url)));

describe("Cut 4.3 App adapter selection wire", () => {
  it("App resolves unlock + private-trust through shared selection helpers", () => {
    const app = readFileSync(join(SRC_ROOT, "App.tsx"), "utf8");
    expect(app).toContain("resolveDesktopUiDeviceUnlockPort");
    expect(app).toContain("resolveDesktopUiPrivateTrustHomePorts");
    expect(app).toContain("readDesktopUiLabStubsForced");
    expect(app).toContain("detectDesktopUiNativeRuntime");
    expect(app).toContain("createNativePrivateTrustHomePorts");
    expect(app).toContain("createViteNativeDeviceUnlockPort");
    expect(app).toContain("createViteHomeEnvelopeDeliver");
    expect(app).toContain("createVitePassphraseDeviceUnlockHandlers");
    expect(app).toContain("createViteTauriEngineHost");
    expect(app).not.toMatch(/from\s+["'][^"']*apps\/pwa\//);
    expect(app).not.toMatch(/from\s+["']@\/app\/features\//);
    expect(app).not.toMatch(/@obscur\/engine-host/);
  });

  it("selection law lives in runtime module (stubs or host absent → lab)", () => {
    const selection = readFileSync(
      join(SRC_ROOT, "runtime/desktop-ui-adapter-selection.ts"),
      "utf8",
    );
    expect(selection).toContain("shouldUseDesktopUiLabStubs");
    expect(selection).toContain("forceLabStubs");
    expect(selection).toContain("isNativeRuntime");
    expect(selection).toContain("OBSCUR_DESKTOP_UI_LAB_STUBS");
  });
});
