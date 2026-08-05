import { describe, expect, it } from "vitest";
import {
  DEV_LAB_TOMBSTONED,
  DEV_LAB_VERSION,
  isDevLabEnabled,
} from "./dev-lab-tombstone-policy";

describe("dev-lab tombstone policy", () => {
  it("remains permanently disabled", () => {
    expect(DEV_LAB_TOMBSTONED).toBe(true);
    expect(DEV_LAB_VERSION.length).toBeGreaterThan(0);
    expect(isDevLabEnabled()).toBe(false);
  });
});
