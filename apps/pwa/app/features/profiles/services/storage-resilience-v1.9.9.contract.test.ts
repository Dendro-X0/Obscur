import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("verify:storage-resilience-v1.9.9 contract", () => {
  it("wires vitest and cargo data_root health tests", () => {
    expect(packageJson.scripts["verify:storage-resilience-v1.9.9"]).toContain(
      "obscur-data-root-path-resolution.test.ts",
    );
    expect(packageJson.scripts["verify:storage-resilience-v1.9.9"]).toContain(
      "data-root-unavailable-recovery.test.tsx",
    );
    expect(packageJson.scripts["verify:storage-resilience-v1.9.9"]).toContain(
      "cargo test data_root::tests",
    );
  });
});
