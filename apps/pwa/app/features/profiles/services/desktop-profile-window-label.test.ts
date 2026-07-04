import { describe, expect, it } from "vitest";
import {
  isMainWindowLabel,
  isSecondaryProfileWindowLabel,
  parseProfileIdFromWindowLabel,
} from "./desktop-profile-window-label";

describe("desktop profile window label", () => {
  it("parses profile id from secondary window labels", () => {
    expect(parseProfileIdFromWindowLabel("profile-profile-2-1700000000000")).toBe("profile-2");
    expect(parseProfileIdFromWindowLabel("profile-default-1700000000000")).toBe("default");
  });

  it("returns null for main and malformed labels", () => {
    expect(parseProfileIdFromWindowLabel("main")).toBeNull();
    expect(parseProfileIdFromWindowLabel("profile-incomplete")).toBeNull();
    expect(isSecondaryProfileWindowLabel("main")).toBe(false);
    expect(isSecondaryProfileWindowLabel("profile-profile-2-1700000000000")).toBe(true);
  });

  it("detects the main window label", () => {
    expect(isMainWindowLabel("main")).toBe(true);
    expect(isMainWindowLabel("profile-profile-2-1700000000000")).toBe(false);
  });
});
