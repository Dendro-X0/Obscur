import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  readPreferredGroupCreateTier,
  writePreferredGroupCreateTier,
} from "./preferred-group-create-tier";

describe("preferred-group-create-tier", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips team preference", () => {
    expect(readPreferredGroupCreateTier()).toBeNull();
    writePreferredGroupCreateTier("team");
    expect(readPreferredGroupCreateTier()).toBe("team");
    writePreferredGroupCreateTier(null);
    expect(readPreferredGroupCreateTier()).toBeNull();
  });
});
