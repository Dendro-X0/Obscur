/** @vitest-environment node */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("KEY-MOAT Phase 6 — hardware step-up contract", () => {
  it("desktop exposes biometric capability + verification commands", () => {
    const libRs = readFileSync(
      resolve(process.cwd(), "../desktop/src-tauri/src/lib.rs"),
      "utf8",
    );
    expect(libRs).toContain("get_biometric_capability");
    expect(libRs).toContain("request_biometric_auth");
  });

  it("platform biometric module implements Windows Hello / Touch ID hooks", () => {
    const moduleSource = readFileSync(
      resolve(process.cwd(), "../desktop/src-tauri/src/platform_biometric.rs"),
      "utf8",
    );
    expect(moduleSource).toContain("probe_biometric_capability");
    expect(moduleSource).toContain("request_biometric_verification");
    expect(moduleSource).toContain("target_os = \"windows\"");
    expect(moduleSource).toContain("target_os = \"macos\"");
  });
});
