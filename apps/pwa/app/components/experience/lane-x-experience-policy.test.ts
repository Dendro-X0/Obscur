import { describe, expect, it } from "vitest";
import {
  laneXStaggerDelayMs,
  resolveRouteWarmupSurface,
} from "./lane-x-experience-policy";

describe("lane-x-experience-policy", () => {
  it("resolves route surface from pathname", () => {
    expect(resolveRouteWarmupSurface("/settings/security")).toBe("settings");
    expect(resolveRouteWarmupSurface("/vault")).toBe("vault");
    expect(resolveRouteWarmupSurface("/network")).toBe("network");
  });

  it("prefers explicit surface override", () => {
    expect(resolveRouteWarmupSurface("/settings", "chats")).toBe("chats");
  });

  it("caps stagger delay growth", () => {
    expect(laneXStaggerDelayMs(0)).toBe(0);
    expect(laneXStaggerDelayMs(10)).toBe(420);
  });
});
