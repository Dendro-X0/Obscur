import { describe, expect, it } from "vitest";
import { formatAppVersionLabel } from "./app-version";

describe("formatAppVersionLabel", () => {
  it("strips leading v from release versions", () => {
    expect(formatAppVersionLabel("v1.5.4")).toBe("1.5.4");
    expect(formatAppVersionLabel("1.5.4")).toBe("1.5.4");
  });

  it("keeps dev label for local builds", () => {
    expect(formatAppVersionLabel("dev")).toBe("dev");
  });
});
