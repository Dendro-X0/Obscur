import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Platform rewrite band P6 — plane README fences (layout polish, no mass rename).
 * @see specs/backend/platform-p6-plane-readme-fences-design-2026-11.md
 */
describe("platform P6 plane README fences", () => {
  const featuresRoot = path.resolve(__dirname);
  const boundaryMarker = "platform-boundary-map-2026-11.md";

  const planes = [
    { dir: "auth-kernel", mustMatch: [/Auth plane/i, /Does not own/i, /ports/i] },
    { dir: "auth", mustMatch: [/Auth door/i, /Does not own/i, /auth-kernel/i] },
    { dir: "storage", mustMatch: [/Storage plane/i, /Does not own/i, /quarantine/i] },
    { dir: "protocol-adaptation", mustMatch: [/Owns/i, /Does not own/i, /ProtocolAdaptationLayer|PAL/i] },
    { dir: "profiles", mustMatch: [/slots/i, /Does not own/i] },
    { dir: "profile", mustMatch: [/Does not own/i] },
  ] as const;

  it("ships owns/does-not-own READMEs for rewrite-band planes", () => {
    for (const plane of planes) {
      const readmePath = path.join(featuresRoot, plane.dir, "README.md");
      expect(existsSync(readmePath), `${plane.dir}/README.md missing`).toBe(true);
      const text = readFileSync(readmePath, "utf8");
      if (plane.dir !== "profile" && plane.dir !== "profiles") {
        expect(text).toContain(boundaryMarker);
      }
      for (const pattern of plane.mustMatch) {
        expect(text, `${plane.dir} README`).toMatch(pattern);
      }
    }
  });
});
